const STORAGE_KEY = "carousel-studio-openai-key";

const SIZE_OPTIONS = {
  square: {
    label: "1:1",
    width: 1080,
    height: 1080,
    aspectRatio: "1 / 1",
    generationSize: "1088x1088",
  },
  portrait34: {
    label: "3:4",
    width: 1080,
    height: 1440,
    aspectRatio: "3 / 4",
    generationSize: "1088x1456",
  },
  widescreen169: {
    label: "16:9",
    width: 1600,
    height: 900,
    aspectRatio: "16 / 9",
    generationSize: "1600x896",
  },
  igPortrait: {
    label: "1080x1350",
    width: 1080,
    height: 1350,
    aspectRatio: "4 / 5",
    generationSize: "1088x1360",
  },
};

const GPT54_PRICING = {
  inputPerMillion: 2.5,
  outputPerMillion: 15,
};

const GPT_IMAGE_2_PRICING = {
  textInputPerMillion: 5,
  imageInputPerMillion: 8,
  imageOutputPerMillion: 30,
};

const IMAGE_OUTPUT_TOKEN_TABLE = {
  low: { "1088x1088": 272, "1088x1456": 408, "1088x1360": 408, "1600x896": 400 },
  medium: { "1088x1088": 1056, "1088x1456": 1584, "1088x1360": 1584, "1600x896": 1560 },
  high: { "1088x1088": 4160, "1088x1456": 6240, "1088x1360": 6240, "1600x896": 6160 },
  auto: { "1088x1088": 1056, "1088x1456": 1584, "1088x1360": 1584, "1600x896": 1560 },
};

const IMAGE_CONCURRENCY = 2;

const state = {
  plan: [],
  renderedSlides: [],
  currentStyleBrief: "",
  currentImageDna: "",
  currentDesignSystem: null,
  referenceImages: [],
  totalCost: 0,
  cache: {
    imageDna: new Map(),
    designSystem: new Map(),
    plan: new Map(),
  },
};

const elements = {
  form: document.querySelector("#generator-form"),
  apiKey: document.querySelector("#api-key"),
  content: document.querySelector("#content"),
  styleBrief: document.querySelector("#style-brief"),
  brandHandle: document.querySelector("#brand-handle"),
  handlePosition: document.querySelector("#handle-position"),
  referenceImages: document.querySelector("#reference-images"),
  referenceList: document.querySelector("#reference-list"),
  slideCount: document.querySelector("#slide-count"),
  size: document.querySelector("#size"),
  exportFormat: document.querySelector("#export-format"),
  quality: document.querySelector("#quality"),
  plannerModel: document.querySelector("#planner-model"),
  imageModel: document.querySelector("#image-model"),
  planButton: document.querySelector("#plan-btn"),
  generateButton: document.querySelector("#generate-btn"),
  exportPdfButton: document.querySelector("#export-pdf-btn"),
  exportJpegButton: document.querySelector("#export-jpeg-btn"),
  status: document.querySelector("#status-text"),
  costText: document.querySelector("#cost-text"),
  loadingPanel: document.querySelector("#loading-panel"),
  loadingText: document.querySelector("#loading-text"),
  styleSummary: document.querySelector("#style-summary"),
  styleSummaryText: document.querySelector("#style-summary-text"),
  styleSummarySource: document.querySelector("#style-summary-source"),
  imageDnaSummary: document.querySelector("#image-dna-summary"),
  imageDnaText: document.querySelector("#image-dna-text"),
  designSystemSummary: document.querySelector("#design-system-summary"),
  designSystemText: document.querySelector("#design-system-text"),
  slides: document.querySelector("#slides"),
  template: document.querySelector("#slide-template"),
};

elements.apiKey.value = localStorage.getItem(STORAGE_KEY) || "";
elements.apiKey.addEventListener("input", () => {
  localStorage.setItem(STORAGE_KEY, elements.apiKey.value.trim());
});

elements.referenceImages.addEventListener("change", async (event) => {
  try {
    const files = Array.from(event.target.files || []).slice(0, 5);
    state.referenceImages = await Promise.all(files.map(fileToReferenceImage));
    renderReferenceImages();
    if ((event.target.files || []).length > 5) {
      setStatus("已保留前 5 張參考圖片。");
    }
  } catch (error) {
    handleError(error);
  }
});

elements.planButton.addEventListener("click", () => {
  runPlanningOnly().catch(handleError);
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  runPlanningAndGeneration().catch(handleError);
});

elements.exportPdfButton.addEventListener("click", () => {
  exportPdf().catch(handleError);
});

elements.exportJpegButton.addEventListener("click", () => {
  exportJpegs().catch(handleError);
});

renderTotalCost();

function setStatus(message) {
  elements.status.textContent = message;
  if (!elements.loadingPanel.hidden) {
    elements.loadingText.textContent = message;
  }
}

function setBusy(isBusy) {
  elements.generateButton.disabled = isBusy;
  elements.planButton.disabled = isBusy;
  elements.loadingPanel.hidden = !isBusy;
  if (!isBusy) {
    elements.loadingText.textContent = "正在等待開始。";
  }
}

function validateInputs() {
  const apiKey = elements.apiKey.value.trim();
  const content = elements.content.value.trim();
  const styleBrief = elements.styleBrief.value.trim();
  const brandHandle = elements.brandHandle.value.trim();
  const handlePosition = elements.handlePosition.value;

  if (!apiKey) {
    throw new Error("請先貼上 OpenAI API Key。");
  }

  if (!content) {
    throw new Error("請先輸入 carousel 內容。");
  }

  return {
    apiKey,
    content,
    styleBrief,
    brandHandle,
    handlePosition,
    referenceImages: state.referenceImages,
    slideCount: Number(elements.slideCount.value),
    sizeKey: elements.size.value,
    exportFormat: elements.exportFormat.value,
    quality: elements.quality.value,
    plannerModel: elements.plannerModel.value,
    imageModel: elements.imageModel.value,
  };
}

function isMissingContentError(error) {
  return error?.message === "請先輸入 carousel 內容。";
}

function currentSettings() {
  return validateInputs();
}

function resetRunCost() {
  state.totalCost = 0;
  renderTotalCost();
}

function addCost(amount) {
  state.totalCost += amount;
  renderTotalCost();
}

function renderTotalCost() {
  elements.costText.textContent = `$${state.totalCost.toFixed(2)}`;
}

async function runPlanningOnly() {
  const settings = validateInputs();
  resetRunCost();
  setBusy(true);
  setStatus("正在讓 ChatGPT 規劃每一頁內容與視覺方向...");

  const imageDna = await maybeAnalyzeReferenceImages(settings);
  const designSystem = await generateDesignSystem(settings, imageDna);
  const plan = await planCarousel(settings, imageDna, designSystem);
  state.plan = plan;
  state.renderedSlides = [];
  renderSlides(plan, settings);
  updateExportButtons();
  setStatus(`已完成 ${plan.length} 頁規劃。`);
  setBusy(false);
}

async function runPlanningAndGeneration() {
  const settings = validateInputs();
  resetRunCost();
  setBusy(true);
  setStatus("先規劃每一頁的結構與設計方向...");

  const imageDna = await maybeAnalyzeReferenceImages(settings);
  const designSystem = await generateDesignSystem(settings, imageDna);
  const plan = await planCarousel(settings, imageDna, designSystem);
  state.plan = plan;
  state.renderedSlides = [];
  renderSlides(plan, settings);

  const successCount = await generateSlidesInParallel(plan, settings);

  updateExportButtons();
  if (successCount === plan.length) {
    setStatus(`已完成 ${plan.length} 頁生成，可匯出 ${settings.exportFormat.toUpperCase()}。`);
  } else if (successCount > 0) {
    setStatus(`已生成 ${successCount} / ${plan.length} 頁。未完成的頁面已顯示錯誤原因。`);
  } else {
    setStatus("所有頁面都生成失敗，畫面上已顯示 OpenAI 回傳的錯誤。");
  }
  setBusy(false);
}

async function maybeAnalyzeReferenceImages(settings) {
  if (!settings.referenceImages.length) {
    state.currentImageDna = "";
    renderImageDnaSummary("");
    return "";
  }

  const cacheKey = hashString(
    JSON.stringify({
      styleBrief: settings.styleBrief,
      references: settings.referenceImages.map((image) => ({
        name: image.name,
        dataUrl: image.dataUrl,
      })),
      brandHandle: settings.brandHandle,
      handlePosition: settings.handlePosition,
    })
  );
  const cached = state.cache.imageDna.get(cacheKey);
  if (cached) {
    state.currentImageDna = cached;
    renderImageDnaSummary(cached);
    setStatus("已重用快取的 Image DNA。");
    return cached;
  }

  setStatus(`正在分析 ${settings.referenceImages.length} 張參考圖片，提煉 Image DNA...`);
  const dna = await analyzeReferenceImages(settings);
  state.currentImageDna = dna;
  state.cache.imageDna.set(cacheKey, dna);
  renderImageDnaSummary(dna);
  return dna;
}

async function analyzeReferenceImages(settings) {
  const messages = [
    {
      role: "system",
      content:
        "You are a visual design analyst. Analyze reference images and extract one unified visual DNA summary for future image generation. Focus on recurring style traits rather than page-specific content. Return concise but concrete Traditional Chinese text only.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            "請分析這些參考圖片，整理成一份可直接用於提示詞的 Image DNA。",
            "請用繁體中文，分成這些部分：",
            "Color Palette",
            "Illustration Style",
            "Typography",
            "Composition",
            "Design Philosophy",
            "另外補一段「How to keep consistency across all slides」。",
            settings.styleBrief
              ? `如果使用者有提供文字風格要求，也要一起整合：${settings.styleBrief}`
              : "如果圖片之間有共同視覺語言，請提煉成一套一致的 style system。",
          ].join("\n"),
        },
        ...settings.referenceImages.map((image) => ({
          type: "image_url",
          image_url: { url: image.dataUrl, detail: "high" },
        })),
      ],
    },
  ];

  const payload = {
    model: settings.plannerModel,
    messages,
  };

  const result = await openAiRequest("/v1/chat/completions", settings.apiKey, payload);
  addCost(estimateGpt54Cost(result));
  return extractMessageText(result).trim();
}

async function generateDesignSystem(settings, imageDna) {
  const cacheKey = hashString(
    JSON.stringify({
      plannerModel: settings.plannerModel,
      styleBrief: settings.styleBrief,
      imageDna,
      brandHandle: settings.brandHandle,
      handlePosition: settings.handlePosition,
    })
  );
  const cached = state.cache.designSystem.get(cacheKey);
  if (cached) {
    state.currentDesignSystem = cached;
    renderDesignSystemSummary(cached);
    setStatus("已重用快取的 Design System。");
    return cached;
  }

  setStatus("正在建立這套 carousel 的 Design System...");
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      visualSystem: { type: "string" },
      fixedRules: { type: "string" },
      variableRules: { type: "string" },
      forbiddenPatterns: { type: "string" },
      layoutFamilies: {
        type: "array",
        minItems: 4,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            layoutType: { type: "string" },
            name: { type: "string" },
            useCase: { type: "string" },
            structureRules: { type: "string" },
            variableZones: { type: "string" },
          },
          required: [
            "layoutType",
            "name",
            "useCase",
            "structureRules",
            "variableZones",
          ],
        },
      },
    },
    required: [
      "visualSystem",
      "fixedRules",
      "variableRules",
      "forbiddenPatterns",
      "layoutFamilies",
    ],
  };

  const payload = {
    model: settings.plannerModel,
    messages: [
      {
        role: "system",
        content:
          "You are a senior social design system art director. Create one coherent carousel design system that allows multiple page types while preserving a unified visual language. Return valid JSON only.",
      },
      {
        role: "user",
        content: [
          "Create a carousel design system in Traditional Chinese.",
          settings.styleBrief
            ? `User style brief: ${settings.styleBrief}`
            : "Global style direction: Build one coherent visual system across all pages with consistent typography, palette, spacing rhythm, framing logic, and recurring layout motifs.",
          settings.brandHandle
            ? `Brand handle rule: every page must include ${settings.brandHandle} at the ${settings.handlePosition} safe area, with consistent size, styling, and placement. It should feel like a subtle brand signature, not a headline.`
            : "",
          imageDna ? `Reference-image visual DNA:\n${imageDna}` : "",
          "Build a reusable design system instead of one rigid master layout.",
          "The system should keep style, palette, typography, illustration language, spacing rhythm, and information density consistent.",
          "But it must allow multiple layout families for different content needs such as cover, comparison, concept explainer, steps, quote, and CTA.",
          "For layoutFamilies, generate 4 to 6 options. Each layoutType should be short kebab-case English.",
          "structureRules should explain what remains structurally consistent. variableZones should explain what content can change.",
          "forbiddenPatterns should state what kinds of visual drift should be avoided across slides.",
        ].filter(Boolean).join("\n"),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "carousel_design_system",
        strict: true,
        schema,
      },
    },
  };

  const result = await openAiRequest("/v1/chat/completions", settings.apiKey, payload);
  addCost(estimateGpt54Cost(result));
  const raw = extractMessageText(result);

  if (!raw) {
    throw new Error("Design system API 沒有回傳內容。");
  }

  const parsed = JSON.parse(raw);
  state.currentDesignSystem = parsed;
  state.cache.designSystem.set(cacheKey, parsed);
  renderDesignSystemSummary(parsed);
  return parsed;
}

async function planCarousel(settings, imageDna, designSystem) {
  const cacheKey = hashString(
    JSON.stringify({
      plannerModel: settings.plannerModel,
      content: settings.content,
      styleBrief: settings.styleBrief,
      imageDna,
      designSystem,
      brandHandle: settings.brandHandle,
      handlePosition: settings.handlePosition,
      slideCount: settings.slideCount,
      sizeKey: settings.sizeKey,
    })
  );
  const cached = state.cache.plan.get(cacheKey);
  if (cached) {
    setStatus("已重用快取的 Carousel 規劃。");
    return cached;
  }

  const sizeConfig = SIZE_OPTIONS[settings.sizeKey];
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      slides: {
        type: "array",
        minItems: settings.slideCount,
        maxItems: settings.slideCount,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            pageNumber: { type: "integer" },
            headline: { type: "string" },
            pageText: { type: "string" },
            layoutType: { type: "string" },
            layoutReason: { type: "string" },
            designDirection: { type: "string" },
            visualElements: { type: "string" },
            styleCarryover: { type: "string" },
            imagePrompt: { type: "string" },
          },
          required: [
            "pageNumber",
            "headline",
            "pageText",
            "layoutType",
            "layoutReason",
            "designDirection",
            "visualElements",
            "styleCarryover",
            "imagePrompt",
          ],
        },
      },
    },
    required: ["slides"],
  };

  const payload = {
    model: settings.plannerModel,
    messages: [
      {
        role: "system",
        content:
          "You are a senior social carousel strategist and art director. Convert source content into a slide-by-slide carousel plan using the provided design system. Each slide may choose a different layout family, but all slides must still feel like one coherent series. Return valid JSON only.",
      },
      {
        role: "user",
        content: [
          `Create a ${settings.slideCount}-page carousel plan in Traditional Chinese.`,
          `Target format: ${sizeConfig.label}. Final export canvas: ${sizeConfig.width}x${sizeConfig.height}.`,
          "The user will generate each page separately with GPT Image.",
          settings.styleBrief
            ? `Global style direction that every page must consistently follow: ${settings.styleBrief}`
            : "Global style direction: Build one coherent visual system across all pages with consistent typography, palette, spacing rhythm, framing logic, and recurring layout motifs.",
          settings.brandHandle
            ? `Brand handle rule: include ${settings.brandHandle} on every page at the ${settings.handlePosition} safe area. Keep it consistent, subtle, readable, and visually integrated.`
            : "",
          imageDna ? `Reference-image visual DNA that every page should inherit:\n${imageDna}` : "",
          `Use this design system:\n${formatDesignSystem(designSystem)}`,
          "Choose the best layoutType for each slide from the allowed layout families. Do not force every slide into one template.",
          "For each slide:",
          "- pageText should contain the actual visible text intended to appear on the slide.",
          "- layoutType must match one of the design system layout families.",
          "- layoutReason should explain why this page uses that layout family.",
          "- designDirection should explain layout, hierarchy, typographic feel, and how the page inherits the shared style system.",
          "- visualElements should list the main imagery, textures, and composition notes specific to that page while staying inside the shared style language.",
          "- styleCarryover should explain in one concise Traditional Chinese paragraph how this slide preserves the shared style system from the user's brief.",
          "- imagePrompt must be a detailed prompt for a single standalone carousel page, asking for polished editorial social design, accurate typography, the exact slide text, and strict consistency with the shared style system.",
          "Source content:",
          settings.content,
        ].join("\n"),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "carousel_plan",
        strict: true,
        schema,
      },
    },
  };

  const result = await openAiRequest("/v1/chat/completions", settings.apiKey, payload);
  addCost(estimateGpt54Cost(result));
  const raw = extractMessageText(result);

  if (!raw) {
    throw new Error("規劃 API 沒有回傳內容。");
  }

  const parsed = JSON.parse(raw);
  state.cache.plan.set(cacheKey, parsed.slides);
  return parsed.slides;
}

async function generateSlideImage(slide, settings, revisionComment = "") {
  const sizeConfig = SIZE_OPTIONS[settings.sizeKey];
  const outputFormat = "jpeg";
  const generationQuality = resolveGenerationQuality(settings.quality);
  const revisionNonce = revisionComment ? `revision-${Date.now()}` : "";
  const payload = {
    model: settings.imageModel,
    prompt: [
      `Create one premium social media carousel slide for ${sizeConfig.label} composition.`,
      "This is a single page in a multi-page carousel.",
      "Design it as a polished branded post with strong typography, clear hierarchy, elegant spacing, and realistic editorial quality.",
      settings.styleBrief
        ? `Shared style system for the entire carousel: ${settings.styleBrief}`
        : "Shared style system for the entire carousel: maintain one consistent design language across every page, including recurring typography, palette, spacing rhythm, layout grammar, and decorative treatment.",
      settings.brandHandle
        ? `Brand signature: include ${settings.brandHandle} at the ${settings.handlePosition} safe area. Keep it small, consistent, and integrated into the page design without overpowering the main message.`
        : "",
      state.currentImageDna
        ? `Reference-image visual DNA to preserve across all slides:\n${state.currentImageDna}`
        : "",
      state.currentDesignSystem
        ? `Design system and allowed layout families:\n${formatDesignSystem(state.currentDesignSystem)}`
        : "",
      `Selected layout family for this slide: ${slide.layoutType}`,
      `Why this layout fits: ${slide.layoutReason}`,
      "Follow the shared style system strictly. Keep the style, design grammar, visual treatment, and overall art direction consistent with the rest of the carousel. Only the page-specific content and supporting elements should vary.",
      revisionComment ? `User revision comment for this page: ${revisionComment}` : "",
      revisionComment
        ? "Apply the revision comment while preserving the original series style, image DNA, design system, layout family, composition logic, and key design elements of this page."
        : "",
      revisionComment
        ? "Do not redesign from scratch. This is a targeted revision for one existing carousel page."
        : "",
      revisionNonce ? `Revision nonce: ${revisionNonce}` : "",
      `Use this exact slide text:\n${slide.pageText}`,
      `Design direction: ${slide.designDirection}`,
      `Visual elements: ${slide.visualElements}`,
      `Additional art direction: ${slide.imagePrompt}`,
      "Keep all important text comfortably inside the safe area. No watermarks.",
    ].join("\n\n"),
    size: sizeConfig.generationSize,
    quality: generationQuality,
    output_format: outputFormat,
    output_compression: 92,
    background: "opaque",
  };

  const result = await openAiRequest("/v1/images/generations", settings.apiKey, payload);
  addCost(estimateImageGenerationCost(payload, settings.referenceImages.length));
  const imageBase64 =
    result?.data?.[0]?.b64_json ||
    result?.data?.[0]?.base64 ||
    result?.data?.[0]?.image_base64;
  const resolvedFormat = normalizeImageFormat(result?.output_format || outputFormat);

  if (!imageBase64) {
    throw new Error(`第 ${slide.pageNumber} 頁圖片生成失敗。`);
  }

  const originalDataUrl = `data:${mimeTypeForFormat(resolvedFormat)};base64,${imageBase64}`;
  const exportDataUrl = await renderForExport(originalDataUrl, sizeConfig);
  return {
    pageNumber: slide.pageNumber,
    originalDataUrl,
    exportDataUrl,
    width: sizeConfig.width,
    height: sizeConfig.height,
    updatedAt: Date.now(),
  };
}

function renderSlides(plan, settings) {
  elements.slides.innerHTML = "";
  elements.slides.classList.remove("empty-state");
  renderStyleSummary(settings.styleBrief);
  const sizeKey = settings.sizeKey;
  const sizeConfig = SIZE_OPTIONS[sizeKey];

  for (const slide of plan) {
    const node = elements.template.content.firstElementChild.cloneNode(true);
    node.dataset.page = String(slide.pageNumber);
    node.querySelector(".slide-index").textContent = `Page ${slide.pageNumber}`;
    node.querySelector(".slide-title").textContent = slide.headline;
    node.querySelector(".slide-copy").textContent = slide.pageText;
    node.querySelector(".slide-preview").style.aspectRatio = sizeConfig.aspectRatio;
    node.querySelector(".slide-meta").append(
      metaChip(`Layout: ${slide.layoutType}`),
      metaChip(`Why this layout: ${slide.layoutReason}`),
      metaChip(`Shared style: ${slide.styleCarryover}`),
      metaChip(`Design: ${slide.designDirection}`),
      metaChip(`Visuals: ${slide.visualElements}`)
    );
    const regenerateButton = node.querySelector(".slide-regenerate-btn");
    regenerateButton.addEventListener("click", () => {
      regenerateSingleSlide(slide.pageNumber).catch(handleError);
    });
    elements.slides.append(node);
  }
}

async function regenerateSingleSlide(pageNumber) {
  const settings = currentSettings();
  const slideIndex = state.plan.findIndex((slide) => slide.pageNumber === pageNumber);
  if (slideIndex === -1) {
    throw new Error("找不到要修改的頁面。");
  }

  const slide = state.plan[slideIndex];
  const slideNode = elements.slides.children[slideIndex];
  const comment = slideNode?.querySelector(".slide-comment")?.value.trim();

  if (!comment) {
    throw new Error("請先輸入這一頁的修改 comment。");
  }

  setBusy(true);
  setStatus(`正在按 comment 重生成第 ${pageNumber} 頁...`);
  window.scrollTo({ top: 0, behavior: "smooth" });

  const revisedSlide = await reviseSlidePlan(slide, settings, comment);
  state.plan[slideIndex] = revisedSlide;
  updateSlideContent(slideIndex, revisedSlide, settings.sizeKey);

  const regenerated = await generateSlideImage(revisedSlide, settings, comment);
  state.renderedSlides[slideIndex] = regenerated;
  hydrateSlideImage(slideIndex, regenerated, settings.sizeKey, { isRegenerated: true });

  setStatus(`第 ${pageNumber} 頁已按 comment 重生成。`);
  setBusy(false);
}

async function reviseSlidePlan(slide, settings, revisionComment) {
  setStatus(`正在重寫第 ${slide.pageNumber} 頁內容規格...`);
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      pageNumber: { type: "integer" },
      headline: { type: "string" },
      pageText: { type: "string" },
      layoutType: { type: "string" },
      layoutReason: { type: "string" },
      designDirection: { type: "string" },
      visualElements: { type: "string" },
      styleCarryover: { type: "string" },
      imagePrompt: { type: "string" },
    },
    required: [
      "pageNumber",
      "headline",
      "pageText",
      "layoutType",
      "layoutReason",
      "designDirection",
      "visualElements",
      "styleCarryover",
      "imagePrompt",
    ],
  };

  const payload = {
    model: settings.plannerModel,
    messages: [
      {
        role: "system",
        content:
          "You are a senior social carousel art director. Revise one existing slide plan according to the user's comment. Keep the page inside the same series design system, preserve its layout family unless the comment explicitly requires a change, and update the visible text when needed. Return valid JSON only.",
      },
      {
        role: "user",
        content: [
          `Revise page ${slide.pageNumber} in Traditional Chinese.`,
          settings.styleBrief
            ? `Shared style brief: ${settings.styleBrief}`
            : "",
          settings.brandHandle
            ? `Brand signature must remain: ${settings.brandHandle} at ${settings.handlePosition}.`
            : "",
          state.currentImageDna
            ? `Reference-image visual DNA:\n${state.currentImageDna}`
            : "",
          state.currentDesignSystem
            ? `Design system:\n${formatDesignSystem(state.currentDesignSystem)}`
            : "",
          "Current slide plan:",
          JSON.stringify(slide, null, 2),
          `User revision comment: ${revisionComment}`,
          "Update the slide text and CTA if the comment asks for text changes.",
          "Preserve the original design language, illustration style, composition logic, and key series elements.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "revised_slide_plan",
        strict: true,
        schema,
      },
    },
  };

  const result = await openAiRequest("/v1/chat/completions", settings.apiKey, payload);
  addCost(estimateGpt54Cost(result));
  const raw = extractMessageText(result);

  if (!raw) {
    throw new Error("重寫單頁規格時沒有回傳內容。");
  }

  return JSON.parse(raw);
}

function updateSlideContent(index, slide, sizeKey) {
  const node = elements.slides.children[index];
  if (!node) return;

  const sizeConfig = SIZE_OPTIONS[sizeKey];
  node.querySelector(".slide-title").textContent = slide.headline;
  node.querySelector(".slide-copy").textContent = slide.pageText;
  node.querySelector(".slide-preview").style.aspectRatio = sizeConfig.aspectRatio;

  const meta = node.querySelector(".slide-meta");
  meta.innerHTML = "";
  meta.append(
    metaChip(`Layout: ${slide.layoutType}`),
    metaChip(`Why this layout: ${slide.layoutReason}`),
    metaChip(`Shared style: ${slide.styleCarryover}`),
    metaChip(`Design: ${slide.designDirection}`),
    metaChip(`Visuals: ${slide.visualElements}`)
  );
}

async function generateSlidesInParallel(plan, settings) {
  setStatus(`開始批量生成圖片，並行 ${IMAGE_CONCURRENCY} 張...`);
  let nextIndex = 0;
  let completedCount = 0;
  let successCount = 0;

  const worker = async () => {
    while (nextIndex < plan.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const slide = plan[currentIndex];

      try {
        const generated = await generateSlideImage(slide, settings);
        state.renderedSlides[currentIndex] = generated;
        hydrateSlideImage(currentIndex, generated, settings.sizeKey);
        successCount += 1;
      } catch (error) {
        state.renderedSlides[currentIndex] = null;
        markSlideError(currentIndex, error.message || "圖片生成失敗。");
      }

      completedCount += 1;
      setStatus(`正在生成圖片... 已完成 ${completedCount} / ${plan.length} 頁`);
    }
  };

  const workers = Array.from(
    { length: Math.min(IMAGE_CONCURRENCY, plan.length) },
    () => worker()
  );
  await Promise.all(workers);
  return successCount;
}

function renderStyleSummary(styleBrief) {
  const fallback =
    "未提供自訂風格時，系統會自動建立一套共享視覺語言，維持一致的字體感、配色、留白節奏、版式骨架與裝飾處理。";
  const hasCustomStyle = Boolean(styleBrief);
  state.currentStyleBrief = hasCustomStyle ? styleBrief : fallback;
  elements.styleSummary.hidden = false;
  elements.styleSummaryText.textContent = state.currentStyleBrief;
  elements.styleSummarySource.textContent = hasCustomStyle ? "User style brief" : "System default";
}

function renderImageDnaSummary(imageDna) {
  if (!imageDna) {
    elements.imageDnaSummary.hidden = true;
    elements.imageDnaSummary.open = false;
    elements.imageDnaText.textContent = "";
    return;
  }

  elements.imageDnaSummary.hidden = false;
  elements.imageDnaSummary.open = false;
  elements.imageDnaText.textContent = imageDna;
}

function renderDesignSystemSummary(designSystem) {
  if (!designSystem) {
    elements.designSystemSummary.hidden = true;
    elements.designSystemText.textContent = "";
    return;
  }

  elements.designSystemSummary.hidden = false;
  elements.designSystemText.textContent = formatDesignSystem(designSystem);
}

function renderReferenceImages() {
  elements.referenceList.innerHTML = "";
  if (!state.referenceImages.length) {
    elements.referenceList.hidden = true;
    return;
  }

  elements.referenceList.hidden = false;
  for (const image of state.referenceImages) {
    const item = document.createElement("div");
    item.className = "reference-chip";

    const thumb = document.createElement("img");
    thumb.className = "reference-thumb";
    thumb.src = image.dataUrl;
    thumb.alt = image.name;

    const name = document.createElement("div");
    name.className = "reference-name";
    name.textContent = image.name;

    item.append(thumb, name);
    elements.referenceList.append(item);
  }
}

function hydrateSlideImage(index, generated, sizeKey, options = {}) {
  const sizeConfig = SIZE_OPTIONS[sizeKey];
  const node = elements.slides.children[index];
  if (!node) return;

  const badge = node.querySelector(".slide-badge");
  const image = node.querySelector(".slide-image");
  const placeholder = node.querySelector(".slide-placeholder");
  const preview = node.querySelector(".slide-preview");

  badge.textContent = options.isRegenerated ? "Updated" : "Generated";
  badge.style.background = "rgba(87, 209, 154, 0.12)";
  badge.style.color = "var(--green)";
  preview.style.aspectRatio = sizeConfig.aspectRatio;
  node.classList.remove("has-error");
  image.removeAttribute("src");
  image.hidden = false;
  image.style.display = "none";
  image.src = generated.exportDataUrl;
  image.style.display = "block";
  placeholder.hidden = true;
}

function markSlideError(index, message) {
  const node = elements.slides.children[index];
  if (!node) return;

  const badge = node.querySelector(".slide-badge");
  const image = node.querySelector(".slide-image");
  const placeholder = node.querySelector(".slide-placeholder");
  const meta = node.querySelector(".slide-meta");

  badge.textContent = "Error";
  badge.style.background = "rgba(240, 80, 80, 0.12)";
  badge.style.color = "#ff8f8f";
  image.hidden = true;
  image.removeAttribute("src");
  image.style.display = "none";
  placeholder.hidden = false;
  placeholder.textContent = "生成失敗";
  node.classList.add("has-error");
  meta.prepend(metaChip(`Error: ${message}`));
}

function metaChip(text) {
  const div = document.createElement("div");
  div.className = "meta-chip";
  div.textContent = text;
  return div;
}

function updateExportButtons() {
  const hasSlides =
    state.renderedSlides.length > 0 && state.renderedSlides.some(Boolean);
  elements.exportPdfButton.disabled = !hasSlides;
  elements.exportJpegButton.disabled = !hasSlides;
}

async function fileToReferenceImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("只可以上傳圖片檔案。");
  }

  const dataUrl = await readFileAsDataUrl(file);
  return {
    name: file.name,
    dataUrl,
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`無法讀取檔案：${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function renderForExport(sourceDataUrl, sizeConfig) {
  const image = await loadImage(sourceDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = sizeConfig.width;
  canvas.height = sizeConfig.height;
  const context = canvas.getContext("2d");

  const destinationRatio = sizeConfig.width / sizeConfig.height;
  const sourceRatio = image.width / image.height;

  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > destinationRatio) {
    sourceWidth = image.height * destinationRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / destinationRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sizeConfig.width,
    sizeConfig.height
  );

  return canvas.toDataURL("image/jpeg", 0.92);
}

async function exportJpegs() {
  ensureSlidesReady();
  setStatus("正在組合 ZIP...");
  const files = state.renderedSlides
    .filter(Boolean)
    .map((slide) => ({
      name: `carousel-page-${slide.pageNumber}.jpg`,
      bytes: dataUrlToUint8Array(slide.exportDataUrl),
    }));

  const zipBytes = buildZip(files);
  downloadBlob(new Blob([zipBytes], { type: "application/zip" }), "carousel-images.zip");
  setStatus("ZIP 已下載。");
}

async function exportPdf() {
  ensureSlidesReady();
  setStatus("正在組合 PDF...");

  const pdfBytes = await buildPdf(state.renderedSlides);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "carousel.pdf";
  link.click();
  URL.revokeObjectURL(url);

  setStatus("PDF 已下載。");
}

function ensureSlidesReady() {
  const successfulSlides = state.renderedSlides.filter(Boolean);
  if (successfulSlides.length === 0) {
    throw new Error("目前沒有可匯出的圖片。");
  }
}

async function buildPdf(slides) {
  const pageObjects = [];
  const imageObjects = [];

  for (const slide of slides.filter(Boolean)) {
    const jpegBytes = dataUrlToUint8Array(slide.exportDataUrl);
    imageObjects.push({
      width: slide.width,
      height: slide.height,
      bytes: jpegBytes,
    });
  }

  let objectNumber = 1;
  const objects = [];
  const pageRefs = [];

  const catalogRef = objectNumber++;
  const pagesRef = objectNumber++;

  for (let index = 0; index < imageObjects.length; index += 1) {
    const imageRef = objectNumber++;
    const contentRef = objectNumber++;
    const pageRef = objectNumber++;

    const image = imageObjects[index];
    const contentStream = `q\n${image.width} 0 0 ${image.height} 0 0 cm\n/Im${index + 1} Do\nQ`;

    objects.push({
      ref: imageRef,
      body: [
        "<<",
        "/Type /XObject",
        "/Subtype /Image",
        `/Width ${image.width}`,
        `/Height ${image.height}`,
        "/ColorSpace /DeviceRGB",
        "/BitsPerComponent 8",
        "/Filter /DCTDecode",
        `/Length ${image.bytes.length}`,
        ">>",
        "stream",
        image.bytes,
        "endstream",
      ],
    });

    objects.push({
      ref: contentRef,
      body: [`<< /Length ${contentStream.length} >>`, "stream", contentStream, "endstream"],
    });

    objects.push({
      ref: pageRef,
      body: [
        "<<",
        "/Type /Page",
        `/Parent ${pagesRef} 0 R`,
        `/MediaBox [0 0 ${image.width} ${image.height}]`,
        `/Resources << /XObject << /Im${index + 1} ${imageRef} 0 R >> >>`,
        `/Contents ${contentRef} 0 R`,
        ">>",
      ],
    });

    pageRefs.push(`${pageRef} 0 R`);
    pageObjects.push(pageRef);
  }

  objects.unshift(
    {
      ref: catalogRef,
      body: ["<<", "/Type /Catalog", `/Pages ${pagesRef} 0 R`, ">>"],
    },
    {
      ref: pagesRef,
      body: ["<<", "/Type /Pages", `/Count ${pageRefs.length}`, `/Kids [${pageRefs.join(" ")}]`, ">>"],
    }
  );

  const chunks = [];
  const encoder = new TextEncoder();
  chunks.push(encoder.encode("%PDF-1.4\n"));
  const offsets = [0];
  let length = chunks[0].length;

  for (const object of objects.sort((a, b) => a.ref - b.ref)) {
    offsets[object.ref] = length;
    chunks.push(encoder.encode(`${object.ref} 0 obj\n`));
    length += chunks[chunks.length - 1].length;

    for (const part of object.body) {
      const bytes =
        part instanceof Uint8Array ? part : encoder.encode(typeof part === "string" ? `${part}\n` : "");
      chunks.push(bytes);
      length += bytes.length;
    }

    chunks.push(encoder.encode("endobj\n"));
    length += chunks[chunks.length - 1].length;
  }

  const xrefOffset = length;
  const xrefLines = [`xref`, `0 ${objects.length + 1}`, `0000000000 65535 f `];
  for (let ref = 1; ref <= objects.length; ref += 1) {
    xrefLines.push(`${String(offsets[ref]).padStart(10, "0")} 00000 n `);
  }
  const trailer = [
    ...xrefLines,
    "trailer",
    `<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>`,
    "startxref",
    `${xrefOffset}`,
    "%%EOF",
  ].join("\n");

  chunks.push(encoder.encode(trailer));
  return mergeUint8Arrays(chunks);
}

async function openAiRequest(path, apiKey, payload) {
  const response = await fetch(`https://api.openai.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let result;
  try {
    result = rawText ? JSON.parse(rawText) : {};
  } catch {
    result = { raw: rawText };
  }

  if (!response.ok) {
    const message =
      result?.error?.message ||
      result?.message ||
      (typeof result?.raw === "string" && result.raw.slice(0, 240)) ||
      "OpenAI API request failed.";
    throw new Error(message);
  }
  return result;
}

function normalizeImageFormat(format) {
  if (format === "jpg") return "jpeg";
  if (format === "png" || format === "jpeg" || format === "webp") return format;
  return "jpeg";
}

function mimeTypeForFormat(format) {
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return "image/jpeg";
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片載入失敗。"));
    image.src = src;
  });
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function mergeUint8Arrays(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractMessageText(result) {
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || "")
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function formatDesignSystem(designSystem) {
  if (!designSystem) return "";

  const layoutLines = (designSystem.layoutFamilies || [])
    .map(
      (layout) =>
        `[${layout.layoutType}] ${layout.name}\n適用場景：${layout.useCase}\n結構規則：${layout.structureRules}\n可變區域：${layout.variableZones}`
    )
    .join("\n\n");

  return [
    `Visual System:\n${designSystem.visualSystem}`,
    `Fixed Rules:\n${designSystem.fixedRules}`,
    `Variable Rules:\n${designSystem.variableRules}`,
    `Forbidden Patterns:\n${designSystem.forbiddenPatterns}`,
    `Layout Families:\n${layoutLines}`,
  ].join("\n\n");
}

function resolveGenerationQuality(selectedQuality) {
  return selectedQuality === "high" || selectedQuality === "medium" ? "low" : selectedQuality;
}

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return String(hash >>> 0);
}

function estimateGpt54Cost(result) {
  const usage = result?.usage || {};
  const inputTokens =
    usage.input_tokens ??
    usage.prompt_tokens ??
    usage.total_input_tokens ??
    0;
  const outputTokens =
    usage.output_tokens ??
    usage.completion_tokens ??
    usage.total_output_tokens ??
    0;

  return (
    (inputTokens / 1_000_000) * GPT54_PRICING.inputPerMillion +
    (outputTokens / 1_000_000) * GPT54_PRICING.outputPerMillion
  );
}

function estimateImageGenerationCost(payload, referenceImageCount) {
  const qualityKey = payload.quality in IMAGE_OUTPUT_TOKEN_TABLE ? payload.quality : "auto";
  const outputImageTokens = IMAGE_OUTPUT_TOKEN_TABLE[qualityKey]?.[payload.size] || 1584;
  const promptTextTokens = Math.ceil((payload.prompt || "").length / 4);
  const estimatedInputImageTokens = referenceImageCount * 768;

  return (
    (promptTextTokens / 1_000_000) * GPT_IMAGE_2_PRICING.textInputPerMillion +
    (estimatedInputImageTokens / 1_000_000) * GPT_IMAGE_2_PRICING.imageInputPerMillion +
    (outputImageTokens / 1_000_000) * GPT_IMAGE_2_PRICING.imageOutputPerMillion
  );
}

function buildZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const localHeader = concatUint8Arrays([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.bytes.length),
      u32(file.bytes.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      file.bytes,
    ]);
    localParts.push(localHeader);

    const centralHeader = concatUint8Arrays([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.bytes.length),
      u32(file.bytes.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length;
  }

  const localSection = concatUint8Arrays(localParts);
  const centralDirectory = concatUint8Arrays(centralParts);
  const endRecord = concatUint8Arrays([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDirectory.length),
    u32(localSection.length),
    u16(0),
  ]);

  return concatUint8Arrays([localSection, centralDirectory, endRecord]);
}

function concatUint8Arrays(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function u16(value) {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value) {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  );
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function handleError(error) {
  console.error(error);
  if (isMissingContentError(error)) {
    elements.content.focus();
    window.alert("請先填寫 Carousel 內容。");
  }
  setBusy(false);
  setStatus(error.message || "發生未預期錯誤。");
}
