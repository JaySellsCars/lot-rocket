// public/app.js – Lot Rocket frontend logic v2.5 (CLEAN DESIGN-STUDIO-ONLY)
// - Theme toggle
// - Step 1 / Step 2 Social Kit
// - Floating tool modals (calc, objection, etc.)
// - Step 3 Creative Hub (thumbnails + tuner)
// - Design Studio 3.0 (Konva) wired to dealer photos + local uploads

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Lot Rocket frontend loaded v2.5 (Design Studio only)");

  const apiBase = "";

  // ---------------- THEME TOGGLE ----------------
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
  // STEP 1 – Dealer URL Scraper + Social Kit
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
      img.className = "photo-thumb-img";

      const mark = document.createElement("span");
      mark.className = "photo-checkmark";
      mark.textContent = "✓";
      if (!photo.selected) mark.classList.add("hidden");

      wrapper.appendChild(img);
      wrapper.appendChild(mark);
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
        body: JSON.stringify({
          url,
          labelOverride,
          priceOverride,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          data && data.message
            ? data.message
            : "Something went wrong building the kit.";
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

      // Photos from backend
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

      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy"), 1500);
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
          body: JSON.stringify({
            platform,
            url,
            label,
            price,
          }),
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
        if (!res.ok) throw new Error(data && data.message ? data.message : "Error");
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
        if (!res.ok) throw new Error(data && data.message ? data.message : "Error");
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
        if (!res.ok) throw new Error(data && data.message ? data.message : "Error");
        if (objectionOutput) objectionOutput.value = data.answer || "";
      } catch (err) {
        console.error("objection-coach error", err);
        if (objectionOutput)
          objectionOutput.value =
            "Lot Rocket couldn't coach that objection right now. Try again in a bit.";
      }
    });
  }

  // ---------- AI helpers ----------
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
        if (output) output.value = "Lot Rocket hit a snag. Try again in a moment.";
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
  // STEP 3 CREATIVE HUB (thumbnails + tuner)
  // ==========================================

  const photoDropZone = document.getElementById("photoDropZone");
  const photoFileInput = document.getElementById("photoFileInput");
  const creativeThumbGrid = document.getElementById("creativeThumbGrid");
  const sendToDesignStudioBtn = document.getElementById("sendToDesignStudio");

  const tunerPreviewImg = document.getElementById("tunerPreviewImg");
  const tunerBrightness = document.getElementById("tunerBrightness");
  const tunerContrast = document.getElementById("tunerContrast");
  const tunerSaturation = document.getElementById("tunerSaturation");
  const autoEnhanceBtn = document.getElementById("autoEnhanceBtn");

  let localCreativePhotos = []; // URLs from drag/drop or file uploads

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

  // ==========================================
  // DESIGN STUDIO 3.0 (Konva)
  // ==========================================

  const designStudioOverlay = document.getElementById("designStudioOverlay");
  const designCloseBtn = document.getElementById("designClose");
  const designLauncher = document.getElementById("designLauncher");

  const studioSizePreset = document.getElementById("studioSizePreset");
  const konvaContainer = document.getElementById("konvaStageContainer");

  const toolAddText = document.getElementById("toolAddText");
  const toolAddShape = document.getElementById("toolAddShape");
  const toolAddBadge = document.getElementById("toolAddBadge");
  const toolSetBackground = document.getElementById("toolSetBackground");

  const studioUndoBtn = document.getElementById("studioUndoBtn");
  const studioRedoBtn = document.getElementById("studioRedoBtn");
  const studioExportPng = document.getElementById("studioExportPng");

  const layersList = document.getElementById("layersList");
  const layerTextInput = document.getElementById("layerTextInput");
  const layerFontSizeInput = document.getElementById("layerFontSizeInput");
  const layerOpacityInput = document.getElementById("layerOpacityInput");
  const layerDeleteBtn = document.getElementById("layerDeleteBtn");

  let stage = null;
  let designLayer = null;
  let designHistory = [];
  let designHistoryIndex = -1;

  function getPresetSize() {
    if (!studioSizePreset) return [1080, 1080];
    const [w, h] = studioSizePreset.value.split("x").map(Number);
    return [w || 1080, h || 1080];
  }

  function ensureDesignStudio() {
    if (stage) return { stage, designLayer };

    if (!konvaContainer || typeof Konva === "undefined") {
      console.error("Konva or container missing");
      return null;
    }

    const [w, h] = getPresetSize();
    stage = new Konva.Stage({
      container: konvaContainer,
      width: w,
      height: h,
    });
    designLayer = new Konva.Layer();
    stage.add(designLayer);
    stage.draw();
    saveDesignState();
    wireStageSelection();
    return { stage, designLayer };
  }

  function saveDesignState() {
    if (!stage) return;
    const json = stage.toJSON();
    designHistory = designHistory.slice(0, designHistoryIndex + 1);
    designHistory.push(json);
    designHistoryIndex = designHistory.length - 1;
  }

  function loadDesignState(index) {
    if (!konvaContainer) return;
    if (index < 0 || index >= designHistory.length) return;

    const json = designHistory[index];
    // Destroy old stage and recreate from JSON
    if (stage) {
      stage.destroy();
    }
    stage = Konva.Node.create(json, konvaContainer);
    designLayer = stage.findOne("Layer");
    designHistoryIndex = index;
    wireStageSelection();
    rebuildLayersList();
  }

  function wireStageSelection() {
    if (!stage) return;
    stage.off("click");
    stage.on("click", (e) => {
      const node = e.target;
      if (!node || node === stage) {
        stage.find("Transformer").destroy();
        stage.draw();
        syncInspector(null);
        return;
      }
      const layer = designLayer || stage.findOne("Layer");
      if (!layer) return;

      layer.find("Transformer").destroy();
      const tr = new Konva.Transformer({
        rotateEnabled: true,
        enabledAnchors: [
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
        ],
      });
      layer.add(tr);
      tr.nodes([node]);
      layer.draw();
      syncInspector(node);
    });
  }

  function rebuildLayersList() {
    if (!layersList || !designLayer) return;
    layersList.innerHTML = "";
    designLayer.getChildren().forEach((node, index) => {
      if (node.getClassName() === "Transformer") return;
      const li = document.createElement("li");
      li.textContent = `${index + 1} – ${node.getClassName()}`;
      li.dataset.nodeId = node._id;
      li.addEventListener("click", () => {
        stage.fire("click", { target: node });
      });
      layersList.appendChild(li);
    });
  }

  function syncInspector(node) {
    if (!layerTextInput || !layerFontSizeInput || !layerOpacityInput) return;

    if (!node) {
      layerTextInput.value = "";
      layerFontSizeInput.value = "40";
      layerOpacityInput.value = "1";
      layerDeleteBtn && (layerDeleteBtn.disabled = true);
      return;
    }

    const text = node.text ? node.text() : "";
    const fs = node.fontSize ? node.fontSize() : 40;
    const op = node.opacity ? node.opacity() : 1;

    if (typeof text === "string") layerTextInput.value = text;
    else layerTextInput.value = "";

    if (typeof fs === "number") layerFontSizeInput.value = String(fs);
    else layerFontSizeInput.value = "40";

    layerOpacityInput.value = String(op);
    if (layerDeleteBtn) layerDeleteBtn.disabled = false;
  }

  function getSelectedNode() {
    if (!stage) return null;
    const tr = stage.findOne("Transformer");
    if (!tr) return null;
    const nodes = tr.nodes();
    return nodes && nodes[0] ? nodes[0] : null;
  }

  function addKonvaText() {
    const ctx = ensureDesignStudio();
    if (!ctx) return;
    const { stage, designLayer } = ctx;
    const text = new Konva.Text({
      text: "YOUR TEXT HERE",
      x: stage.width() / 2,
      y: 150,
      fontSize: 64,
      fontStyle: "bold",
      fill: "#ffffff",
      align: "center",
      listening: true,
    });
    text.offsetX(text.width() / 2);
    designLayer.add(text);
    designLayer.draw();
    saveDesignState();
    rebuildLayersList();
  }

  function addKonvaBanner() {
    const ctx = ensureDesignStudio();
    if (!ctx) return;
    const { stage, designLayer } = ctx;
    const rect = new Konva.Rect({
      x: stage.width() / 2,
      y: stage.height() - 120,
      width: stage.width() * 0.9,
      height: 160,
      offsetX: (stage.width() * 0.9) / 2,
      offsetY: 80,
      fill: "black",
      opacity: 0.75,
      cornerRadius: 16,
      listening: true,
    });
    designLayer.add(rect);
    designLayer.draw();
    saveDesignState();
    rebuildLayersList();
  }

  function addKonvaBadge() {
    const ctx = ensureDesignStudio();
    if (!ctx) return;
    const { stage, designLayer } = ctx;
    const circle = new Konva.Circle({
      x: stage.width() - 220,
      y: 140,
      radius: 130,
      fill: "red",
      opacity: 0.95,
      listening: true,
    });
    designLayer.add(circle);
    designLayer.draw();
    saveDesignState();
    rebuildLayersList();
  }

  function addImageToStage(url, asBackground = false) {
    const ctx = ensureDesignStudio();
    if (!ctx) return;
    const { stage, designLayer } = ctx;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const imgW = img.width;
      const imgH = img.height;
      const stageW = stage.width();
      const stageH = stage.height();

      const scale = Math.min(
        (stageW * 0.8) / imgW,
        (stageH * 0.8) / imgH
      );

      const konvaImg = new Konva.Image({
        image: img,
        x: stageW / 2,
        y: stageH / 2,
        offsetX: (imgW * scale) / 2,
        offsetY: (imgH * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        listening: true,
      });

      if (asBackground) {
        konvaImg.zIndex(0);
      }

      designLayer.add(konvaImg);
      designLayer.draw();
      saveDesignState();
      rebuildLayersList();
    };
    img.src = url;
  }

  function openDesignStudio() {
    if (!designStudioOverlay) return;
    designStudioOverlay.classList.remove("hidden");
    ensureDesignStudio();
  }

  function closeDesignStudio() {
    if (!designStudioOverlay) return;
    designStudioOverlay.classList.add("hidden");
  }

  // ---- Design Studio wiring ----
  if (designLauncher) {
    designLauncher.addEventListener("click", () => {
      openDesignStudio();
    });
  }
  if (designCloseBtn && designStudioOverlay) {
    designCloseBtn.addEventListener("click", closeDesignStudio);
    designStudioOverlay.addEventListener("click", (e) => {
      if (e.target === designStudioOverlay) closeDesignStudio();
    });
  }

  if (studioSizePreset) {
    studioSizePreset.addEventListener("change", () => {
      const ctx = ensureDesignStudio();
      if (!ctx) return;
      const [w, h] = getPresetSize();
      stage.size({ width: w, height: h });
      stage.draw();
      saveDesignState();
    });
  }

  if (toolAddText) toolAddText.addEventListener("click", addKonvaText);
  if (toolAddShape) toolAddShape.addEventListener("click", addKonvaBanner);
  if (toolAddBadge) toolAddBadge.addEventListener("click", addKonvaBadge);
  if (toolSetBackground) {
    toolSetBackground.addEventListener("click", () => {
      // Use currently selected creative thumb or tuner image as background
      let url = "";
      const selectedThumb = document.querySelector(".creative-thumb.selected");
      if (selectedThumb) url = selectedThumb.src;
      else if (tunerPreviewImg && tunerPreviewImg.src) url = tunerPreviewImg.src;
      if (!url) {
        alert("Select a photo in Step 3 first.");
        return;
      }
      openDesignStudio();
      addImageToStage(url, true);
    });
  }

  if (studioUndoBtn) {
    studioUndoBtn.addEventListener("click", () => {
      if (designHistoryIndex > 0) {
        loadDesignState(designHistoryIndex - 1);
      }
    });
  }

  if (studioRedoBtn) {
    studioRedoBtn.addEventListener("click", () => {
      if (designHistoryIndex < designHistory.length - 1) {
        loadDesignState(designHistoryIndex + 1);
      }
    });
  }

  if (studioExportPng) {
    studioExportPng.addEventListener("click", () => {
      if (!stage) return;
      const dataUrl = stage.toDataURL({ mimeType: "image/png", pixelRatio: 1 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "lot-rocket-design.png";
      a.click();
    });
  }

  // Inspector wiring
  if (layerTextInput) {
    layerTextInput.addEventListener("input", () => {
      const node = getSelectedNode();
      if (!node || !node.text) return;
      node.text(layerTextInput.value);
      node.getLayer().batchDraw();
      saveDesignState();
      rebuildLayersList();
    });
  }

  if (layerFontSizeInput) {
    layerFontSizeInput.addEventListener("input", () => {
      const node = getSelectedNode();
      const size = Number(layerFontSizeInput.value || "40");
      if (!node || !node.fontSize) return;
      node.fontSize(size);
      node.getLayer().batchDraw();
      saveDesignState();
    });
  }

  if (layerOpacityInput) {
    layerOpacityInput.addEventListener("input", () => {
      const node = getSelectedNode();
      const op = Number(layerOpacityInput.value || "1");
      if (!node || !node.opacity) return;
      node.opacity(op);
      node.getLayer().batchDraw();
      saveDesignState();
    });
  }

  if (layerDeleteBtn) {
    layerDeleteBtn.addEventListener("click", () => {
      const node = getSelectedNode();
      if (!node) return;
      node.destroy();
      stage.find("Transformer").destroy();
      stage.draw();
      saveDesignState();
      rebuildLayersList();
      syncInspector(null);
    });
  }

  // ----- Wiring Step 3 "Send Selected to Design Studio" -----
  if (sendToDesignStudioBtn) {
    sendToDesignStudioBtn.addEventListener("click", () => {
      if (!localCreativePhotos.length) {
        alert("Add or drop some photos into Step 3 first.");
        return;
      }
      openDesignStudio();

      // If any thumbs are selected, send only those; otherwise send all
      const selectedThumbs = Array.from(
        document.querySelectorAll(".creative-thumb.selected")
      );
      const urls =
        selectedThumbs.length > 0
          ? selectedThumbs.map((img) => img.src)
          : localCreativePhotos;

      urls.forEach((url, idx) => {
        addImageToStage(url, idx === 0); // first could be treated as bg if desired
      });
    });
  }

  // ----- Wiring Step 1 "Send top photos to Design Studio" -----
  if (sendPhotosToStudioBtn) {
    sendPhotosToStudioBtn.disabled = dealerPhotos.length === 0;

    sendPhotosToStudioBtn.addEventListener("click", () => {
      if (!dealerPhotos.length) {
        alert("Boost a listing first so Lot Rocket can grab photos.");
        return;
      }

      const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
      const chosen = (selected.length ? selected : dealerPhotos.map((p) => p.src)).slice(
        0,
        8
      );

      if (!chosen.length) {
        alert("No photos selected.");
        return;
      }

      // Also pipe them into Step 3 thumbnails for consistency
      chosen.forEach((url) => {
        localCreativePhotos.push(url);
        addCreativeThumb(url);
      });

      openDesignStudio();
      chosen.forEach((url, idx) => addImageToStage(url, idx === 0));
    });
  }

  console.log("✅ Lot Rocket frontend wiring complete (Design Studio 3.0)");
});
