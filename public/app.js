// public/app.js – Lot Rocket frontend logic v2.5
// PROTECTED: theme toggle, Boost button wiring, calculator + modal wiring.
// Extensions: selectable dealer photos + Creative Hub drag & drop + Canvas Studio.

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Lot Rocket frontend loaded v2.5");

  const apiBase = "";

  // ---------- THEME TOGGLE ----------
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

  // ======================================================
  // STEP 1 – Dealer URL Scraper + Social Kit (PROTECTED)
  // ======================================================

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
  const sendPhotosToStudioBtn = document.getElementById("sendPhotosToStudio");

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
      // IMPORTANT: match CSS class so they show as thumbnails not full-size
      img.className = "photo-thumb";

      wrapper.appendChild(img);
      photosGrid.appendChild(wrapper);
    });

    // Click to toggle selected / unselected
    photosGrid.querySelectorAll(".photo-thumb-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index || "0");
        if (!Number.isNaN(idx) && dealerPhotos[idx]) {
          dealerPhotos[idx].selected = !dealerPhotos[idx].selected;
          renderDealerPhotos();
        }
      });
    });
  }

  async function doBoostListing() {
    if (!vehicleUrlInput || !boostButton) return;

    const url = vehicleUrlInput.value.trim();
    const labelOverride = (vehicleLabelInput?.value || "").trim();
    const priceOverride = (priceInfoInput?.value || "").trim();

    if (!url) {
      alert("Paste a full dealer URL first.");
      return;
    }

    boostButton.disabled = true;
    if (statusText)
      statusText.textContent = "Scraping dealer page and building kit…";

    console.log("🚀 Boosting listing for URL:", url);

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
          "Something went wrong building the kit.";
        throw new Error(msg);
      }

      console.log("✅ Social kit payload:", data);

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

      // Photos from backend – cap to 40 to avoid insane grids
      const photos = Array.isArray(data.photos) ? data.photos.slice(0, 40) : [];
      dealerPhotos = photos.map((src) => ({ src, selected: false }));
      renderDealerPhotos();

      if (sendPhotosToStudioBtn) {
        sendPhotosToStudioBtn.disabled = dealerPhotos.length === 0;
      }

      // Mark Step 2 visually "kit ready"
      document.body.classList.add("kit-ready");

      if (statusText) statusText.textContent = "Social kit ready ✔";
    } catch (err) {
      console.error("❌ Boost error:", err);
      if (statusText) {
        statusText.textContent =
          (err && err.message) ||
          "Failed to build kit. Try again in a moment.";
      }
    } finally {
      if (boostButton) boostButton.disabled = false;
    }
  }

  if (boostButton) {
    boostButton.addEventListener("click", doBoostListing);
  }

  // ---------- Copy buttons ----------
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-copy-target");
      if (!targetId) return;
      const el = document.getElementById(targetId);
      if (!el) return;

      el.select();
      el.setSelectionRange(0, 99999);
      document.execCommand("copy");

      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = original), 1500);
    });
  });

  // ---------- Regen buttons ----------
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
          (vehicleLabelInput?.value || "").trim() ||
          (summaryLabel?.textContent || "");
        const price =
          (priceInfoInput?.value || "").trim() ||
          (summaryPrice?.textContent || "");

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
        if (!res.ok)
          throw new Error((data && data.message) || "Error generating copy");

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
        console.error("regen error", err);
        alert(
          (err && err.message) ||
            "Failed to generate a new post. Try again."
        );
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });

  // ==========================================
  // MODALS + TOOLS (Objection, Payment, etc.)
  // ==========================================

  function wireModal(launcherId, modalId, closeSelector) {
    const launcher = document.getElementById(launcherId);
    const modal = document.getElementById(modalId);
    if (!launcher || !modal) return;

    const closeBtn = modal.querySelector(closeSelector || ".modal-close-btn");
    const backdropClose = (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    };

    launcher.addEventListener("click", () => {
      modal.classList.remove("hidden");
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
  wireModal("videoLauncher", "videoModal", ".modal-close-btn");

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
        if (!res.ok)
          throw new Error((data && data.message) || "Error calculating");
        if (paymentOutput) paymentOutput.textContent = data.result || "";
      } catch (err) {
        console.error("payment-helper error", err);
        if (paymentOutput)
          paymentOutput.textContent =
            "Could not calculate payment. Check numbers and try again.";
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
        if (!res.ok)
          throw new Error((data && data.message) || "Error estimating");
        if (incomeOutput) incomeOutput.textContent = data.result || "";
      } catch (err) {
        console.error("income-helper error", err);
        if (incomeOutput)
          incomeOutput.textContent =
            "Could not estimate income. Check numbers and try again.";
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
        if (!res.ok)
          throw new Error((data && data.message) || "Error coaching");
        if (objectionOutput) objectionOutput.value = data.answer || "";
      } catch (err) {
        console.error("objection-coach error", err);
        if (objectionOutput)
          objectionOutput.value =
            "Lot Rocket couldn't coach that objection right now. Try again in a bit.";
      }
    });
  }

  // ---------- AI Message / Workflow / Ask / Car / Image / Video helpers ----------
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
        if (!res.ok)
          throw new Error((data && data.message) || "Error talking to AI");
        if (output) output.value = data.text || "";
      } catch (err) {
        console.error("message-helper error", err);
        if (output) output.value =
          "Lot Rocket hit a snag. Try again in a moment.";
      }
    });
  }

  wireMessageHelper("workflowForm", "workflowOutput", "workflow");
  wireMessageHelper("messageForm", "messageOutput", "message");
  wireMessageHelper("askForm", "askOutput", "ask");
  wireMessageHelper("carForm", "carOutput", "car");
  wireMessageHelper("imageForm", "imageOutput", "image-brief");
  wireMessageHelper("videoForm", "videoOutput", "video-brief");

  // ==========================================
  // CREATIVE HUB (STEP 3) + CANVAS STUDIO
  // ==========================================

  const photoDropZone = document.getElementById("photoDropZone");
  const photoFileInput = document.getElementById("photoFileInput");
  const creativeThumbGrid = document.getElementById("creativeThumbGrid");
  const sendAllToCanvasBtn = document.getElementById("sendAllToCanvas");

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
  let currentTool = "select";
  let localCreativePhotos = []; // URLs from drag/drop or file uploads

  // ----- Canvas helpers -----
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
    if (!canvas) return;

    fabric.Image.fromURL(
      url,
      (img) => {
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
      },
      { crossOrigin: "Anonymous" }
    );
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

  // ----- Canvas Studio wiring -----
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
    });
  }

  if (creativeUndo) {
    creativeUndo.addEventListener("click", () => {
      if (!creativeCanvas) return;
      if (creativeHistoryIndex > 0) {
        loadCanvasState(creativeHistoryIndex - 1);
      }
    });
  }
  if (creativeRedo) {
    creativeRedo.addEventListener("click", () => {
      if (!creativeCanvas) return;
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
      const dataUrl = canvas.toDataURL({ format: "png", quality: 1.0 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "lot-rocket-creative.png";
      a.click();
    });
  }

  if (creativeToolButtons.length) {
    creativeToolButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-tool");
        if (!tool) return;
        currentTool = tool;

        creativeToolButtons.forEach((b) =>
          b.classList.remove("tool-btn-active")
        );
        btn.classList.add("tool-btn-active");

        if (!creativeCanvas) return;

        if (tool === "select") {
          creativeCanvas.isDrawingMode = false;
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
        addImageFromUrl(url);
      });
      creativeImageInput.value = "";
    });
  }

  // ----- Drag & Drop + thumbnails in Step 3 -----

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
      if (!file.type.startsWith("image/")) return;
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

    ["dragenter", "dragover"].forEach((evt) => {
      photoDropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDropZone.classList.add("photo-dropzone-active");
      });
    });
    ["dragleave", "dragend", "drop"].forEach((evt) => {
      photoDropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDropZone.classList.remove("photo-dropzone-active");
      });
    });

    // Support dropping files AND URLs (e.g. dragging from Step 1 thumbnails)
    photoDropZone.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      if (!dt) return;

      if (dt.files && dt.files.length) {
        // Files from computer
        handleCreativeFiles(dt.files);
        return;
      }

      // Try to extract an image URL from the drop (text/uri-list or HTML)
      let url = dt.getData("text/uri-list") || "";

      if (!url) {
        const html = dt.getData("text/html");
        if (html) {
          const match = html.match(/src=["']([^"']+)["']/i);
          if (match && match[1]) {
            url = match[1];
          }
        }
      }

      if (url) {
        localCreativePhotos.push(url);
        addCreativeThumb(url);
        if (tunerPreviewImg && !tunerPreviewImg.src) {
          tunerPreviewImg.src = url;
          applyTunerFilters();
        }
      }
    });
  }

  if (sendAllToCanvasBtn) {
    sendAllToCanvasBtn.addEventListener("click", () => {
      if (!localCreativePhotos.length) {
        alert("Add or drop some photos into Step 3 first.");
        return;
      }
      openCreativeStudio();
      localCreativePhotos.forEach((url) => addImageFromUrl(url));
    });
  }

  // ----- Wiring Step 1 "Send top photos to Creative Studio" -----
  if (sendPhotosToStudioBtn) {
    sendPhotosToStudioBtn.addEventListener("click", () => {
      if (!dealerPhotos.length) {
        alert("Boost a listing first so Lot Rocket can grab photos.");
        return;
      }
      const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
      const fallback = dealerPhotos.map((p) => p.src);
      const chosen = (selected.length ? selected : fallback).slice(0, 8); // up to 8 images

      if (!chosen.length) {
        alert("No photos selected.");
        return;
      }

      // Show them in Creative Hub thumbnails too
      chosen.forEach((url) => {
        localCreativePhotos.push(url);
        addCreativeThumb(url);
      });

      openCreativeStudio();
      chosen.forEach((url) => addImageFromUrl(url));
    });
  }

  console.log("✅ Lot Rocket frontend wiring complete");
});
