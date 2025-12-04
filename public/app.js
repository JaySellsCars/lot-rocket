// public/app.js – Lot Rocket frontend logic v2.6.0
// PROTECTED: theme toggle, Boost button wiring, calculator + modal wiring.
// Upgrade: Konva.js Design Studio 3.0 + existing Creative Hub (Step 3).

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Lot Rocket frontend loaded v2.6.0");

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
      img.className = "photo-thumb-img";

      wrapper.appendChild(img);
      photosGrid.appendChild(wrapper);
    });

    // Re-attach click handlers
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

      // Photos from backend – cap to 40 so it doesn't go insane
      const photos = Array.isArray(data.photos) ? data.photos.slice(0, 40) : [];
      dealerPhotos = photos.map((src) => ({ src, selected: false }));
      renderDealerPhotos();

      if (sendPhotosToStudioBtn) {
        sendPhotosToStudioBtn.disabled = dealerPhotos.length === 0;
      }

      // Visually mark kit as ready for Step 2
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
        btn.textContent = original;
        btn.classList.remove("copied");
      }, 1500);
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
    });
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
          output.value = "Lot Rocket hit a snag talking to AI. Try again in a moment.";
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
  // CREATIVE HUB (STEP 3) + DESIGN STUDIO 3.0
  // ==========================================

  // ---- Creative Hub (unchanged behaviour) ----
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

  // Design Studio controls (Konva)
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

  let localCreativePhotos = []; // keep track of locally added URLs

  // ---- Konva Design Studio state ----
  let studioStage = null;
  let studioLayer = null;
  let studioHistory = [];
  let studioHistoryIndex = -1;
  let studioSelectedNode = null;

  function initDesignStudio() {
    const container = document.getElementById("konvaStageContainer");
    if (!container) {
      console.warn("Design Studio container not found.");
      return;
    }

    const rect = container.getBoundingClientRect();
    const width = rect.width || 1080;
    const height = rect.height || 1080;

    studioStage = new Konva.Stage({
      container: "konvaStageContainer",
      width,
      height,
    });

    studioLayer = new Konva.Layer();
    studioStage.add(studioLayer);

    window.addEventListener("resize", () => {
      const r = container.getBoundingClientRect();
      studioStage.width(r.width || width);
      studioStage.height(r.height || height);
      studioStage.draw();
    });

    wireDesignStudioUI();
    saveStudioHistory(); // initial
  }

  // ---- History (Undo / Redo) ----
  function saveStudioHistory() {
    if (!studioStage) return;
    const json = studioStage.toJSON();
    studioHistory = studioHistory.slice(0, studioHistoryIndex + 1);
    studioHistory.push(json);
    studioHistoryIndex = studioHistory.length - 1;
  }

  function restoreStudioFromHistory(index) {
    if (!studioStage || index < 0 || index >= studioHistory.length) return;
    studioHistoryIndex = index;
    const json = studioHistory[index];

    const container = studioStage.container();
    const width = studioStage.width();
    const height = studioStage.height();

    studioStage.destroy();
    studioStage = Konva.Node.create(json, container);
    studioStage.width(width);
    studioStage.height(height);

    studioLayer = studioStage.getLayers()[0] || new Konva.Layer();
    if (!studioStage.getLayers().length) {
      studioStage.add(studioLayer);
    }

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

  // ---- Layer / selection helpers ----
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
      const li = document.createElement("li");
      li.className = "layer-item";
      li.textContent = `${index + 1} — ${node.name() || node.getClassName()}`;
      if (node === studioSelectedNode) {
        li.classList.add("layer-item-selected");
      }
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

  // ---- Add elements to stage ----
  function attachNodeInteractions(node) {
    node.on("click tap", () => {
      selectStudioNode(node);
    });
    node.on("dragend transformend", () => {
      saveStudioHistory();
    });
  }

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
      offsetX: 0,
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
    const node = new Konva.Rect({
      x: studioStage.width() / 2,
      y: studioStage.height() - 140,
      width: studioStage.width() * 0.9,
      height: 180,
      fill: "#000000",
      opacity: 0.7,
      cornerRadius: 18,
      offsetX: (studioStage.width() * 0.9) / 2,
      offsetY: 90,
      name: "Shape Layer",
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
    }
    studioLayer.draw();
    saveStudioHistory();
  }

  function addStudioImageFromUrl(url, asBackground = false) {
    if (!studioLayer || !studioStage || !url) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const ratio = Math.min(
        studioStage.width() / img.width,
        studioStage.height() / img.height
      );
      const width = img.width * ratio;
      const height = img.height * ratio;

      const node = new Konva.Image({
        image: img,
        x: studioStage.width() / 2,
        y: studioStage.height() / 2,
        width,
        height,
        offsetX: width / 2,
        offsetY: height / 2,
        draggable: !asBackground,
        name: asBackground ? "Background Photo" : "Photo Layer",
      });

      attachNodeInteractions(node);
      studioLayer.add(node);
      if (asBackground) node.moveToBottom();
      studioLayer.draw();
      selectStudioNode(node);
      saveStudioHistory();
    };
    img.onerror = (err) => {
      console.error("Failed to load image for studio:", err);
    };
    img.src = url;
  }

  // ---- Export & size presets ----
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
    const value = studioSizePreset.value; // "1080x1080"
    const [w, h] = value.split("x").map(Number);

    studioStage.width(w);
    studioStage.height(h);

    const bg = studioLayer.findOne(".BackgroundLayer");
    if (bg) {
      bg.width(w);
      bg.height(h);
    }

    studioStage.draw();
    saveStudioHistory();
  }

  // ---- Wire Design Studio UI ----
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
      toolSetBackground.addEventListener("click", () => setStudioBackground("#111111"));
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

  function openCreativeStudio() {
    if (!creativeStudioOverlay) return;
    creativeStudioOverlay.classList.remove("hidden");
    if (!studioStage) {
      initDesignStudio();
    }
  }

  function closeCreativeStudio() {
    if (!creativeStudioOverlay) return;
    creativeStudioOverlay.classList.add("hidden");
  }

  // ---- Canvas Studio wiring (Konva overlay) ----
  if (canvasLauncher) {
    canvasLauncher.addEventListener("click", openCreativeStudio);
  }
  if (creativeCloseBtn && creativeStudioOverlay) {
    creativeCloseBtn.addEventListener("click", closeCreativeStudio);
    creativeStudioOverlay.addEventListener("click", (e) => {
      if (e.target === creativeStudioOverlay) closeCreativeStudio();
    });
  }

  // ----- Photo tuner filters -----
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

  // ----- Creative Hub thumbnails + drag & drop -----
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
    console.log("[LotRocket] handleCreativeFiles: got", files.length, "files");
    if (!files.length) return;

    files.forEach((file) => {
      if (!file || !file.type || !file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      localCreativePhotos.push(url);
      addCreativeThumb(url);

      // If no preview yet, use the first image dropped
      if (tunerPreviewImg && !tunerPreviewImg.src) {
        tunerPreviewImg.src = url;
        applyTunerFilters();
      }
    });
  }

  if (photoDropZone && photoFileInput) {
    // Click → open file picker
    photoDropZone.addEventListener("click", () => {
      photoFileInput.click();
    });

    // File picker change
    photoFileInput.addEventListener("change", (e) => {
      handleCreativeFiles(e.target.files);
      photoFileInput.value = "";
    });

    // Highlight on drag over
    ["dragenter", "dragover"].forEach((evtName) => {
      photoDropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDropZone.classList.add("dragover");
      });
    });

    // Remove highlight
    ["dragleave", "dragend"].forEach((evtName) => {
      photoDropZone.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDropZone.classList.remove("dragover");
      });
    });

    // Handle drop
    photoDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      photoDropZone.classList.remove("dragover");

      const dt = e.dataTransfer;
      let files = dt && dt.files;
      console.log(
        "[LotRocket] drop event; types:",
        dt ? dt.types : "none",
        "fileCount:",
        files ? files.length : 0
      );

      // Fallback: some browsers expose files via dataTransfer.items
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

      if (!files || !files.length) {
        console.log("[LotRocket] drop had no files");
        return;
      }

      handleCreativeFiles(files);
    });
  }

  // ----- Gather URLs for Design Studio -----
  function gatherImageUrlsForCanvas() {
    const urls = [];

    if (creativeThumbGrid) {
      creativeThumbGrid.querySelectorAll("img").forEach((img) => {
        if (img.src) urls.push(img.src);
      });
    }

    // Fallback: directly selected dealer photos
    if (!urls.length && photosGrid) {
      photosGrid
        .querySelectorAll(".photo-thumb-btn.photo-thumb-selected img")
        .forEach((img) => {
          if (img.src) urls.push(img.src);
        });
    }

    return urls;
  }

  // "Send All to Canvas Studio" – use Creative Hub thumbnails
  if (sendAllToCanvasBtn) {
    sendAllToCanvasBtn.addEventListener("click", () => {
      const urls = gatherImageUrlsForCanvas();
      if (!urls.length) {
        alert("Add or select some photos in the Creative Lab first.");
        return;
      }
      openCreativeStudio();
      urls.forEach((url) => addStudioImageFromUrl(url));
    });
  }

  // Step 1: "Send top photos to Creative Studio"
  if (sendPhotosToStudioBtn) {
    sendPhotosToStudioBtn.addEventListener("click", () => {
      if (!dealerPhotos.length) {
        alert("Boost a listing first so Lot Rocket can grab photos.");
        return;
      }
      const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
      const chosen = (selected.length ? selected : dealerPhotos.map((p) => p.src))
        .slice(0, 8); // up to 8 images

      if (!chosen.length) {
        alert("No photos selected.");
        return;
      }

      // Show them inside the Creative Hub thumbnails for tuning
      chosen.forEach((url) => {
        localCreativePhotos.push(url);
        addCreativeThumb(url);
      });

      openCreativeStudio();
      chosen.forEach((url) => addStudioImageFromUrl(url));
    });
  }

  console.log("✅ Lot Rocket frontend wiring complete (Design Studio 3.0 ON)");
});
