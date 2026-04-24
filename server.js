const http = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3001);
const ALBATO_WEBHOOK_URL = process.env.ALBATO_WEBHOOK_URL;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitStore = new Map();

if (!ALBATO_WEBHOOK_URL) {
  console.error("Missing ALBATO_WEBHOOK_URL environment variable.");
  process.exit(1);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function logLeadEvent(event, details = {}) {
  console.log(
    JSON.stringify({
      scope: "lead-capture",
      event,
      timestamp: new Date().toISOString(),
      ...details,
    })
  );
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 32 * 1024) {
        reject(new Error("Payload too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(raw));
    request.on("error", reject);
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = rateLimitStore.get(ip) || [];
  const fresh = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  fresh.push(now);
  rateLimitStore.set(ip, fresh);
  return fresh.length > RATE_LIMIT_MAX_REQUESTS;
}

function postToAlbato({ email, source, brandHandle, honeypot, createdAt }) {
  return new Promise((resolve, reject) => {
    const target = new URL(ALBATO_WEBHOOK_URL);
    const payload = new URLSearchParams({
      email,
      source,
      brand_handle: brandHandle || "",
      created_at: createdAt,
      honeypot: honeypot || "",
    }).toString();

    const request = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
            resolve({ statusCode: response.statusCode, body });
            return;
          }
          reject(new Error(`Albato webhook failed with status ${response.statusCode || 500}.`));
        });
      }
    );

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

const server = http.createServer(async (request, response) => {
  const clientIp = getClientIp(request);

  if (request.url === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.url !== "/api/lead-capture") {
    sendJson(response, 404, { ok: false, error: "Not found." });
    return;
  }

  if (request.method !== "POST") {
    logLeadEvent("method_not_allowed", {
      ip: clientIp,
      method: request.method,
      path: request.url,
    });
    sendJson(response, 405, { ok: false, error: "Method not allowed." });
    return;
  }

  try {
    if (isRateLimited(clientIp)) {
      logLeadEvent("rate_limited", {
        ip: clientIp,
        path: request.url,
      });
      sendJson(response, 429, { ok: false, error: "Too many requests." });
      return;
    }

    const rawBody = await collectBody(request);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const email = String(payload.email || "").trim().toLowerCase();
    const source = String(payload.source || "").trim() || "carousel-app";
    const brandHandle = String(payload.brand_handle || "").trim();
    const honeypot = String(payload.honeypot || "").trim();
    const createdAt = new Date().toISOString();

    if (honeypot) {
      logLeadEvent("honeypot_blocked", {
        ip: clientIp,
        source,
      });
      sendJson(response, 200, { ok: true });
      return;
    }

    if (!isValidEmail(email)) {
      logLeadEvent("invalid_email", {
        ip: clientIp,
        source,
        emailPreview: email.slice(0, 3),
      });
      sendJson(response, 400, { ok: false, error: "Invalid email." });
      return;
    }

    await postToAlbato({ email, source, brandHandle, honeypot, createdAt });
    logLeadEvent("lead_forwarded", {
      ip: clientIp,
      source,
      emailHashHint: `${email.slice(0, 3)}***${email.slice(email.indexOf("@"))}`,
      hasBrandHandle: Boolean(brandHandle),
    });
    sendJson(response, 200, {
      ok: true,
      lead: {
        email,
        source,
        brandHandle,
        capturedAt: createdAt,
      },
    });
  } catch (error) {
    logLeadEvent("lead_capture_error", {
      ip: clientIp,
      message: error.message,
    });
    sendJson(response, 500, { ok: false, error: "Lead capture failed." });
  }
});

server.listen(PORT, () => {
  console.log(`Carousel API listening on http://127.0.0.1:${PORT}`);
});
