const http = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3001);
const ALBATO_WEBHOOK_URL = process.env.ALBATO_WEBHOOK_URL;

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
  if (request.url === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.url !== "/api/lead-capture") {
    sendJson(response, 404, { ok: false, error: "Not found." });
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Method not allowed." });
    return;
  }

  try {
    const rawBody = await collectBody(request);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const email = String(payload.email || "").trim().toLowerCase();
    const source = String(payload.source || "").trim() || "carousel-app";
    const brandHandle = String(payload.brand_handle || "").trim();
    const honeypot = String(payload.honeypot || "").trim();
    const createdAt = new Date().toISOString();

    if (honeypot) {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (!isValidEmail(email)) {
      sendJson(response, 400, { ok: false, error: "Invalid email." });
      return;
    }

    await postToAlbato({ email, source, brandHandle, honeypot, createdAt });
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
    console.error("Lead capture error:", error);
    sendJson(response, 500, { ok: false, error: "Lead capture failed." });
  }
});

server.listen(PORT, () => {
  console.log(`Carousel API listening on http://127.0.0.1:${PORT}`);
});
