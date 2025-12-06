// public/app.js – Lot Rocket frontend logic v2.5.5
// Stable: theme toggle, Boost, calculators, side tools.
// Step 3: Creative Hub (Fabric) + Design Studio 3.0 (Konva).

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Lot Rocket frontend loaded v2.5.5");
  const apiBase = "";

  // --------------------------------------------------
  // THEME TOGGLE
  // --------------------------------------------------
  const themeToggleInput = document.getElementById("themeToggle");
  if (themeToggleInput) {
    const applyTheme = (isDark) => {
      if (isDark) {
        document.body.classList.add("dark-theme");
      } else {
        document.body.classList.remove("dark-theme");
      }
      themeToggleInput.checked = isDark;
    };
    applyTheme(true);
    themeToggleInput.addEventListener("change", () => {
      applyTheme(themeToggleInput.checked);
    });
  }

  // ==================================================
  // STEP 1 – DEALER URL + SOCIAL KIT
  // ==================================================

  const vehicleUrlInput = document.getElementById("vehicleUrl");
  const vehicleLabelInput = document.getElementById("vehicleLabel");
  const priceInfoInput = document.getElementById("priceInfo");
  const boostButton = document.getElementById("boostButton");
  const statusText = document.getElementById("statusText");

  const summaryLabel = document.getElementById("summaryLabel");
  const summaryPrice = document.getElementById("summaryPrice");

  const facebookPost = document.getElementById("facebookPost");
  const instagramPost = document.getElementById("instagramPost");
  const tiktokPost = document.getElementById("tiktokPost");
  const linkedinPost = document.getElementById("linkedinPost");
  const twitterPost = document.getElementById("twitterPost");
  const textBlurb = document.getElementById("textBlurb");
  const marketplacePost = document.getElementById("marketplacePost");
  const hashtags = document.getElementById("hashtags");

  const photosGrid = document.getElementById("photosGrid");

  // Works with either id="sendPhotosToCreative" or id="sendPhotosToStudio"
  const sendPhotosToStudioBtn =
    document.getElementById("sendPhotosToCreative") ||
    document.getElementById("sendPhotosToStudio");

  // Dealer photos state (allows selection)
  let dealerPhotos = []; // [{ src, selected }]

  function renderDealerPhotos() {
    if (!photosGrid) return;
    photosGrid.innerHTML = "";

    dealerPhotos.forEach((photo, index) => {
      const wrapper = document.createElement("button");
      wrapper.type = "button";
      wrapper.className =
        "photo-thumb-btn" + (photo.selected ? " photo-thumb-selected" : "");
      wrapper.dataset.index = String(index);

      const img = document.createElement("img");
      img.src = photo.src;
      img.alt = `Dealer photo ${index + 1}`;
      img.loading = "lazy";
      img.className = "photo-thumb-img";

      wrapper.appendChild(img);
      photosGrid.appendChild(wrapper);
    });

    photosGrid.querySelectorAll(".photo-thumb-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index || "0");
        dealerPhotos[idx].selected = !dealerPhotos[idx].selected;
        renderDealerPhotos();
      });
    });
  }

  async function doBoostListing() {
    if (!vehicleUrlInput || !boostButton) return;

    const url = vehicleUrlInput.value.trim();
    const labelOverride = vehicleLabelInput?.value.trim() || "";
    const priceOverride = priceInfoInput?.value.trim() || "";

    if (!url) {
      alert("Paste a full dealer URL first.");
      return;
    }

    boostButton.disabled = true;
    if (statusText) statusText.textContent = "Scraping dealer page and building kit…";

    try {
      const res = await fetch(apiBase + "/api/social-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          labelOverride,
          priceOverride,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          (data && data.message) ||
          `Something went wrong building the kit (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      // Summary / overrides
      if (summaryLabel) summaryLabel.textContent = data.vehicleLabel || "—";
      if (summaryPrice) summaryPrice.textContent = data.priceInfo || "—";

      if (vehicleLabelInput && !vehicleLabelInput.value) {
        vehicleLabelInput.value = data.vehicleLabel || "";
      }
      if (priceInfoInput && !priceInfoInput.value) {
        priceInfoInput.value = data.priceInfo || "";
      }

      // Social posts
      if (facebookPost) facebookPost.value = data.facebook || "";
      if (instagramPost) instagramPost.value = data.instagram || "";
      if (tiktokPost) tiktokPost.value = data.tiktok || "";
      if (linkedinPost) linkedinPost.value = data.linkedin || "";
      if (twitterPost) twitterPost.value = data.twitter || "";
      if (textBlurb) textBlurb.value = data.text || "";
      if (marketplacePost) marketplacePost.value = data.marketplace || "";
      if (hashtags) hashtags.value = data.hashtags || "";

      // Photos – cap to 40
      const photos = Array.isArray(data.photos) ? data.photos.slice(0, 40) : [];
      dealerPhotos = photos.map((src) => ({ src, selected: false }));
      renderDealerPhotos();

      document.body.classList.add("kit-ready");
      if (statusText) statusText.textContent = "Social kit ready ✔";
    } catch (err) {
      console.error("❌ Boost error:", err);
      if (statusText)
        statusText.textContent =
          err && err.message
            ? err.message
            : "Failed to build kit. Try again in a moment.";
    } finally {
      if (boostButton) boostButton.disabled = false;
    }
  }

  if (boostButton) {
    boostButton.addEventListener("click", doBoostListing);
  }

  // --------------------------------------------------
  // COPY / REGEN
  // --------------------------------------------------
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-copy-target");
      if (!targetId) return;
      const el = document.getElementById(targetId);
      if (!el) return;

      el.select();
      el.setSelectionRange(0, 99999);
      document.execCommand("copy");

      btn.classList.add("copied");
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("copied");
      }, 1500);
    });
  });

  document.querySelectorAll(".regen-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const platform = btn.getAttribute("data-platform");
      if (!platform || !vehicleUrlInput) return;

      const url = vehicleUrlInput.value.trim();
      if (!url) {
        alert("Paste a dealer URL and hit Boost at least once first.");
        return;
      }

      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Thinking…";

      try {
        const label =
          vehicleLabelInput?.value.trim() || summaryLabel?.textContent || "";
        const price =
          priceInfoInput?.value.trim() || summaryPrice?.textContent || "";

        const res = await fetch(apiBase + "/api/new-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            url,
            label,
            price,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          const msg =
            (data && data.message) || `Error generating post (HTTP ${res.status}).`;
          throw new Error(msg);
        }

        const text = data.text || "";
        let targetId = "";
        switch (platform) {
          case "facebook": targetId = "facebookPost"; break;
          case "instagram": targetId = "instagramPost"; break;
          case "tiktok": targetId = "tiktokPost"; break;
          case "linkedin": targetId = "linkedinPost"; break;
          case "twitter": targetId = "twitterPost"; break;
          case "text": targetId = "textBlurb"; break;
          case "marketplace": targetId = "marketplacePost"; break;
          case "hashtags": targetId = "hashtags"; break;
        }
        if (targetId) {
          const ta = document.getElementById(targetId);
          if (ta) ta.value = text;
        }
      } catch (err) {
        console.error("❌ regen error", err);
        alert(
          err && err.message
            ? err.message
            : "Failed to generate a new post. Try again."
        );
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });

  // ==================================================
  // MODALS + TOOLS
  // ==================================================

  // Optional: field inside video modal to auto-fill with context
  const videoContextField = document.getElementById("videoContext");

  function buildVideoContextFromKit() {
    const parts = [];

    const label =
      (vehicleLabelInput && vehicleLabelInput.value.trim()) ||
      (summaryLabel && (summaryLabel.textContent || "").trim()) ||
      "";
    const price =
      (priceInfoInput && priceInfoInput.value.trim()) ||
      (summaryPrice && (summaryPrice.textContent || "").trim()) ||
      "";
    const url = vehicleUrlInput ? vehicleUrlInput.value.trim() : "";
    const tags = hashtags ? (hashtags.value || "").trim() : "";

    if (label) parts.push(`Vehicle: ${label}`);
    if (price) parts.push(`Price/Offer: ${price}`);
    if (url) parts.push(`Listing URL: ${url}`);
    if (tags) parts.push(`Hashtags: ${tags}`);

    return parts.join("\n");
  }

  function wireModal(launcherId, modalId, closeSelector, onOpen) {
    const launcher = document.getElementById(launcherId);
    const modal = document.getElementById(modalId);
    if (!launcher || !modal) return;

    const closeBtn = modal.querySelector(closeSelector || ".modal-close-btn");
    const backdropClose = (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    };

    launcher.addEventListener("click", () => {
      modal.classList.remove("hidden");
      if (typeof onOpen === "function") {
        onOpen();
      }
    });
    if (closeBtn) {
      closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    }
    modal.addEventListener("click", backdropClose);
  }

  wireModal("objectionLauncher", "objectionModal", ".modal-close-btn");
  wireModal("calcLauncher", "calcModal", ".modal-close-btn");
  wireModal("paymentLauncher", "paymentModal", ".modal-close-btn");
  wireModal("incomeLauncher", "incomeModal", ".modal-close-btn");
  wireModal("workflowLauncher", "workflowModal", ".modal-close-btn");
  wireModal("messageLauncher", "messageModal", ".modal-close-btn");
  wireModal("askLauncher", "askModal", ".modal-close-btn");
  wireModal("carLauncher", "carModal", ".modal-close-btn");
  wireModal("imageLauncher", "imageModal", ".modal-close-btn");

  // VIDEO: when opening, pre-fill context field (if present) with kit info
  wireModal(
    "videoLauncher",
    "videoModal",
    ".modal-close-btn",
    () => {
      if (videoContextField) {
        videoContextField.value = buildVideoContextFromKit();
      }
    }
  );

  // ---------- Payment helper ----------
  const paymentForm = document.getElementById("paymentForm");
  const paymentOutput = document.getElementById("paymentOutput");
  if (paymentForm) {
    paymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(paymentForm);
      const payload = {
        price: fd.get("price"),
        down: fd.get("down"),
        rate: fd.get("rate"),
        term: fd.get("term"),
        tax: fd.get("tax"),
      };

      try {
        const res = await fetch(apiBase + "/api/payment-helper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg =
            (data && data.message) || `Error (HTTP ${res.status}) calculating payment.`;
          throw new Error(msg);
        }
        if (paymentOutput) paymentOutput.textContent = data.result || "";
      } catch (err) {
        console.error("❌ payment-helper error", err);
        if (paymentOutput)
          paymentOutput.textContent =
            err && err.message
              ? err.message
              : "Could not calculate payment. Check numbers and try again.";
      }
    });
  }

  // ---------- Income helper ----------
  const incomeForm = document.getElementById("incomeForm");
  const incomeOutput = document.getElementById("incomeOutput");
  if (incomeForm) {
    incomeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(incomeForm);
      const payload = {
        payment: fd.get("payment"),
        dti: fd.get("dti"),
      };

      try {
        const res = await fetch(apiBase + "/api/income-helper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg =
            (data && data.message) || `Error (HTTP ${res.status}) estimating income.`;
          throw new Error(msg);
        }
        if (incomeOutput) incomeOutput.textContent = data.result || "";
      } catch (err) {
        console.error("❌ income-helper error", err);
        if (incomeOutput)
          incomeOutput.textContent =
            err && err.message
              ? err.message
              : "Could not estimate income. Check numbers and try again.";
      }
    });
  }

  // ---------- Objection coach ----------
  const objectionForm = document.getElementById("objectionForm");
  const objectionOutput = document.getElementById("objectionOutput");
  if (objectionForm) {
    objectionForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(objectionForm);
      const payload = {
        objection: fd.get("objection") || "",
        history: fd.get("history") || "",
      };

      try {
        const res = await fetch(apiBase + "/api/objection-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg =
            (data && data.message) || `Error (HTTP ${res.status}) from objection coach.`;
          throw new Error(msg);
        }
        if (objectionOutput) objectionOutput.value = data.answer || "";
      } catch (err) {
        console.error("❌ objection-coach error", err);
        if (objectionOutput)
          objectionOutput.value =
            err && err.message
              ? err.message
              : "Lot Rocket couldn't coach that objection right now. Try again in a bit.";
      }
    });
  }

  // ---------- AI Message / Workflow / Ask / Car / Image / Video ----------
  function wireMessageHelper(formId, outputId, mode) {
    const form = document.getElementById(formId);
    const output = document.getElementById(outputId);
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = { mode };

      fd.forEach((value, key) => {
        payload[key] = value;
      });

      try {
        const res = await fetch(apiBase + "/api/message-helper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
          const msg =
            (data && data.message) || `Message helper error (HTTP ${res.status}).`;
          console.error("❌ message-helper backend error:", res.status, data);
          if (output) output.value = msg;
          return;
        }

        if (output) output.value = data.text || "";
      } catch (err) {
        console.error("❌ message-helper network error", err);
        if (output)
          output.value = "Lot Rocket hit a snag talking to AI. Try again in a moment.";
      }
    });
  }

  wireMessageHelper("workflowForm", "workflowOutput", "workflow");
  wireMessageHelper("messageForm", "messageOutput", "message");
  wireMessageHelper("askForm", "askOutput", "ask");
  wireMessageHelper("carForm", "carOutput", "car");
  wireMessageHelper("imageForm", "imageOutput", "image-brief");
// --------- VIDEO SHOT PLAN + SCRIPT (custom parsing) ---------
const videoFormEl = document.getElementById("videoForm");
const videoScriptOutput = document.getElementById("videoScriptOutput");
const videoShotListOutput = document.getElementById("videoShotListOutput");
const videoAIPromptOutput = document.getElementById("videoAIPromptOutput");
const videoThumbPromptOutput = document.getElementById("videoThumbPromptOutput");

// bottom copies under Design Studio
const videoScriptOutputBottom = document.getElementById("videoScriptOutputBottom");
const videoShotListOutputBottom = document.getElementById("videoShotListOutputBottom");
const videoAIPromptOutputBottom = document.getElementById("videoAIPromptOutputBottom");
const videoThumbPromptOutputBottom = document.getElementById("videoThumbPromptOutputBottom");

function populateVideoOutputs(sections) {
  if (!sections) return;

  const { script, shots, aiPrompt, thumbPrompt } = sections;

  // Right-side modal fields
  if (videoScriptOutput) videoScriptOutput.value = script || "";
  if (videoShotListOutput) videoShotListOutput.value = shots || "";
  if (videoAIPromptOutput) videoAIPromptOutput.value = aiPrompt || "";
  if (videoThumbPromptOutput) videoThumbPromptOutput.value = thumbPrompt || "";

  // Bottom (main page) fields
  if (videoScriptOutputBottom) videoScriptOutputBottom.value = script || "";
  if (videoShotListOutputBottom) videoShotListOutputBottom.value = shots || "";
  if (videoAIPromptOutputBottom) videoAIPromptOutputBottom.value = aiPrompt || "";
  if (videoThumbPromptOutputBottom) videoThumbPromptOutputBottom.value = thumbPrompt || "";
}

function parseVideoSections(full) {
  if (!full) {
    return { script: "", shots: "", aiPrompt: "", thumbPrompt: "" };
  }

  const h1 = "### 1. Video Script";
  const h2 = "### 2. Shot List";
  const h3 = "### 3. AI Video Generator Prompt";
  const h4 = "### 4. Thumbnail Prompt";

  function getSection(thisHeading, nextHeading) {
    const start = full.indexOf(thisHeading);
    if (start === -1) return "";
    let end = full.length;

    if (nextHeading) {
      const idx = full.indexOf(nextHeading, start + thisHeading.length);
      if (idx !== -1) end = idx;
    }

    return full.slice(start + thisHeading.length, end).trim();
  }

  return {
    script: getSection(h1, h2),
    shots: getSection(h2, h3),
    aiPrompt: getSection(h3, h4),
    thumbPrompt: getSection(h4),
  };
}

if (videoFormEl) {
  videoFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(videoFormEl);
    const payload = { mode: "video-brief" };

    fd.forEach((value, key) => {
      payload[key] = value;
    });

    try {
      const res = await fetch(apiBase + "/api/message-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const fullText = data.text || "";

      const sections = parseVideoSections(fullText);
      populateVideoOutputs(sections);
    } catch (err) {
      console.error("Video brief error", err);
    }
  });
}


// =========================
// ALSO UPDATE BOTTOM OUTPUTS
// =========================
if (videoScriptOutputBottom) videoScriptOutputBottom.value = script || "";
if (videoShotListOutputBottom) videoShotListOutputBottom.value = shots || "";
if (videoAIPromptOutputBottom) videoAIPromptOutputBottom.value = aiPrompt || "";
if (videoThumbPromptOutputBottom) videoThumbPromptOutputBottom.value = thumbPrompt || "";

/**
 * Given the full markdown text from AI, split it into:
 *  1. Script
 *  2. Shot list
 *  3. AI video generator prompt
 *  4. Thumbnail prompt
 */
function parseVideoSections(full) {
  if (!full || typeof full !== "string") {
    return { script: "", shots: "", aiPrompt: "", thumbPrompt: "" };
  }

  // Headings we told AI to use in /api/message-helper
  const h1 = "### 1. Video Script";
  const h2 = "### 2. Shot List";
  const h3 = "### 3. AI Video Generator Prompt";
  const h4 = "### 4. Thumbnail Prompt";

  function getSection(text, startMarker, endMarker) {
    const startIdx = text.indexOf(startMarker);
    if (startIdx === -1) return "";
    const fromStart = text.slice(startIdx + startMarker.length);

    if (!endMarker) {
      return fromStart.trim();
    }

    const endIdx = fromStart.indexOf(endMarker);
    if (endIdx === -1) {
      return fromStart.trim();
    }

    return fromStart.slice(0, endIdx).trim();
  }

  return {
    script: getSection(full, h1, h2),
    shots: getSection(full, h2, h3),
    aiPrompt: getSection(full, h3, h4),
    thumbPrompt: getSection(full, h4, null),
  };
}

/**
 * Custom submit wiring for the Video Shot Plan builder.
 * Calls /api/message-helper with mode="video-brief",
 * then parses and fills all four output boxes.
 */
if (
  videoFormEl &&
  videoScriptOutput &&
  videoShotListOutput &&
  videoAIPromptOutput &&
  videoThumbPromptOutput
) {
  videoFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = videoFormEl.querySelector("button[type='submit']");
    const originalLabel = submitBtn ? submitBtn.textContent : "";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Building plan…";
    }

    try {
      const fd = new FormData(videoFormEl);
      const payload = { mode: "video-brief" };

      fd.forEach((value, key) => {
        payload[key] = value;
      });

      const res = await fetch(apiBase + "/api/message-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          (data && data.message) ||
          `Video builder error (HTTP ${res.status}).`;
        console.error("❌ /api/message-helper (video) error:", res.status, data);
        alert(msg);
        return;
      }

      const full = data.text || "";
      const parsed = parseVideoSections(full);
      populateVideoOutputs(parsed);
    } catch (err) {
      console.error("❌ Video builder network/error:", err);
      alert(
        "Lot Rocket hit a snag building that video shot plan. Try again in a moment."
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel || "Build Video Shot Plan";
      }
    }
  });
}



  // ==================================================
  // STEP 3 – CREATIVE HUB (Fabric)
  // ==================================================

  const photoDropZone = document.getElementById("photoDropZone");
  const photoFileInput = document.getElementById("photoFileInput");
  const creativeThumbGrid = document.getElementById("creativeThumbGrid");
  const sendAllToCanvasBtn = document.getElementById("sendAllToCanvas");
  const sendToDesignStudioBtn = document.getElementById("sendToDesignStudio");

  const tunerPreviewImg = document.getElementById("tunerPreviewImg");
  const tunerBrightness = document.getElementById("tunerBrightness");
  const tunerContrast = document.getElementById("tunerContrast");
  const tunerSaturation = document.getElementById("tunerSaturation");
  const autoEnhanceBtn = document.getElementById("autoEnhanceBtn");

  const creativeStudioOverlay = document.getElementById("creativeStudioOverlay");
  const creativeCloseBtn = document.getElementById("creativeClose");
  const canvasLauncher = document.getElementById("canvasLauncher");

  const canvasPresetSelect = document.getElementById("creativeCanvasPreset");
  const creativeUndo = document.getElementById("creativeUndo");
  const creativeRedo = document.getElementById("creativeRedo");
  const creativeDelete = document.getElementById("creativeDelete");
  const creativeExportPng = document.getElementById("creativeExportPng");
  const creativeImageInput = document.getElementById("creativeImageInput");
  const creativeToolButtons = document.querySelectorAll(".tool-btn");

  let creativeCanvas = null;
  let creativeHistory = [];
  let creativeHistoryIndex = -1;
  let localCreativePhotos = [];

  function ensureCanvas() {
    if (creativeCanvas) return creativeCanvas;
    if (typeof fabric === "undefined") {
      console.error("Fabric.js not loaded");
      return null;
    }
    creativeCanvas = new fabric.Canvas("creativeCanvas", {
      preserveObjectStacking: true,
    });
    saveCanvasState();
    return creativeCanvas;
  }

  function saveCanvasState() {
    if (!creativeCanvas) return;
    const json = creativeCanvas.toJSON();
    creativeHistory = creativeHistory.slice(0, creativeHistoryIndex + 1);
    creativeHistory.push(json);
    creativeHistoryIndex = creativeHistory.length - 1;
  }

  function loadCanvasState(index) {
    if (!creativeCanvas) return;
    if (index < 0 || index >= creativeHistory.length) return;
    creativeHistoryIndex = index;
    creativeCanvas.loadFromJSON(creativeHistory[index], () => {
      creativeCanvas.renderAll();
    });
  }

  function addImageFromUrl(url) {
    const canvas = ensureCanvas();
    if (!canvas || !url) return;

    fabric.Image.fromURL(url, (img) => {
      if (!img) {
        console.error("Fabric could not load image:", url);
        return;
      }
      const scale = Math.min(
        canvas.width / (img.width * 1.2),
        canvas.height / (img.height * 1.2),
        1
      );
      img.set({
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: "center",
        originY: "center",
        selectable: true,
      });
      img.scale(scale);
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      saveCanvasState();
    });
  }

  function addRectBanner() {
    const canvas = ensureCanvas();
    if (!canvas) return;
    const rect = new fabric.Rect({
      left: canvas.width / 2,
      top: canvas.height - 120,
      originX: "center",
      originY: "center",
      width: canvas.width * 0.9,
      height: 160,
      fill: "#000000",
      opacity: 0.75,
      rx: 16,
      ry: 16,
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
    saveCanvasState();
  }

  function addBadge() {
    const canvas = ensureCanvas();
    if (!canvas) return;
    const circle = new fabric.Circle({
      radius: 130,
      fill: "#ff0000",
      left: canvas.width - 220,
      top: 80,
      originX: "center",
      originY: "center",
    });
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
    saveCanvasState();
  }

  function addTextBox() {
    const canvas = ensureCanvas();
    if (!canvas) return;
    const text = new fabric.Textbox("YOUR TEXT HERE", {
      left: canvas.width / 2,
      top: 150,
      originX: "center",
      originY: "center",
      fill: "#ffffff",
      fontSize: 64,
      fontWeight: "bold",
      textAlign: "center",
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    saveCanvasState();
  }

  function openCreativeStudio() {
    if (!creativeStudioOverlay) return;
    creativeStudioOverlay.classList.remove("hidden");
    ensureCanvas();
  }

  function closeCreativeStudio() {
    if (!creativeStudioOverlay) return;
    creativeStudioOverlay.classList.add("hidden");
  }

  if (canvasLauncher) {
    canvasLauncher.addEventListener("click", openCreativeStudio);
  }
  if (creativeCloseBtn && creativeStudioOverlay) {
    creativeCloseBtn.addEventListener("click", closeCreativeStudio);
    creativeStudioOverlay.addEventListener("click", (e) => {
      if (e.target === creativeStudioOverlay) closeCreativeStudio();
    });
  }

  if (canvasPresetSelect) {
    canvasPresetSelect.addEventListener("change", () => {
      const canvas = ensureCanvas();
      if (!canvas) return;
      const [w, h] = canvasPresetSelect.value.split("x").map(Number);
      canvas.setWidth(w);
      canvas.setHeight(h);
      canvas.calcOffset();
      canvas.renderAll();
      saveCanvasState();
    });
  }

  if (creativeUndo) {
    creativeUndo.addEventListener("click", () => {
      if (creativeHistoryIndex > 0) {
        loadCanvasState(creativeHistoryIndex - 1);
      }
    });
  }
  if (creativeRedo) {
    creativeRedo.addEventListener("click", () => {
      if (creativeHistoryIndex < creativeHistory.length - 1) {
        loadCanvasState(creativeHistoryIndex + 1);
      }
    });
  }
  if (creativeDelete) {
    creativeDelete.addEventListener("click", () => {
      if (!creativeCanvas) return;
      const active = creativeCanvas.getActiveObject();
      if (!active) return;
      creativeCanvas.remove(active);
      creativeCanvas.discardActiveObject();
      creativeCanvas.renderAll();
      saveCanvasState();
    });
  }
  if (creativeExportPng) {
    creativeExportPng.addEventListener("click", () => {
      const canvas = ensureCanvas();
      if (!canvas) return;
      try {
        const dataUrl = canvas.toDataURL({ format: "png", quality: 1.0 });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "lot-rocket-creative.png";
        a.click();
      } catch (err) {
        console.error("Export PNG error (likely CORS):", err);
        alert(
          "Browser blocked exporting this image (CORS). Export may be limited on some dealer images."
        );
      }
    });
  }

  if (creativeToolButtons.length) {
    creativeToolButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-tool");
        if (!tool) return;

        creativeToolButtons.forEach((b) =>
          b.classList.remove("tool-btn-active")
        );
        btn.classList.add("tool-btn-active");

        if (tool === "select") {
          if (creativeCanvas) creativeCanvas.isDrawingMode = false;
        } else if (tool === "addText") {
          addTextBox();
        } else if (tool === "addRect") {
          addRectBanner();
        } else if (tool === "addBadge") {
          addBadge();
        } else if (tool === "uploadImage" && creativeImageInput) {
          creativeImageInput.click();
        }
      });
    });
  }

  if (creativeImageInput) {
    creativeImageInput.addEventListener("change", (e) => {
      const files = e.target.files;
      if (!files || !files.length) return;
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        const url = URL.createObjectURL(file);
        localCreativePhotos.push(url);
        addCreativeThumb(url);
      });
      creativeImageInput.value = "";
    });
  }

  // ---- Photo tuner ----
  function applyTunerFilters() {
    if (!tunerPreviewImg) return;
    const b = tunerBrightness ? Number(tunerBrightness.value || 100) : 100;
    const c = tunerContrast ? Number(tunerContrast.value || 100) : 100;
    const s = tunerSaturation ? Number(tunerSaturation.value || 100) : 100;
    tunerPreviewImg.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  }

  if (tunerBrightness) {
    tunerBrightness.addEventListener("input", applyTunerFilters);
  }
  if (tunerContrast) {
    tunerContrast.addEventListener("input", applyTunerFilters);
  }
  if (tunerSaturation) {
    tunerSaturation.addEventListener("input", applyTunerFilters);
  }
  if (autoEnhanceBtn) {
    autoEnhanceBtn.addEventListener("click", () => {
      if (tunerBrightness) tunerBrightness.value = "115";
      if (tunerContrast) tunerContrast.value = "115";
      if (tunerSaturation) tunerSaturation.value = "120";
      applyTunerFilters();
    });
  }

  // ---- Thumbnails + drag/drop ----
  function addCreativeThumb(url) {
    if (!creativeThumbGrid) return;
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Creative photo";
    img.loading = "lazy";
    img.className = "creative-thumb";

    img.addEventListener("click", () => {
      document
        .querySelectorAll(".creative-thumb.selected")
        .forEach((el) => el.classList.remove("selected"));
      img.classList.add("selected");
      if (tunerPreviewImg) tunerPreviewImg.src = url;
      applyTunerFilters();
    });

    creativeThumbGrid.appendChild(img);
  }

  function handleCreativeFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    files.forEach((file) => {
      if (!file || !file.type || !file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      localCreativePhotos.push(url);
      addCreativeThumb(url);

      if (tunerPreviewImg && !tunerPreviewImg.src) {
        tunerPreviewImg.src = url;
        applyTunerFilters();
      }
    });
  }

  if (photoDropZone && photoFileInput) {
    photoDropZone.addEventListener("click", () => {
      photoFileInput.click();
    });

    photoFileInput.addEventListener("change", (e) => {
      handleCreativeFiles(e.target.files);
      photoFileInput.value = "";
    });

    ["dragenter", "dragover"].forEach((evtName) => {
      photoDropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDropZone.classList.add("dragover");
      });
    });

    ["dragleave", "dragend"].forEach((evtName) => {
      photoDropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDropZone.classList.remove("dragover");
      });
    });

    photoDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      photoDropZone.classList.remove("dragover");

      const dt = e.dataTransfer;
      let files = dt && dt.files;

      if ((!files || !files.length) && dt && dt.items) {
        const collected = [];
        for (const item of dt.items) {
          if (item.kind === "file") {
            const f = item.getAsFile();
            if (f) collected.push(f);
          }
        }
        files = collected;
      }

      if (!files || !files.length) return;
      handleCreativeFiles(files);
    });
  }

  // ---- Shared helper: gather image URLs for studios ----
  function gatherImageUrlsForStudios() {
    const urls = [];

    if (creativeThumbGrid) {
      creativeThumbGrid.querySelectorAll("img").forEach((img) => {
        if (img.src) urls.push(img.src);
      });
    }

    if (!urls.length && dealerPhotos.length) {
      const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
      const fallback = dealerPhotos.map((p) => p.src);
      (selected.length ? selected : fallback).forEach((u) => urls.push(u));
    }

    return urls.slice(0, 8); // cap at 8
  }

  // ==================================================
  // DESIGN STUDIO 3.0 (Konva)
  // ==================================================

  const designStudioOverlay = document.getElementById("designStudioOverlay");
  const designLauncher = document.getElementById("designLauncher");
  const designCloseBtn = document.getElementById("designClose");

  const studioSizePreset = document.getElementById("studioSizePreset");
  const studioUndoBtn = document.getElementById("studioUndoBtn");
  const studioRedoBtn = document.getElementById("studioRedoBtn");
  const studioExportPng = document.getElementById("studioExportPng");

  const toolAddText = document.getElementById("toolAddText");
  const toolAddShape = document.getElementById("toolAddShape");
  const toolAddBadge = document.getElementById("toolAddBadge");
  const toolSetBackground = document.getElementById("toolSetBackground");

  const layersList = document.getElementById("layersList");
  const layerTextInput = document.getElementById("layerTextInput");
  const layerFontSizeInput = document.getElementById("layerFontSizeInput");
  const layerOpacityInput = document.getElementById("layerOpacityInput");
  const layerDeleteBtn = document.getElementById("layerDeleteBtn");

  let studioStage = null;
  let studioLayer = null;
  let studioSelectedNode = null;
  let studioHistory = [];
  let studioHistoryIndex = -1;

  function initDesignStudio() {
    if (!window.Konva) {
      console.warn("Konva not loaded – Design Studio 3.0 disabled.");
      return;
    }
    const container = document.getElementById("konvaStageContainer");
    if (!container) {
      console.warn("konvaStageContainer not found.");
      return;
    }

    // Use fixed logical canvas size; CSS handles visual sizing.
    const width = 1080;
    const height = 1080;

    studioStage = new Konva.Stage({
      container: "konvaStageContainer",
      width,
      height,
    });

    studioLayer = new Konva.Layer();
    studioStage.add(studioLayer);

    setStudioBackground("#111111");
    wireDesignStudioUI();
    saveStudioHistory();
  }

  // ---- History ----
  function saveStudioHistory() {
    if (!studioStage) return;
    const json = studioStage.toJSON();
    studioHistory = studioHistory.slice(0, studioHistoryIndex + 1);
    studioHistory.push(json);
    studioHistoryIndex = studioHistory.length - 1;
  }

  function restoreStudioFromHistory(index) {
    if (!studioStage || index < 0 || index >= studioHistory.length) return;
    const container = studioStage.container();
    const json = studioHistory[index];

    studioHistoryIndex = index;
    studioStage.destroy();
    studioStage = Konva.Node.create(json, container);
    const layers = studioStage.getLayers();
    studioLayer = layers[0] || new Konva.Layer();
    if (!layers.length) studioStage.add(studioLayer);
    studioSelectedNode = null;
    rebuildLayersList();
  }

  function studioUndo() {
    if (studioHistoryIndex > 0) {
      restoreStudioFromHistory(studioHistoryIndex - 1);
    }
  }

  function studioRedo() {
    if (studioHistoryIndex < studioHistory.length - 1) {
      restoreStudioFromHistory(studioHistoryIndex + 1);
    }
  }

  // ---- Selection / layers ----
  function selectStudioNode(node) {
    studioSelectedNode = node;
    rebuildLayersList();
    syncLayerControlsWithSelection();
  }

  function rebuildLayersList() {
    if (!layersList || !studioLayer) return;
    layersList.innerHTML = "";
    const nodes = studioLayer.getChildren();

    nodes.forEach((node, index) => {
      if (node.name() === "BackgroundLayer") return;
      const li = document.createElement("li");
      li.className = "layer-item";
      li.textContent = `${index + 1} — ${node.name() || node.getClassName()}`;
      if (node === studioSelectedNode) li.classList.add("layer-item-selected");
      li.addEventListener("click", () => {
        selectStudioNode(node);
      });
      layersList.appendChild(li);
    });
  }

  function syncLayerControlsWithSelection() {
    if (!studioSelectedNode) {
      if (layerTextInput) layerTextInput.value = "";
      if (layerFontSizeInput) layerFontSizeInput.value = "";
      if (layerOpacityInput) layerOpacityInput.value = 1;
      return;
    }

    if (studioSelectedNode.className === "Text") {
      if (layerTextInput) layerTextInput.value = studioSelectedNode.text() || "";
      if (layerFontSizeInput)
        layerFontSizeInput.value = studioSelectedNode.fontSize() || 40;
    } else {
      if (layerTextInput) layerTextInput.value = "";
      if (layerFontSizeInput) layerFontSizeInput.value = "";
    }

    if (layerOpacityInput) {
      layerOpacityInput.value = studioSelectedNode.opacity() ?? 1;
    }
  }

  function attachNodeInteractions(node) {
    node.on("click tap", () => {
      selectStudioNode(node);
    });
    node.on("dragend transformend", () => {
      saveStudioHistory();
    });
  }

  // ---- Add elements ----
  function addStudioText(text = "YOUR HEADLINE HERE") {
    if (!studioLayer || !studioStage) return;

    const node = new Konva.Text({
      x: studioStage.width() / 2,
      y: 120,
      text,
      fontFamily: "system-ui, sans-serif",
      fontSize: 48,
      fill: "#FFFFFF",
      shadowColor: "black",
      shadowBlur: 6,
      shadowOffset: { x: 2, y: 2 },
      shadowOpacity: 0.4,
      align: "center",
      name: "Text Layer",
      draggable: true,
    });

    node.offsetX(node.width() / 2);

    attachNodeInteractions(node);
    studioLayer.add(node);
    studioLayer.draw();
    selectStudioNode(node);
    saveStudioHistory();
  }

  function addStudioShape() {
    if (!studioLayer || !studioStage) return;
    const width = studioStage.width() * 0.9;
    const height = 170;

    const node = new Konva.Rect({
      x: studioStage.width() / 2,
      y: studioStage.height() - height,
      width,
      height,
      fill: "#000000",
      opacity: 0.7,
      cornerRadius: 18,
      offsetX: width / 2,
      offsetY: height / 2,
      name: "Banner Layer",
      draggable: true,
    });

    attachNodeInteractions(node);
    studioLayer.add(node);
    studioLayer.draw();
    selectStudioNode(node);
    saveStudioHistory();
  }

  function addStudioBadge() {
    if (!studioLayer || !studioStage) return;

    const node = new Konva.Ring({
      x: studioStage.width() - 180,
      y: 160,
      innerRadius: 70,
      outerRadius: 90,
      fill: "#FFFFFF",
      stroke: "#FF2E2E",
      strokeWidth: 6,
      name: "Badge Layer",
      draggable: true,
    });

    attachNodeInteractions(node);
    studioLayer.add(node);
    studioLayer.draw();
    selectStudioNode(node);
    saveStudioHistory();
  }

  function setStudioBackground(color = "#111111") {
    if (!studioLayer || !studioStage) return;
    let bg = studioLayer.findOne(".BackgroundLayer");
    if (!bg) {
      bg = new Konva.Rect({
        x: 0,
        y: 0,
        width: studioStage.width(),
        height: studioStage.height(),
        fill: color,
        name: "BackgroundLayer",
        listening: false,
      });
      studioLayer.add(bg);
      bg.moveToBottom();
    } else {
      bg.fill(color);
      bg.width(studioStage.width());
      bg.height(studioStage.height());
      bg.moveToBottom();
    }
    studioLayer.draw();
  }

  function addStudioImageFromUrl(url, asBackground = false) {
    if (!studioLayer || !studioStage || !url) return;

    const img = new Image();
  img.onload = () => {
    // Fit image to stage, then shrink a bit so it isn't edge-to-edge
    const fitRatio =
      Math.min(
        studioStage.width() / img.width,
        studioStage.height() / img.height
      ) || 1;

    const finalRatio = fitRatio * 0.9; // 0.9 = 90% of full size; tweak if you want

    const w = img.width * finalRatio;
    const h = img.height * finalRatio;


      const node = new Konva.Image({
        image: img,
        x: studioStage.width() / 2,
        y: studioStage.height() / 2,
        width: w,
        height: h,
        offsetX: w / 2,
        offsetY: h / 2,
        draggable: !asBackground,
        name: asBackground ? "Background Photo" : "Photo Layer",
      });

      attachNodeInteractions(node);
      studioLayer.add(node);
      if (asBackground) {
        node.moveToBottom();
        const bg = studioLayer.findOne(".BackgroundLayer");
        if (bg) bg.moveToBottom();
      }
      studioLayer.draw();
      selectStudioNode(node);
      saveStudioHistory();
    };
    img.onerror = (err) => {
      console.error("[DesignStudio] Failed to load image:", url, err);
    };
    img.src = url;
  }

  function exportStudioAsPng() {
    if (!studioStage) return;
    const dataURL = studioStage.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = "lot-rocket-design.png";
    a.click();
  }

  function applyStudioSizePreset() {
    if (!studioStage || !studioLayer || !studioSizePreset) return;
    const [w, h] = studioSizePreset.value.split("x").map(Number);
    studioStage.width(w);
    studioStage.height(h);

    const bg = studioLayer.findOne(".BackgroundLayer");
    if (bg) {
      bg.width(w);
      bg.height(h);
      bg.moveToBottom();
    }

    studioStage.draw();
    saveStudioHistory();
  }

  function wireDesignStudioUI() {
    if (toolAddText) {
      toolAddText.addEventListener("click", () => addStudioText());
    }
    if (toolAddShape) {
      toolAddShape.addEventListener("click", () => addStudioShape());
    }
    if (toolAddBadge) {
      toolAddBadge.addEventListener("click", () => addStudioBadge());
    }
    if (toolSetBackground) {
      toolSetBackground.addEventListener("click", () =>
        setStudioBackground("#111111")
      );
    }

    if (studioExportPng) {
      studioExportPng.addEventListener("click", exportStudioAsPng);
    }
    if (studioUndoBtn) {
      studioUndoBtn.addEventListener("click", studioUndo);
    }
    if (studioRedoBtn) {
      studioRedoBtn.addEventListener("click", studioRedo);
    }
    if (studioSizePreset) {
      studioSizePreset.addEventListener("change", applyStudioSizePreset);
    }

    if (layerTextInput) {
      layerTextInput.addEventListener("input", () => {
        if (studioSelectedNode && studioSelectedNode.className === "Text") {
          studioSelectedNode.text(layerTextInput.value);
          studioLayer.batchDraw();
          saveStudioHistory();
        }
      });
    }

    if (layerFontSizeInput) {
      layerFontSizeInput.addEventListener("input", () => {
        if (studioSelectedNode && studioSelectedNode.className === "Text") {
          const size = Number(layerFontSizeInput.value) || 40;
          studioSelectedNode.fontSize(size);
          studioLayer.batchDraw();
          saveStudioHistory();
        }
      });
    }

    if (layerOpacityInput) {
      layerOpacityInput.addEventListener("input", () => {
        if (studioSelectedNode) {
          const val = Number(layerOpacityInput.value);
          studioSelectedNode.opacity(val);
          studioLayer.batchDraw();
          saveStudioHistory();
        }
      });
    }

    if (layerDeleteBtn) {
      layerDeleteBtn.addEventListener("click", () => {
        if (!studioSelectedNode || !studioLayer) return;
        studioSelectedNode.destroy();
        studioSelectedNode = null;
        studioLayer.draw();
        rebuildLayersList();
        saveStudioHistory();
      });
    }
  }

  function openDesignStudio() {
    if (!designStudioOverlay) return;
    designStudioOverlay.classList.remove("hidden");
    if (!studioStage && window.Konva) {
      initDesignStudio();
    } else if (studioStage) {
      studioStage.draw();
      rebuildLayersList();
    }
  }

  function closeDesignStudio() {
    if (!designStudioOverlay) return;
    designStudioOverlay.classList.add("hidden");
  }

  if (designLauncher) {
    designLauncher.addEventListener("click", openDesignStudio);
  }
  if (designCloseBtn && designStudioOverlay) {
    designCloseBtn.addEventListener("click", closeDesignStudio);
    designStudioOverlay.addEventListener("click", (e) => {
      if (e.target === designStudioOverlay) closeDesignStudio();
    });
  }

  // ---- Shared wiring from Step 1 / Step 3 into Design Studio ----

  function pushUrlsIntoDesignStudio(urls) {
    if (!urls.length) {
      alert("No photos available. Boost a listing or add photos first.");
      return;
    }
    openDesignStudio();
    urls.forEach((url, index) => {
      addStudioImageFromUrl(url, index === 0); // first is background
    });
  }

  // Step 1 button – “Send top photos to Creative Studio” (and Design Studio)
  if (sendPhotosToStudioBtn) {
    sendPhotosToStudioBtn.addEventListener("click", () => {
      if (!dealerPhotos.length) {
        alert("Boost a listing first so Lot Rocket can grab photos.");
        return;
      }

      const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
      const chosen = (selected.length ? selected : dealerPhotos.map((p) => p.src))
        .slice(0, 8);

      if (!chosen.length) {
        alert("No photos selected.");
        return;
      }

      // Push into Creative Hub thumbnails
      chosen.forEach((url) => {
        localCreativePhotos.push(url);
        addCreativeThumb(url);
        if (tunerPreviewImg && !tunerPreviewImg.src) {
          tunerPreviewImg.src = url;
          applyTunerFilters();
        }
      });

      // ALSO push into Design Studio
      pushUrlsIntoDesignStudio(chosen);
    });
  }

  // Step 3 button – “Send to Design Studio 3.0”
  if (sendToDesignStudioBtn) {
    sendToDesignStudioBtn.addEventListener("click", () => {
      const urls = gatherImageUrlsForStudios();
      if (!urls.length) {
        alert("Add or select some photos first.");
        return;
      }
      pushUrlsIntoDesignStudio(urls);
    });
  }

  // “Send All to Canvas Studio” stays Fabric-only
  if (sendAllToCanvasBtn) {
    sendAllToCanvasBtn.addEventListener("click", () => {
      const urls = gatherImageUrlsForStudios();
      if (!urls.length) {
        alert("Add or select some photos first.");
        return;
      }
      openCreativeStudio();
      urls.forEach((url) => addImageFromUrl(url));
    });
  }

  console.log("✅ Lot Rocket frontend wiring complete");
});
