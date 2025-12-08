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
