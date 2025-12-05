// public/app.js – Lot Rocket frontend logic v2.6
// - Theme toggle
// - Step 1 + Step 2 social kit
// - Step 3 Creative Lab (drag/drop + tuner)
// - Canvas Studio (Fabric)
// - Design Studio 3.0 (Konva)
// - Side tool modals + AI helpers
// - CORS-safe image loading via /api/image-proxy

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Lot Rocket frontend loaded v2.6");
  const apiBase = "";

  // ======================================
  // THEME TOGGLE
  // ======================================
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

  // ======================================
  // STEP 1 + STEP 2 – SOCIAL KIT
  // ======================================

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

  // Dealer photos state (Step 1)
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

  // ---------- BOOST THIS LISTING ----------
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
        body: JSON.stringify({ url, labelOverride, priceOverride }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data && data.message ? data.message : "Error building kit");
      }

      // Summary
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

      // Photos from backend -> Step 1 grid
      const photos = Array.isArray(data.photos) ? data.photos : [];
      dealerPhotos = photos.map((src) => ({ src, selected: false }));
      renderDealerPhotos();
      if (sendPhotosToStudioBtn) {
        sendPhotosToStudioBtn.disabled = dealerPhotos.length === 0;
      }

      document.body.classList.add("kit-ready");
      if (statusText) statusText.textContent = "Social kit ready ✔";
    } catch (err) {
      console.error("Boost error:", err);
      if (statusText) {
        statusText.textContent =
          err && err.message
            ? err.message
            : "Failed to build kit. Try again in a moment.";
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

      btn.classList.add("copied");
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.textContent = original || "Copy";
      }, 1200);
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
          vehicleLabelInput?.value.trim() || summaryLabel?.textContent || "";
        const price =
          priceInfoInput?.value.trim() || summaryPrice?.textContent || "";

        const res = await fetch(apiBase + "/api/new-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, url, label, price }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data && data.message ? data.message : "Error");

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

  // ======================================
  // SIDE MODALS (OBJECTION, CALCS, ETC.)
  // ======================================

  function wireModal(launcherId, modalId, closeSelector) {
    const launcher = document.getElementById(launcherId);
    const modal = document.getElementById(modalId);
    if (!launcher || !modal) return;

    const closeBtn = modal.querySelector(closeSelector || ".modal-close-btn");

    launcher.addEventListener("click", () => {
      modal.classList.remove("hidden");
    });
    if (closeBtn) {
      closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    }
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
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
        if (!res.ok) throw new Error(data && data.message ? data.message : "Error");
        if (paymentOutput) paymentOutput.textContent = data.result || "";
      } catch (err) {
        console.error("payment-helper error", err);
        if (paymentOutput) {
          paymentOutput.textContent =
            "Could not calculate payment. Check numbers and try again.";
        }
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
        if (!res.ok) throw new Error(data && data.message ? data.message : "Error");
        if (incomeOutput) incomeOutput.textContent = data.result || "";
      } catch (err) {
        console.error("income-helper error", err);
        if (incomeOutput) {
          incomeOutput.textContent =
            "Could not estimate income. Check numbers and try again.";
        }
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
        if (!res.ok) throw new Error(data && data.message ? data.message : "Error");
        if (objectionOutput) objectionOutput.value = data.answer || "";
      } catch (err) {
        console.error("objection-coach error", err);
        if (objectionOutput) {
          objectionOutput.value =
            "Lot Rocket couldn't coach that objection right now. Try again in a bit.";
        }
      }
    });
  }

  // ---------- Generic AI helpers ----------
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
        if (!res.ok) throw new Error(data && data.message ? data.message : "Error");
        if (output) output.value = data.text || "";
      } catch (err) {
        console.error("message-helper error", err);
        if (output) {
          output.value = "Lot Rocket hit a snag. Try again in a moment.";
        }
      }
    });
  }

  wireMessageHelper("workflowForm", "workflowOutput", "workflow");
  wireMessageHelper("messageForm", "messageOutput", "message");
  wireMessageHelper("askForm", "askOutput", "ask");
  wireMessageHelper("carForm", "carOutput", "car");
  wireMessageHelper("imageForm", "imageOutput", "image-brief");
  wireMessageHelper("videoForm", "videoOutput", "video-brief");

  // ======================================
  // STEP 3 – CREATIVE LAB (Drag & Drop)
  // ======================================

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

  let localCreativePhotos = []; // URLs from drag/drop or dealer photos

  function applyTunerFilters() {
    if (!tunerPreviewImg) return;
    const b = tunerBrightness ? Number(tunerBrightness.value || 100) : 100;
    const c = tunerContrast ? Number(tunerContrast.value || 100) : 100;
    const s = tunerSaturation ? Number(tunerSaturation.value || 100) : 100;
    tunerPreviewImg.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  }

  if (tunerBrightness) tunerBrightness.addEventListener("input", applyTunerFilters);
  if (tunerContrast) tunerContrast.addEventListener("input", applyTunerFilters);
  if (tunerSaturation) tunerSaturation.addEventListener("input", applyTunerFilters);

  // Any external image should go through our proxy to avoid CORS issues on canvas
  function getSafeImageUrl(rawUrl) {
    if (!rawUrl) return "";
    if (rawUrl.startsWith("blob:") || rawUrl.startsWith("data:")) return rawUrl;
    if (rawUrl.startsWith(window.location.origin)) return rawUrl;
    return "/api/image-proxy?url=" + encodeURIComponent(rawUrl);
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
    photoDropZone.addEventListener("click", () => photoFileInput.click());

    photoFileInput.addEventListener("change", (e) => {
      handleCreativeFiles(e.target.files);
      photoFileInput.value = "";
    });

    ["dragenter", "dragover"].forEach((evt) => {
      photoDropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDropZone.classList.add("dragover");
      });
    });
    ["dragleave", "dragend", "drop"].forEach((evt) => {
      photoDropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDropZone.classList.remove("dragover");
      });
    });
    photoDropZone.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      if (!dt || !dt.files) return;
      handleCreativeFiles(dt.files);
    });
  }

  // Step 1 -> Creative Lab + Design Studio 3.0
  if (sendPhotosToStudioBtn) {
    sendPhotosToStudioBtn.disabled = dealerPhotos.length === 0;

    sendPhotosToStudioBtn.addEventListener("click", () => {
      if (!dealerPhotos.length) {
        alert("Boost a listing first so Lot Rocket can grab photos.");
        return;
      }

      const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
      const chosen = (
        selected.length ? selected : dealerPhotos.map((p) => p.src)
      ).slice(0, 8);

      // 1) Feed into Creative Lab thumbnails / tuner
      chosen.forEach((url) => {
        if (!localCreativePhotos.includes(url)) {
          localCreativePhotos.push(url);
          addCreativeThumb(url);
        }
      });

      // 2) Also open Design Studio and send the same photos there
      sendUrlsToDesignStudio(chosen);
    });
  }

  // ======================================
  // CANVAS STUDIO (FABRIC)
  // ======================================

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

    const safeUrl = getSafeImageUrl(url);

    fabric.Image.fromURL(
      safeUrl,
      (img) => {
        const fitScale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height
        );
        const scale = Math.min(fitScale * 0.75, 0.75);

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

        creativeToolButtons.forEach((b) =>
          b.classList.remove("tool-btn-active")
        );
        btn.classList.add("tool-btn-active");

        if (!creativeCanvas) {
          if (tool === "uploadImage" && creativeImageInput) {
            creativeImageInput.click();
          }
          return;
        }

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

  // Send ALL local photos to Fabric canvas
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

  // ======================================
  // DESIGN STUDIO 3.0 (KONVA)
  // ======================================

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

  let designStage = null;
  let designBgLayer = null;
  let designMainLayer = null;
  let designHistory = [];
  let designHistoryIndex = -1;
  let selectedNode = null;
  // --- Smart snapping helpers for draggable nodes ---

  function attachDragWithSnapping(node) {
    if (!node) return;
    node.draggable(true);

    node.on("dragmove", () => {
      snapNodeToGuides(node);
      const stage = node.getStage();
      if (stage) stage.batchDraw();
    });

    node.on("dragend", () => {
      saveDesignState();
      refreshLayersList();
    });
  }

  function snapNodeToGuides(node) {
    const stage = node.getStage();
    if (!stage) return;

    const SNAP = 12; // pixel tolerance
    let { x, y } = node.position();

    const centerX = stage.width() / 2;
    const centerY = stage.height() / 2;
    const topThirdY = stage.height() / 3;
    const bottomThirdY = (stage.height() * 2) / 3;

    // Snap X to center
    if (Math.abs(x - centerX) < SNAP) {
      x = centerX;
    }

    // Snap Y to thirds / center
    if (Math.abs(y - centerY) < SNAP) {
      y = centerY;
    } else if (Math.abs(y - topThirdY) < SNAP) {
      y = topThirdY;
    } else if (Math.abs(y - bottomThirdY) < SNAP) {
      y = bottomThirdY;
    }

    node.position({ x, y });
  }

  function ensureDesignStage() {
    if (designStage) return designStage;
    if (typeof Konva === "undefined") {
      console.error("Konva not loaded");
      return null;
    }

    const container = document.getElementById("konvaStageContainer");
    if (!container) return null;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    designStage = new Konva.Stage({
      container: "konvaStageContainer",
      width,
      height,
    });

    designBgLayer = new Konva.Layer();
    designMainLayer = new Konva.Layer();
    designStage.add(designBgLayer);
    designStage.add(designMainLayer);

    designStage.on("click", (e) => {
      if (e.target === designStage) {
        setSelectedNode(null);
      } else {
        setSelectedNode(e.target);
      }
    });

    designStage.on("dragend transformend", () => {
      saveDesignState();
      refreshLayersList();
    });

    saveDesignState();
    return designStage;
  }

  function saveDesignState() {
    if (!designStage) return;
    const json = designStage.toJSON();
    designHistory = designHistory.slice(0, designHistoryIndex + 1);
    designHistory.push(json);
    designHistoryIndex = designHistory.length - 1;
  }

  function loadDesignState(index) {
    if (!designStage) return;
    if (index < 0 || index >= designHistory.length) return;
    designHistoryIndex = index;
    designStage.destroy();
    designStage = null;
    const container = document.getElementById("konvaStageContainer");
    if (!container) return;
    const stage = ensureDesignStage();
    if (!stage) return;
    stage.fromJSON(designHistory[index]);
    stage.find("Shape").forEach((shape) => {
      shape.draggable(true);
    });
    refreshLayersList();
  }

  function refreshLayersList() {
    if (!layersList || !designMainLayer) return;
    layersList.innerHTML = "";
    const nodes = designMainLayer.getChildren();

    nodes.forEach((node, index) => {
      const li = document.createElement("li");
      li.textContent = node.name() || `Layer ${index + 1}`;
      li.dataset.index = String(index);
      if (node === selectedNode) li.classList.add("active");
      li.addEventListener("click", () => {
        setSelectedNode(node);
      });
      layersList.appendChild(li);
    });
  }

  function setSelectedNode(node) {
    selectedNode = node;
    if (!layerTextInput || !layerFontSizeInput || !layerOpacityInput) return;

    if (!node) {
      layerTextInput.value = "";
      layerFontSizeInput.value = "40";
      layerOpacityInput.value = "1";
      refreshLayersList();
      if (designStage) designStage.draw();
      return;
    }

    if (node.text) {
      layerTextInput.value = node.text();
    } else {
      layerTextInput.value = "";
    }
    layerFontSizeInput.value = node.fontSize ? node.fontSize() : 40;
    layerOpacityInput.value = node.opacity ? node.opacity() : 1;

    refreshLayersList();
    if (designStage) designStage.draw();
  }

  function addDesignText() {
    const stage = ensureDesignStage();
    if (!stage || !designMainLayer) return;

    const text = new Konva.Text({
      x: stage.width() / 2,
      y: 80,
      text: "YOUR TEXT HERE",
      fontSize: 40,
      fontFamily: "Arial",
      fill: "#ffffff",
      align: "center",
      offsetX: 0,
      draggable: true,
      name: "Text",
    });

    text.offsetX(text.width() / 2);
    designMainLayer.add(text);
    setSelectedNode(text);
    designMainLayer.draw();
    saveDesignState();
    refreshLayersList();
  }

  function addDesignBanner() {
    const stage = ensureDesignStage();
    if (!stage || !designMainLayer) return;

    const rect = new Konva.Rect({
      x: stage.width() / 2,
      y: stage.height() - 120,
      width: stage.width() * 0.9,
      height: 120,
      fill: "#000000",
      opacity: 0.75,
      cornerRadius: 20,
      offsetX: (stage.width() * 0.9) / 2,
      draggable: true,
      name: "Banner",
    });

    designMainLayer.add(rect);
    setSelectedNode(rect);
    designMainLayer.draw();
    saveDesignState();
    refreshLayersList();
  }

  function addDesignBadge() {
    const stage = ensureDesignStage();
    if (!stage || !designMainLayer) return;

    const circle = new Konva.Circle({
      x: stage.width() - 150,
      y: 120,
      radius: 100,
      fill: "#ef4444",
      opacity: 0.9,
      draggable: true,
      name: "Price Badge",
    });

    designMainLayer.add(circle);
    setSelectedNode(circle);
    designMainLayer.draw();
    saveDesignState();
    refreshLayersList();
  }

  function setBackgroundFromUrl(url) {
    const stage = ensureDesignStage();
    if (!stage || !designBgLayer) return;

    const safeUrl = getSafeImageUrl(url);

    Konva.Image.fromURL(safeUrl, (img) => {
      const scale = Math.max(
        stage.width() / img.width(),
        stage.height() / img.height()
      );
      img.scale({ x: scale, y: scale });
      img.position({ x: 0, y: 0 });
      img.listening(false);

      designBgLayer.destroyChildren();
      designBgLayer.add(img);
      designBgLayer.draw();
      saveDesignState();
    });
  }

  function openDesignStudio() {
    if (!designStudioOverlay) return;
    designStudioOverlay.classList.remove("hidden");
    ensureDesignStage();
  }

  function closeDesignStudio() {
    if (!designStudioOverlay) return;
    designStudioOverlay.classList.add("hidden");
  }

  // Helper: send a list of URLs into Design Studio (bg + overlays)
  function sendUrlsToDesignStudio(urls) {
    if (!urls || !urls.length) {
      alert("No photos available to send to Design Studio yet.");
      return;
    }

    openDesignStudio();

    urls.forEach((url, index) => {
      if (!url) return;

      if (index === 0) {
        setBackgroundFromUrl(url);
      } else {
        const stage = ensureDesignStage();
        if (!stage || !designMainLayer) return;

        const safeUrl = getSafeImageUrl(url);

        Konva.Image.fromURL(safeUrl, (img) => {
          img.draggable(true);
          const scaleFactor = 0.5;
          img.scale({ x: scaleFactor, y: scaleFactor });
          img.position({
            x: stage.width() / 2,
            y: stage.height() / 2,
          });
          designMainLayer.add(img);
          setSelectedNode(img);
          designMainLayer.draw();
          saveDesignState();
          refreshLayersList();
        });
      }
    });
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

  if (studioSizePreset) {
    studioSizePreset.addEventListener("change", () => {
      const stage = ensureDesignStage();
      if (!stage) return;
      const [w, h] = studioSizePreset.value.split("x").map(Number);
      stage.size({ width: w, height: h });
      stage.draw();
      saveDesignState();
    });
  }

  if (studioUndoBtn) {
    studioUndoBtn.addEventListener("click", () => {
      if (!designStage) return;
      if (designHistoryIndex > 0) {
        loadDesignState(designHistoryIndex - 1);
      }
    });
  }

  if (studioRedoBtn) {
    studioRedoBtn.addEventListener("click", () => {
      if (!designStage) return;
      if (designHistoryIndex < designHistory.length - 1) {
        loadDesignState(designHistoryIndex + 1);
      }
    });
  }

  if (studioExportPng) {
    studioExportPng.addEventListener("click", () => {
      const stage = ensureDesignStage();
      if (!stage) return;
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "lot-rocket-design.png";
      a.click();
    });
  }

  if (toolAddText) toolAddText.addEventListener("click", addDesignText);
  if (toolAddShape) toolAddShape.addEventListener("click", addDesignBanner);
  if (toolAddBadge) toolAddBadge.addEventListener("click", addDesignBadge);
  if (toolSetBackground) {
    toolSetBackground.addEventListener("click", () => {
      const selectedThumb = document.querySelector(".creative-thumb.selected");
      const url = selectedThumb?.getAttribute("src") || localCreativePhotos[0];
      if (!url) {
        alert("Select or add a photo in Step 3 first.");
        return;
      }
      sendUrlsToDesignStudio([url]);
    });
  }

  // Step 3 button: Send selected thumbs (or all) to Design Studio as bg + layers
  if (sendToDesignStudioBtn) {
    sendToDesignStudioBtn.addEventListener("click", () => {
      const thumbs = Array.from(
        document.querySelectorAll(".creative-thumb.selected")
      );

      const urls =
        thumbs.length > 0
          ? thumbs.map((img) => img.getAttribute("src"))
          : localCreativePhotos;

      if (!urls || !urls.length) {
        alert("Select at least one photo (or add some to Step 3).");
        return;
      }

      sendUrlsToDesignStudio(urls);
    });
  }

  // Selected layer controls
  if (layerTextInput) {
    layerTextInput.addEventListener("input", () => {
      if (selectedNode && selectedNode.text) {
        selectedNode.text(layerTextInput.value);
        if (designStage) designStage.draw();
        saveDesignState();
      }
    });
  }

  if (layerFontSizeInput) {
    layerFontSizeInput.addEventListener("input", () => {
      if (selectedNode && selectedNode.fontSize) {
        const size = Number(layerFontSizeInput.value || 40);
        selectedNode.fontSize(size);
        if (designStage) designStage.draw();
        saveDesignState();
      }
    });
  }

  if (layerOpacityInput) {
    layerOpacityInput.addEventListener("input", () => {
      if (selectedNode && typeof selectedNode.opacity === "function") {
        const val = Number(layerOpacityInput.value || 1);
        selectedNode.opacity(val);
        if (designStage) designStage.draw();
        saveDesignState();
      }
    });
  }

  if (layerDeleteBtn) {
    layerDeleteBtn.addEventListener("click", () => {
      if (!selectedNode || !designMainLayer) return;
      selectedNode.destroy();
      selectedNode = null;
      designMainLayer.draw();
      saveDesignState();
      refreshLayersList();
    });
  }

  console.log("✅ Lot Rocket frontend wiring complete");
});
