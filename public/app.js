// public/app.js – Lot Rocket frontend logic v2.5.6
// Stable: theme toggle, Boost, calculators, side tools.
// Step 3: Creative Hub (Fabric) + Design Studio 3.5 (Konva) + Social Strip.

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Lot Rocket frontend loaded v2.5.6");
  const apiBase = "";

  // Brand palette for Design Studio 3.5
  const BRAND = {
    primary: "#f97316", // accent-1
    secondary: "#ec4899", // accent-2
    dark: "#020617",
    light: "#f9fafb",
    textLight: "#f9fafb",
    textDark: "#020617",
  };

  const STUDIO_STORAGE_KEY = "lotRocketDesignStudio";

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
    if (statusText)
      statusText.textContent = "Scraping dealer page and building kit…";

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
          case "facebook":
            targetId = "facebookPost";
            break;
          case "instagram":
            targetId = "instagramPost";
            break;
          case "tiktok":
            targetId = "tiktokPost";
            break;
          case "linkedin":
            targetId = "linkedinPost";
            break;
          case "twitter":
            targetId = "twitterPost";
            break;
          case "text":
            targetId = "textBlurb";
            break;
          case "marketplace":
            targetId = "marketplacePost";
            break;
          case "hashtags":
            targetId = "hashtags";
            break;
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
  wireModal("videoLauncher", "videoModal", ".modal-close-btn", () => {
    if (videoContextField) {
      videoContextField.value = buildVideoContextFromKit();
    }
  });

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
            (data && data.message) ||
            `Error (HTTP ${res.status}) calculating payment.`;
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
            (data && data.message) ||
            `Error (HTTP ${res.status}) estimating income.`;
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
            (data && data.message) ||
            `Error (HTTP ${res.status}) from objection coach.`;
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

  // ---------- AI Message / Workflow / Ask / Car / Image ----------
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
            (data && data.message) ||
            `Message helper error (HTTP ${res.status}).`;
          console.error("❌ message-helper backend error:", res.status, data);
          if (output) output.value = msg;
          return;
        }

        if (output) output.value = data.text || "";
      } catch (err) {
        console.error("❌ message-helper network error", err);
        if (output)
          output.value =
            "Lot Rocket hit a snag talking to AI. Try again in a moment.";
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
  const videoThumbPromptOutput = document.getElementById(
    "videoThumbPromptOutput"
  );

  // bottom copies under Design Studio
  const videoScriptOutputBottom = document.getElementById(
    "videoScriptOutputBottom"
  );
  const videoShotListOutputBottom = document.getElementById(
    "videoShotListOutputBottom"
  );
  const videoAIPromptOutputBottom = document.getElementById(
    "videoAIPromptOutputBottom"
  );
  const videoThumbPromptOutputBottom = document.getElementById(
    "videoThumbPromptOutputBottom"
  );

  function populateVideoOutputs(sections) {
    if (!sections) return;

    const {
      script = "",
      shots = "",
      aiPrompt = "",
      thumbPrompt = "",
    } = sections;

    // Right-side modal
    if (videoScriptOutput) videoScriptOutput.value = script;
    if (videoShotListOutput) videoShotListOutput.value = shots;
    if (videoAIPromptOutput) videoAIPromptOutput.value = aiPrompt;
    if (videoThumbPromptOutput) videoThumbPromptOutput.value = thumbPrompt;

    // Bottom under Design Studio
    if (videoScriptOutputBottom) videoScriptOutputBottom.value = script;
    if (videoShotListOutputBottom) videoShotListOutputBottom.value = shots;
    if (videoAIPromptOutputBottom) videoAIPromptOutputBottom.value = aiPrompt;
    if (videoThumbPromptOutputBottom)
      videoThumbPromptOutputBottom.value = thumbPrompt;
  }

  function parseVideoSections(full) {
    if (!full || typeof full !== "string") {
      return { script: "", shots: "", aiPrompt: "", thumbPrompt: "" };
    }

    const h1 = "### 1. Video Script";
    const h2 = "### 2. Shot List";
    const h3 = "### 3. AI Video Generator Prompt";
    const h4 = "### 4. Thumbnail Prompt";

    function getSection(startMarker, endMarker) {
      const startIdx = full.indexOf(startMarker);
      if (startIdx === -1) return "";
      const fromStart = full.slice(startIdx + startMarker.length);

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
      script: getSection(h1, h2),
      shots: getSection(h2, h3),
      aiPrompt: getSection(h3, h4),
      thumbPrompt: getSection(h4, null),
    };
  }

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
          console.error(
            "❌ /api/message-helper (video) error:",
            res.status,
            data
          );
          alert(msg);
          return;
        }

        const full = data.text || "";
        const sections = parseVideoSections(full);
        populateVideoOutputs(sections);
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
  // STEP 3 – CREATIVE HUB (Fabric) + SOCIAL STRIP
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

  // Hidden canvas used to bake tuner edits into real pixels
  const hiddenTunerCanvas = document.createElement("canvas");
  const hiddenTunerCtx = hiddenTunerCanvas.getContext
    ? hiddenTunerCanvas.getContext("2d")
    : null;

  // Current filter used by both CSS preview and canvas drawing
  let currentTunerFilter = "";

  // NEW: Social-ready photo strip elements
  const socialCarousel = document.getElementById("socialCarousel");
  const openDesignFromCarouselBtn = document.getElementById(
    "openDesignFromCarousel"
  );
  const downloadAllEditedBtn = document.getElementById("downloadAllEditedBtn");

  const creativeStudioOverlay = document.getElementById(
    "creativeStudioOverlay"
  );
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

  // NEW: Social-ready photos state: [{ url, selected }]
  let socialReadyPhotos = [];

  // ---------------- PHOTO TUNER ----------------

  function applyTunerFilters() {
    if (!tunerPreviewImg) return;

    const b = tunerBrightness ? Number(tunerBrightness.value || 100) : 100;
    const c = tunerContrast ? Number(tunerContrast.value || 100) : 100;
    const s = tunerSaturation ? Number(tunerSaturation.value || 100) : 100;

    currentTunerFilter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    tunerPreviewImg.style.filter = currentTunerFilter;
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

  // ---------------- FABRIC CANVAS (Creative Studio) ----------------

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

  // ---------------- CREATIVE THUMBS + TUNER + SOCIAL STRIP ----------------

  if (creativeImageInput) {
    creativeImageInput.addEventListener("change", (e) => {
      const files = e.target.files;
      if (!files || !files.length) return;
      handleCreativeFiles(files);
      creativeImageInput.value = "";
    });
  }

  function addCreativeThumb(url) {
    if (!creativeThumbGrid) return;

    const img = document.createElement("img");
    img.src = url;
    img.alt = "Creative photo";
    img.loading = "lazy";
    img.className = "creative-thumb";

    // Single click – load into tuner + select
    img.addEventListener("click", () => {
      document
        .querySelectorAll(".creative-thumb.selected")
        .forEach((el) => el.classList.remove("selected"));

      img.classList.add("selected");

      if (tunerPreviewImg) {
        tunerPreviewImg.src = url;
        applyTunerFilters();
      }
    });

    // Double-click – bake edited JPEG + send to Social Strip
    img.addEventListener("dblclick", async () => {
      const editedUrl = await buildEditedDataUrl(url);
      addPhotoToSocialReady(editedUrl);
    });

    creativeThumbGrid.appendChild(img);
  }

  /**
   * Build a filtered JPEG data URL using a hidden canvas.
   * Used for sending tuned photos to the Social-ready strip.
   */
  async function buildEditedDataUrl(src) {
    if (!src) return src;
    if (!hiddenTunerCanvas || !hiddenTunerCtx) return src;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const maxW = 1920;
        const maxH = 1920;

        let w = img.naturalWidth || img.width || 800;
        let h = img.naturalHeight || img.height || 600;

        const scale = Math.min(1, maxW / w, maxH / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);

        hiddenTunerCanvas.width = w;
        hiddenTunerCanvas.height = h;

        hiddenTunerCtx.clearRect(0, 0, w, h);
        hiddenTunerCtx.filter = currentTunerFilter || "none";
        hiddenTunerCtx.drawImage(img, 0, 0, w, h);

        try {
          const dataUrl = hiddenTunerCanvas.toDataURL("image/jpeg", 0.92);
          resolve(dataUrl);
        } catch (err) {
          console.error("[LotRocket] toDataURL failed:", err);
          resolve(src);
        }
      };

      img.onerror = (err) => {
        console.error("[LotRocket] Failed to load image for tuner:", err);
        resolve(src);
      };

      img.src = src;
    });
  }

  // ---- Social-ready strip helpers ----
  function renderSocialCarousel() {
    if (!socialCarousel) return;
    socialCarousel.innerHTML = "";

    if (!socialReadyPhotos.length) {
      const note = document.createElement("p");
      note.className = "small-note";
      note.textContent =
        "Double-click a photo in the grid above to mark it social-ready.";
      socialCarousel.appendChild(note);
      return;
    }

    socialReadyPhotos.forEach((photo, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "social-carousel-item" +
        (photo.selected ? " social-carousel-item-selected" : "");
      btn.dataset.index = String(index);

      const img = document.createElement("img");
      img.src = photo.url;
      img.alt = `Social-ready photo ${index + 1}`;
      img.loading = "lazy";
      img.className = "social-carousel-img";

      btn.appendChild(img);
      socialCarousel.appendChild(btn);
    });

    socialCarousel
      .querySelectorAll(".social-carousel-item")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.index || "0");
          socialReadyPhotos[idx].selected = !socialReadyPhotos[idx].selected;
          renderSocialCarousel();
        });
      });
  }

  function addPhotoToSocialReady(url) {
    if (!url) return;
    const exists = socialReadyPhotos.some((p) => p.url === url);
    if (exists) {
      socialReadyPhotos = socialReadyPhotos.map((p) =>
        p.url === url ? { ...p, selected: true } : p
      );
    } else {
      socialReadyPhotos.push({ url, selected: true });
    }
    renderSocialCarousel();
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

  // Drag & drop / click upload wiring
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

  // Initial empty strip render
  renderSocialCarousel();

  // ==================================================
  // DESIGN STUDIO 3.5 (Konva + Templates + Save/Load)
  // ==================================================

  // ... (rest of file unchanged — same as I sent in previous message) ...

  console.log("✅ Lot Rocket frontend wiring complete");
});
