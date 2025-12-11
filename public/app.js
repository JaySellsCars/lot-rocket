// public/app.js – Lot Rocket frontend logic v2.5.9 (cleaned)
// Stable: theme toggle, Boost, calculators, side tools.
// Step 3: Creative Hub (Fabric) + Design Studio 3.5 (Konva) + Social Strip.

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Lot Rocket frontend loaded v2.5.9");
  const apiBase = "";

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = (el.scrollHeight + 4) + "px";
}

// Apply auto-grow behavior to ALL textareas
const allTextareas = document.querySelectorAll("textarea");
allTextareas.forEach((ta) => {
  autoResizeTextarea(ta); 
  ta.addEventListener("input", () => autoResizeTextarea(ta));
});

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
      if (facebookPost) {
        facebookPost.value = data.facebook || "";
        autoResizeTextarea(facebookPost);
      }
      if (instagramPost) {
        instagramPost.value = data.instagram || "";
        autoResizeTextarea(instagramPost);
      }
      if (tiktokPost) {
        tiktokPost.value = data.tiktok || "";
        autoResizeTextarea(tiktokPost);
      }
      if (linkedinPost) {
        linkedinPost.value = data.linkedin || "";
        autoResizeTextarea(linkedinPost);
      }
      if (twitterPost) {
        twitterPost.value = data.twitter || "";
        autoResizeTextarea(twitterPost);
      }
      if (textBlurb) {
        textBlurb.value = data.text || "";
        autoResizeTextarea(textBlurb);
      }
      if (marketplacePost) {
        marketplacePost.value = data.marketplace || "";
        autoResizeTextarea(marketplacePost);
      }
      if (hashtags) {
        hashtags.value = data.hashtags || "";
        autoResizeTextarea(hashtags);
      }


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
          if (ta) {
            ta.value = text;
            autoResizeTextarea(ta);
          }
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

  // ----------------------------------------------
  // RIGHT-SIDE FLOATING TOOL MODALS (DRAWERS)
  // ----------------------------------------------

  const TOOL_CONFIG = [
    ["objectionLauncher", "objectionModal"],
    ["calcLauncher", "calcModal"],
    ["paymentLauncher", "paymentModal"],
    ["incomeLauncher", "incomeModal"],
    ["workflowLauncher", "workflowModal"],
    ["messageLauncher", "messageModal"],
    ["askLauncher", "askModal"],
    ["carLauncher", "carModal"],
    ["imageLauncher", "imageModal"],
    ["videoLauncher", "videoModal"],
  ];

  function wireToolDrawer(launcherId, modalId, onOpen) {
    const launcher = document.getElementById(launcherId);
    const modal = document.getElementById(modalId);

    const haveLauncher = !!launcher;
    const haveModal = !!modal;
    console.log(
      "[LotRocket] modal pair:",
      launcherId,
      "launcher?",
      haveLauncher,
      "|",
      modalId,
      "modal?",
      haveModal
    );

    if (!launcher || !modal) return;

    // Try both possible close-button classes
    const closeBtn =
      modal.querySelector(".side-modal-close") ||
      modal.querySelector(".modal-close-btn");

    const backdropClose = (e) => {
      if (e.target === modal) {
        // click on dark backdrop closes
        modal.classList.add("hidden");
        modal.style.display = "none";
      }
    };

    launcher.addEventListener("click", () => {
      console.log("[LotRocket] CLICK from", launcherId);
      // open drawer
      modal.classList.remove("hidden");
      // force it visible even if CSS is confused
      modal.style.display = "flex";

      if (typeof onOpen === "function") onOpen();
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.style.display = "none";
      });
    }

    modal.addEventListener("click", backdropClose);
  }

  // Wire all tool drawers
    if (launcherId === "videoLauncher") {
      // When opening the video drawer, auto-fill context
      wireToolDrawer(launcherId, modalId, () => {
        if (videoContextField) {
          videoContextField.value = buildVideoContextFromKit();
          autoResizeTextarea(videoContextField);
        }
      });

    } else {
      wireToolDrawer(launcherId, modalId);
    }
  });




// ----------------------------------------------
// PAYMENT CALCULATOR (right-side modal)
// ----------------------------------------------
const paymentForm = document.getElementById("paymentForm");
const paymentPriceInput = document.getElementById("paymentPrice");
const paymentDownInput = document.getElementById("paymentDown");
const paymentRateInput = document.getElementById("paymentRate");
const paymentTermInput = document.getElementById("paymentTerm");
const paymentTaxInput = document.getElementById("paymentTax");
const paymentMonthlyEl = document.getElementById("paymentMonthly");
const paymentDetailsEl = document.getElementById("paymentDetails");


  function formatMoney(value) {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (
    paymentForm &&
    paymentPriceInput &&
    paymentDownInput &&
    paymentRateInput &&
    paymentTermInput &&
    paymentMonthlyEl &&
    paymentDetailsEl
  ) {
    paymentForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const price =
        parseFloat((paymentPriceInput.value || "").replace(/,/g, "")) || 0;
      const down =
        parseFloat((paymentDownInput.value || "").replace(/,/g, "")) || 0;
      const apr = parseFloat(paymentRateInput.value) || 0;
      const termYears = parseFloat(paymentTermInput.value) || 0;
      const taxRate = parseFloat(paymentTaxInput?.value) || 0;

      const taxAmount = price * (taxRate / 100);
      const amountFinanced = Math.max(price + taxAmount - down, 0);
      const n = Math.max(Math.round(termYears * 12), 1); // number of payments

      let payment = 0;
      if (apr <= 0) {
        // simple divide if 0% APR
        payment = amountFinanced / n;
      } else {
        const r = apr / 100 / 12; // monthly rate
        payment =
          amountFinanced * (r / (1 - Math.pow(1 + r, -1 * n)));
      }

      const safeApr = apr || 0;
      paymentMonthlyEl.textContent = formatMoney(payment || 0);

      paymentDetailsEl.textContent = `${termYears || 0} years • ${n} payments • Amount financed ${formatMoney(
        amountFinanced
      )} at ${safeApr.toFixed(2)}% APR (est., tax ${taxRate || 0}%).`;
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

  // ✅ success path – show coached objection
  if (objectionOutput) {
    objectionOutput.value =
      (data && data.output) ||
      (data && data.message) ||
      JSON.stringify(data, null, 2);
    autoResizeTextarea(objectionOutput);
  }
} catch (err) {
  console.error("Objection coach error:", err);
  if (objectionOutput) {
    objectionOutput.value =
      (err && err.message) ||
      "Lot Rocket couldn't coach that objection right now. Try again in a bit.";
    autoResizeTextarea(objectionOutput);
  }
}
}); // <-- keep this: closes the submit listener


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
          if (output) {
            output.value = msg;
            autoResizeTextarea(output);
          }
          return;

        }

        if (output) {
          output.value =
            "Lot Rocket hit a snag talking to AI. Try again in a moment.";
          autoResizeTextarea(output);
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
    if (videoScriptOutput) {
      videoScriptOutput.value = script;
      autoResizeTextarea(videoScriptOutput);
    }
    if (videoShotListOutput) {
      videoShotListOutput.value = shots;
      autoResizeTextarea(videoShotListOutput);
    }
    if (videoAIPromptOutput) {
      videoAIPromptOutput.value = aiPrompt;
      autoResizeTextarea(videoAIPromptOutput);
    }
    if (videoThumbPromptOutput) {
      videoThumbPromptOutput.value = thumbPrompt;
      autoResizeTextarea(videoThumbPromptOutput);
    }

    // Bottom under Design Studio
    if (videoScriptOutputBottom) {
      videoScriptOutputBottom.value = script;
      autoResizeTextarea(videoScriptOutputBottom);
    }
    if (videoShotListOutputBottom) {
      videoShotListOutputBottom.value = shots;
      autoResizeTextarea(videoShotListOutputBottom);
    }
    if (videoAIPromptOutputBottom) {
      videoAIPromptOutputBottom.value = aiPrompt;
      autoResizeTextarea(videoAIPromptOutputBottom);
    }
    if (videoThumbPromptOutputBottom) {
      videoThumbPromptOutputBottom.value = thumbPrompt;
      autoResizeTextarea(videoThumbPromptOutputBottom);
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
  const sendToDesignStudioBtn = document.getElementById("sendToDesignStudio");

  const tunerPreviewImg = document.getElementById("tunerPreviewImg");
  const tunerBrightness = document.getElementById("tunerBrightness");
  const tunerContrast = document.getElementById("tunerContrast");
  const tunerSaturation = document.getElementById("tunerSaturation");
  const autoEnhanceBtn = document.getElementById("autoEnhanceBtn");
  const aiCinematicBtn = document.getElementById("aiCinematicBtn");

  // Hidden canvas used to bake tuner edits into real pixels
  const hiddenTunerCanvas = document.createElement("canvas");
  const hiddenTunerCtx = hiddenTunerCanvas.getContext
    ? hiddenTunerCanvas.getContext("2d")
    : null;

  // Current filter used by both CSS preview and canvas drawing
  let currentTunerFilter = "";

  // NEW: Social-ready photo strip elements
  const socialCarousel = document.getElementById("socialCarousel");
  const openCanvasFromCarouselBtn = document.getElementById(
    "openCanvasFromCarousel"
  );
  const openDesignFromCarouselBtn = document.getElementById(
    "openDesignFromCarousel"
  );
  const revertSocialPhotoBtn = document.getElementById("revertSocialPhotoBtn");
  const downloadAllEditedBtn = document.getElementById("downloadAllEditedBtn");
  const sendAllToCanvasBtn = document.getElementById("sendAllToCanvas");

  // NEW: big preview + nav + status
  const socialCarouselPreviewImg = document.getElementById(
    "socialCarouselPreviewImg"
  );
  const socialPrevBtn = document.getElementById("socialPrevBtn");
  const socialNextBtn = document.getElementById("socialNextBtn");
  const socialCarouselStatus = document.getElementById("socialCarouselStatus");

  // Track which social-ready photo is “active” in the viewer
  let socialCurrentIndex = 0;

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

  // Social-ready photos state: [{ url, selected, originalUrl, locked }]
  let socialReadyPhotos = [];
    // --------------------------------------------------
  // STEP 3 → SEND SELECTED PHOTO(S) INTO DESIGN STUDIO
  // --------------------------------------------------
  if (sendToDesignStudioBtn) {
    sendToDesignStudioBtn.addEventListener("click", () => {
      // 1) Try to grab the selected Creative Lab thumb
      let urls = [];

      if (creativeThumbGrid) {
        const selectedThumbs = creativeThumbGrid.querySelectorAll(
          ".creative-thumb.selected"
        );

        if (selectedThumbs.length) {
          selectedThumbs.forEach((img) => {
            if (img.src) urls.push(img.src);
          });
        }
      }

      // 2) If nothing explicitly selected, fall back to localCreativePhotos
      if (!urls.length && Array.isArray(localCreativePhotos)) {
        urls = localCreativePhotos.slice(0, 24);
      }

      // 3) If still nothing, fall back to dealer photos
      if (!urls.length && dealerPhotos && dealerPhotos.length) {
        urls = dealerPhotos.map((p) => p.src).slice(0, 24);
      }

      if (!urls.length) {
        alert(
          "Load or select a photo in the Creative Lab first before sending to Design Studio."
        );
        return;
      }

      // 4) Push into Design Studio (auto-opens overlay + drops onto canvas)
      pushUrlsIntoDesignStudio(urls);
    });
  }
// ----------------------------------------------------
// STEP 1 → SEND TOP PHOTOS INTO CREATIVE LAB + STRIP
// (Hard-wired: only the orange Step-1 button)
// ----------------------------------------------------
const step1SendTopBtn = document.getElementById("sendTopPhotosBtn");

if (step1SendTopBtn) {
  console.log(
    "[LotRocket] wiring Step 1 top-photos button:",
    step1SendTopBtn.id
  );

  step1SendTopBtn.addEventListener("click", () => {
    console.log("[LotRocket] Step 1 Send Top Photos clicked");

    if (!dealerPhotos || !dealerPhotos.length) {
      alert("Boost a listing first so Lot Rocket can grab photos.");
      return;
    }

    const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
    const chosen = (selected.length ? selected : dealerPhotos.map((p) => p.src))
      .slice(0, 12);

    if (!chosen.length) {
      alert("No photos available to send.");
      return;
    }

    step1SendTopBtn.disabled = true;
    step1SendTopBtn.classList.add("loading");

    chosen.forEach((url) => {
      if (Array.isArray(localCreativePhotos)) localCreativePhotos.push(url);
      if (typeof addCreativeThumb === "function") addCreativeThumb(url);


      if (tunerPreviewImg && !tunerPreviewImg.src) {
        tunerPreviewImg.src = url;
        if (typeof applyTunerFilters === "function") applyTunerFilters();
      }
    });

    if (typeof renderSocialCarousel === "function") {
      renderSocialCarousel();
    }

    step1SendTopBtn.classList.remove("loading");
    step1SendTopBtn.classList.add("success");

    setTimeout(() => {
      step1SendTopBtn.classList.remove("success");
      step1SendTopBtn.disabled = false;
    }, 900);
  });
} else {
  console.warn(
    "[LotRocket] Step 1 Send Top Photos button NOT FOUND. Check id='sendTopPhotosBtn'."
  );
}


  // ---------- SOCIAL-READY STRIP HELPERS + DOWNLOAD ----------

  // Small utility to actually trigger a browser download
// Small helper: always try to use our proxy so downloads don't
// hijack the current tab when dealer photos are cross-origin.
function triggerSocialDownload(url, index) {
  if (!url) return;

  // getProxiedImageUrl is defined later in this file; function
  // declarations are hoisted so it's safe to call here.
  let safeUrl = url;
  try {
    if (typeof getProxiedImageUrl === "function") {
      safeUrl = getProxiedImageUrl(url);
    }
  } catch (e) {
    console.warn("[LotRocket] getProxiedImageUrl failed, using raw URL", e);
  }

  const a = document.createElement("a");
  a.href = safeUrl;
  a.download = `lot-rocket-photo-${(index ?? 0) + 1}.jpg`;
  a.rel = "noopener";

  document.body.appendChild(a);
  a.click();
  a.remove();
}


  // Download the "current" social-ready image (or by explicit index)
  function downloadSocialImage(index) {
    if (!socialReadyPhotos.length) return;

    let idx =
      typeof index === "number"
        ? index
        : socialCurrentIndex || 0;

    if (idx < 0) idx = 0;
    if (idx >= socialReadyPhotos.length) {
      idx = socialReadyPhotos.length - 1;
    }

    const photo = socialReadyPhotos[idx];
    if (!photo || !photo.url) return;

    triggerSocialDownload(photo.url, idx);
  }

  // Expose for inline onclicks in HTML if needed
  window.downloadSocialImage = downloadSocialImage;

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

  // One global cap so all Step 3 areas behave the same
  const MAX_STEP3_PHOTOS = 24;

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

  img.title =
    "Click to select/deselect. Double-click to send a tuned copy into the social strip.";

  // ✅ CLICK = toggle selection (multi-select)
  img.addEventListener("click", () => {
    img.classList.toggle("selected");

    // Always show this image in the tuner when clicked
    if (tunerPreviewImg) {
      tunerPreviewImg.src = url;
      applyTunerFilters();
    }
  });

  // ✅ DOUBLE-CLICK = send edited copy to Social-ready strip
  img.addEventListener("dblclick", async () => {
    const editedUrl = await buildEditedDataUrl(url);
    addPhotoToSocialReady(editedUrl);
  });

  creativeThumbGrid.appendChild(img);

  // 🔢 Keep only the most recent MAX_STEP3_PHOTOS thumbs visible
  const thumbs = creativeThumbGrid.querySelectorAll(".creative-thumb");
  if (thumbs.length > MAX_STEP3_PHOTOS) {
    const extra = thumbs.length - MAX_STEP3_PHOTOS;
    for (let i = 0; i < extra; i++) {
      creativeThumbGrid.removeChild(thumbs[i]);
    }
  }
}









async function buildEditedDataUrl(src) {
  if (!src) return src;
  if (!hiddenTunerCanvas || !hiddenTunerCtx) return src;

  return new Promise((resolve) => {
    const img = new Image();

    const isSameOrigin =
      src.startsWith(window.location.origin) || src.startsWith("blob:");
    if (isSameOrigin) {
      img.crossOrigin = "anonymous";
    }

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
        console.warn(
          "[LotRocket] Canvas tainted, falling back to original URL.",
          err
        );
        resolve(src);
      }
    };

    img.onerror = (err) => {
      console.warn(
        "[LotRocket] Failed to load image for tuner, falling back:",
        err
      );
      resolve(src);
    };

    img.src = src;
  });
}


  // ------------ SOCIAL-READY STRIP HELPERS + CAROUSEL ------------

  function addPhotoToSocialReady(url) {
    if (!url) return;

    // If it already exists, just select it and move preview there
    const existingIndex = socialReadyPhotos.findIndex((p) => p.url === url);
    if (existingIndex !== -1) {
      socialReadyPhotos = socialReadyPhotos.map((p, idx) => ({
        ...p,
        selected: idx === existingIndex ? true : p.selected,
      }));
      socialCurrentIndex = existingIndex;
      renderSocialCarousel();
      return;
    }
// Helper: force preview to show a freshly added design image
function addDesignImageToSocialStrip(url) {
  if (!url) return;
  addPhotoToSocialReady(url);
  // make sure the preview is pointed at the newest image
  socialCurrentIndex = socialReadyPhotos.length - 1;
  renderSocialCarousel();
}

    // Push new photo, mark selected (unlocked by default)
    socialReadyPhotos.push({
      url,
      originalUrl: url, // remember the first/original version
      selected: true,
      locked: false,
    });

    // Optional cap (keep latest MAX_STEP3_PHOTOS – 24)
    const MAX_SOCIAL = MAX_STEP3_PHOTOS;
    if (socialReadyPhotos.length > MAX_SOCIAL) {
      socialReadyPhotos = socialReadyPhotos.slice(
        socialReadyPhotos.length - MAX_SOCIAL
      );
    }

    // Newly added is last
    socialCurrentIndex = socialReadyPhotos.length - 1;

    // Re-render strip + preview
    renderSocialCarousel();
  }

  function replaceCurrentSocialImage(newUrl) {
    if (!newUrl) return;

    if (!socialReadyPhotos.length) {
      addPhotoToSocialReady(newUrl);
      return;
    }

    const idx = socialCurrentIndex;
    if (idx < 0 || idx >= socialReadyPhotos.length) {
      addPhotoToSocialReady(newUrl);
      return;
    }

    const photo = socialReadyPhotos[idx];
    if (!photo) {
      addPhotoToSocialReady(newUrl);
      return;
    }

    photo.url = newUrl;
    photo.selected = true;

    renderSocialCarousel();
  }

  function updateSocialPreview() {
    if (!socialCarouselPreviewImg) return;

    if (!socialReadyPhotos.length) {
      socialCarouselPreviewImg.src = "";
      socialCarouselPreviewImg.alt = "";
      if (socialCarouselStatus) {
        socialCarouselStatus.textContent =
          "No social-ready photos yet. Double-click a photo above to add it.";
      }
      return;
    }

    // Clamp index
    if (socialCurrentIndex < 0) {
      socialCurrentIndex = socialReadyPhotos.length - 1;
    }
    if (socialCurrentIndex >= socialReadyPhotos.length) {
      socialCurrentIndex = 0;
    }

    const current = socialReadyPhotos[socialCurrentIndex];
    socialCarouselPreviewImg.src = current.url;
    socialCarouselPreviewImg.alt = `Social-ready photo ${
      socialCurrentIndex + 1
    }`;

    if (socialCarouselStatus) {
      const selectedCount = socialReadyPhotos.filter((p) => p.selected).length;
      const total = socialReadyPhotos.length;

      let label = `${socialCurrentIndex + 1} of ${total}`;
      if (selectedCount && selectedCount !== total) {
        label += ` • ${selectedCount} selected`;
      }
      socialCarouselStatus.textContent = label;
    }
  }

  function renderSocialCarousel() {
    if (!socialCarousel) return;
    socialCarousel.innerHTML = "";

    if (!socialReadyPhotos.length) {
      const note = document.createElement("p");
      note.className = "small-note";
      note.textContent =
        "Double-click a photo in the grid above to mark it social-ready. Use the trash icon here to remove.";
      socialCarousel.appendChild(note);

      updateSocialPreview();
      return;
    }

    socialReadyPhotos.forEach((photo, index) => {
      // Ensure every photo has a locked flag
      if (typeof photo.locked !== "boolean") {
        photo.locked = false;
      }

      const item = document.createElement("div");
      item.className =
        "social-carousel-item" +
        (photo.selected ? " social-carousel-item-selected" : "") +
        (photo.locked ? " social-carousel-item-locked" : "");
      item.dataset.index = String(index);

      const img = document.createElement("img");
      img.src = photo.url;
      img.alt = `Social-ready photo ${index + 1}`;
      img.loading = "lazy";
      img.className = "social-carousel-img";
      img.title =
        "Click to select / deselect. Double-click the card or use the trash icon to remove.";

      // Controls bar (lock + trash)
      const controls = document.createElement("div");
      controls.className = "social-carousel-controls";

      // 🔒 Lock / unlock button
      const lockBtn = document.createElement("button");
      lockBtn.type = "button";
      lockBtn.className = "social-carousel-control-btn lock-btn";
      lockBtn.title = photo.locked
        ? "Unlock this photo so it can be removed"
        : "Lock this photo so it can't be removed";
      lockBtn.textContent = photo.locked ? "🔒" : "🔓";

      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(item.dataset.index || "0");
        const p = socialReadyPhotos[idx];
        if (!p) return;
        p.locked = !p.locked;
        renderSocialCarousel();
      });

      // 🗑️ Delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "social-carousel-control-btn delete-btn";
      deleteBtn.title = "Remove this photo from Step 3";
      deleteBtn.textContent = "🗑️";

      function removePhotoWithAnimation() {
        const idx = Number(item.dataset.index || "0");
        const p = socialReadyPhotos[idx];
        if (!p) return;

        if (p.locked) {
          alert(
            "This photo is locked. Unlock it first if you want to remove it."
          );
          return;
        }

        // Animation class
        item.classList.add("social-carousel-item-removing");

        setTimeout(() => {
          socialReadyPhotos.splice(idx, 1);

          if (socialCurrentIndex >= socialReadyPhotos.length) {
            socialCurrentIndex = socialReadyPhotos.length - 1;
          }
          if (socialCurrentIndex < 0) socialCurrentIndex = 0;

          renderSocialCarousel();
        }, 160); // keep in sync with CSS transition
      }

      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removePhotoWithAnimation();
      });

      controls.appendChild(lockBtn);
      controls.appendChild(deleteBtn);

      item.appendChild(img);
      item.appendChild(controls);
      socialCarousel.appendChild(item);

      // 🖱️ Single-click = select + make active preview
      item.addEventListener("click", (e) => {
        // Ignore clicks directly on control buttons (handled above)
        if (e.target.closest(".social-carousel-control-btn")) return;

        const idx = Number(item.dataset.index || "0");
        socialReadyPhotos[idx].selected = !socialReadyPhotos[idx].selected;
        socialCurrentIndex = idx;
        renderSocialCarousel();
      });

      // 🖱️ Double-click anywhere on the card = quick delete
      item.addEventListener("dblclick", (e) => {
        e.preventDefault();
        removePhotoWithAnimation();
      });
    });

    // Refresh preview
    updateSocialPreview();
  }

  // Prev/Next buttons for the big preview
  if (socialPrevBtn) {
    socialPrevBtn.addEventListener("click", () => {
      if (!socialReadyPhotos.length) return;
      socialCurrentIndex =
        (socialCurrentIndex - 1 + socialReadyPhotos.length) %
        socialReadyPhotos.length;
      updateSocialPreview();
    });
  }

  if (socialNextBtn) {
    socialNextBtn.addEventListener("click", () => {
      if (!socialReadyPhotos.length) return;
      socialCurrentIndex =
        (socialCurrentIndex + 1) % socialReadyPhotos.length;
      updateSocialPreview();
    });
  }

  function handleCreativeFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    files.forEach((file) => {
      if (!file || !file.type || !file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      localCreativePhotos.push(url);

      // Keep only latest MAX_STEP3_PHOTOS in state
      if (localCreativePhotos.length > MAX_STEP3_PHOTOS) {
        localCreativePhotos = localCreativePhotos.slice(
          localCreativePhotos.length - MAX_STEP3_PHOTOS
        );
      }

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

  function getActivePhotoUrlForCinematic() {
    if (tunerPreviewImg && tunerPreviewImg.src) {
      return tunerPreviewImg.src;
    }

    if (creativeThumbGrid) {
      const selected = creativeThumbGrid.querySelector(
        ".creative-thumb.selected"
      );
      if (selected && selected.src) return selected.src;
    }

    if (localCreativePhotos && localCreativePhotos.length) {
      return localCreativePhotos[0];
    }

    if (dealerPhotos && dealerPhotos.length) {
      return dealerPhotos[0].src;
    }

    return "";
  }

  if (aiCinematicBtn) {
    aiCinematicBtn.addEventListener("click", async () => {
      const src = getActivePhotoUrlForCinematic();
      if (!src) {
        alert("Pick or load a photo in the Creative Lab first.");
        return;
      }

      const originalLabel = aiCinematicBtn.textContent;
      aiCinematicBtn.disabled = true;
      aiCinematicBtn.textContent = "AI Enhancing…";

      try {
        const res = await fetch(apiBase + "/api/process-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrls: [src] }),
        });

        const data = await res.json();

        if (!res.ok) {
          const msg =
            (data && data.error) ||
            `AI photo enhancement failed (HTTP ${res.status}).`;
          console.error("❌ /api/process-photos error:", msg, data);
          alert(msg);
          return;
        }

        const processed =
          data.editedPhotos &&
          data.editedPhotos[0] &&
          (data.editedPhotos[0].processedUrl ||
            data.editedPhotos[0].originalUrl);

        const finalUrl = processed || src;

        // 1) Update tuner preview
        if (tunerPreviewImg) {
          tunerPreviewImg.src = finalUrl;
          if (tunerBrightness) tunerBrightness.value = "100";
          if (tunerContrast) tunerContrast.value = "100";
          if (tunerSaturation) tunerSaturation.value = "100";
          applyTunerFilters();
        }

        // 2) Update creative thumb grid so you SEE the new AI version
        if (creativeThumbGrid) {
          let updated = false;

          const selectedThumb = creativeThumbGrid.querySelector(
            ".creative-thumb.selected"
          );
          if (selectedThumb) {
            selectedThumb.src = finalUrl;
            updated = true;
          } else {
            const thumbs =
              creativeThumbGrid.querySelectorAll(".creative-thumb");
            thumbs.forEach((imgEl) => {
              if (!updated && imgEl.src === src) {
                imgEl.src = finalUrl;
                updated = true;
              }
            });
          }
        }

        // 3) Update localCreativePhotos state
        localCreativePhotos = (localCreativePhotos || []).map((u) =>
          u === src ? finalUrl : u
        );

        // 4) Add into Social-ready strip (helper handles push + cap + preview)
        addPhotoToSocialReady(finalUrl);

        // 5) Also add as a fresh thumb if it's not already there
        const alreadyInThumbs =
          creativeThumbGrid &&
          !!Array.from(
            creativeThumbGrid.querySelectorAll(".creative-thumb")
          ).find((imgEl) => imgEl.src === finalUrl);

        if (!alreadyInThumbs) {
          addCreativeThumb(finalUrl);
        }
      } catch (err) {
        console.error("❌ AI Cinematic network error:", err);
        alert(
          "Lot Rocket hit a snag talking to the AI photo editor. Try again in a moment."
        );
      } finally {
        aiCinematicBtn.disabled = false;
        aiCinematicBtn.textContent =
          originalLabel || "AI Cinematic Background";
      }
    });
  }

  // ==================================================
  // DESIGN STUDIO 3.5 (Konva + Templates + Save/Load)
  // ==================================================

const designStudioOverlay = document.getElementById("designStudioOverlay");
const designLauncher = document.getElementById("designLauncher");

  document.getElementById("sendToDesignStudio") ||
  document.getElementById("designLauncher");
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

  const saveDesignBtn = document.getElementById("saveDesignBtn");
  const loadDesignBtn = document.getElementById("loadDesignBtn");

  const templatePaymentBtn = document.getElementById("templatePayment");
  const templateArrivalBtn = document.getElementById("templateArrival");
  const templateSaleBtn = document.getElementById("templateSale");

  const studioPhotoTray = document.getElementById("studioPhotoTray");

  let studioStage = null;
  let studioLayer = null;
  let studioSelectedNode = null;
  let studioTransformer = null;
  let studioHistory = [];
  let studioHistoryIndex = -1;
  let studioUIWired = false;
  let studioDnDWired = false;
  let studioAvailablePhotos = [];

function initDesignStudio() {
  const container = document.getElementById("konvaStageContainer");
  if (!container || !window.Konva) return;

  const width = container.clientWidth || 1080;
  const height = container.clientHeight || width;

  studioStage = new Konva.Stage({
    container: "konvaStageContainer",
    width,
    height,
  });

  studioLayer = new Konva.Layer();
  studioStage.add(studioLayer);

  setStudioBackground(BRAND.dark);

  studioTransformer = new Konva.Transformer({
    rotateEnabled: true,
    enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"],
    anchorSize: 10,
    borderStroke: "#e5e7eb",
    anchorFill: BRAND.primary,
    anchorStroke: BRAND.primary,
    anchorCornerRadius: 4,
  });
  studioLayer.add(studioTransformer);

  studioStage.on("click tap", (e) => {
    const target = e.target;
    if (
      target === studioStage ||
      target === studioLayer ||
      target.name() === "BackgroundLayer"
    ) {
      selectStudioNode(null);
    }
  });

  wireDesignStudioUI();
  attachEventsToAllNodes();
  rebuildLayersList();
  saveStudioHistory();
}

// --------------------------------------------------
// DESIGN STUDIO → STEP 3 (SOCIAL-READY STRIP + CREATIVE LAB)
// --------------------------------------------------
const sendDesignToStripBtn = document.getElementById("studioToStep3Btn");

if (sendDesignToStripBtn) {
  sendDesignToStripBtn.addEventListener("click", async () => {
    console.log("▶️ Send to Step 3 clicked");

    try {
      if (!studioStage) {
        console.warn("⚠️ Design Studio stage not initialized.");
        return;
      }

      // 1) Export Konva stage to PNG
      let dataUrl;
      try {
        dataUrl = studioStage.toDataURL({ pixelRatio: 2 });
      } catch (e) {
        console.error("❌ Konva toDataURL failed:", e);
        alert(
          "Design export failed because one of the images on the canvas does not allow download. Try using only dealer/Creative Lab images."
        );
        return;
      }

      // 2) Convert dataURL → Blob → object URL
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      // 3) Send into the Social-Ready strip / focus preview
      if (typeof addDesignImageToSocialStrip === "function") {
        // if you have a “design specific” helper, use it
        addDesignImageToSocialStrip(objectUrl);
      } else if (typeof addPhotoToSocialReady === "function") {
        // otherwise fall back to the generic helper
        addPhotoToSocialReady(objectUrl);
      } else {
        console.warn(
          "No social-strip helper defined; design image cannot be added to strip."
        );
      }

      // 4) ALSO mirror the design into Step 3 Creative Lab thumbs
      //    so it behaves like any other edited photo.
      if (creativeThumbGrid) {
        // track it in localCreativePhotos (with global cap logic elsewhere)
        localCreativePhotos.push(objectUrl);
        addCreativeThumb(objectUrl);

        // if tuner preview is empty, show this design there too
        if (tunerPreviewImg && !tunerPreviewImg.src) {
          tunerPreviewImg.src = objectUrl;
          applyTunerFilters();
        }
      }

      console.log(
        "✅ Design sent to Step 3 social strip + Creative Lab from Design Studio:",
        objectUrl
      );
    } catch (err) {
      console.error("❌ Failed to send design to Step 3:", err);
    }
  });
}









  function saveStudioHistory() {
    if (!studioStage) return;
    const json = studioStage.toJSON();
    studioHistory = studioHistory.slice(0, studioHistoryIndex + 1);
    studioHistory.push(json);
    studioHistoryIndex = studioHistory.length - 1;
  }

  function restoreStudioFromHistory(index) {
    if (!window.Konva) return;
    if (!studioHistory.length) return;
    if (index < 0 || index >= studioHistory.length) return;

    const container =
      (studioStage && studioStage.container()) ||
      document.getElementById("konvaStageContainer");
    if (!container) return;

    const json = studioHistory[index];

    if (studioStage) {
      studioStage.destroy();
    }

    studioStage = Konva.Node.create(json, container);
    const layers = studioStage.getLayers();
    studioLayer = layers[0] || new Konva.Layer();
    if (!layers.length) studioStage.add(studioLayer);

    studioTransformer =
      studioStage.findOne("Transformer") ||
      new Konva.Transformer({
        rotateEnabled: true,
        enabledAnchors: [
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
        ],
        anchorSize: 10,
        borderStroke: "#e5e7eb",
        anchorFill: BRAND.primary,
        anchorStroke: BRAND.primary,
        anchorCornerRadius: 4,
      });
    if (!studioTransformer.getStage()) {
      studioLayer.add(studioTransformer);
    }

    studioSelectedNode = null;
    studioHistoryIndex = index;

    attachEventsToAllNodes();
    rebuildLayersList();
    wireDesignStudioUI();
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

  function selectStudioNode(node) {
    studioSelectedNode = node;

    if (studioTransformer && studioLayer) {
      if (node) {
        studioTransformer.nodes([node]);
        studioTransformer.visible(true);
      } else {
        studioTransformer.nodes([]);
        studioTransformer.visible(false);
      }
      studioLayer.batchDraw();
    }

    rebuildLayersList();
    syncLayerControlsWithSelection();
  }

  function rebuildLayersList() {
    if (!layersList || !studioLayer) return;
    layersList.innerHTML = "";
    const nodes = studioLayer.getChildren();

    nodes.forEach((node) => {
      if (node.name() === "BackgroundLayer") return;
      if (node.getClassName && node.getClassName() === "Transformer") return;

      const li = document.createElement("li");
      li.className = "layer-item";
      li.textContent = node.name() || node.getClassName();
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

  function attachEventsToAllNodes() {
    if (!studioLayer) return;
    studioLayer.getChildren().forEach((node) => {
      if (node.name() === "BackgroundLayer") return;
      if (node.getClassName && node.getClassName() === "Transformer") return;
      attachNodeInteractions(node);
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
      fill: BRAND.textLight,
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
      fill: BRAND.light,
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

  function setStudioBackground(color = BRAND.dark) {
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

  // CORS-safe wrapper for images used in Design Studio.
  // Routes external URLs through our /api/proxy-image endpoint.
  function getProxiedImageUrl(rawUrl) {
    if (!rawUrl) return rawUrl;

    try {
      const u = new URL(rawUrl, window.location.origin);

      // Same-origin, blob: or data: URLs do NOT need proxying.
      if (
        u.origin === window.location.origin ||
        u.protocol === "blob:" ||
        u.protocol === "data:"
      ) {
        return rawUrl;
      }

      // Already going through our proxy
      if (u.pathname.startsWith("/api/proxy-image")) {
        return rawUrl;
      }

      // Everything else → send through backend proxy
      return `/api/proxy-image?url=${encodeURIComponent(u.toString())}`;
    } catch (e) {
      console.warn("[DesignStudio] Could not parse URL for proxy:", rawUrl, e);
      return rawUrl;
    }
  }

function addStudioImageFromUrl(url, asBackground = false) {
  if (!studioLayer || !studioStage || !url) return;

  const img = new Image();

  // allow CORS-safe pixel access
  img.crossOrigin = "anonymous";

  // route external images through our backend proxy
  const safeUrl = getProxiedImageUrl(url);

  img.onload = () => {
    const fitRatio =
      Math.min(
        studioStage.width() / img.width,
        studioStage.height() / img.height
      ) || 1;

    const finalRatio = fitRatio * 0.9;
    const w = img.width * finalRatio;
    const h = img.height * finalRatio;

    // ✅ If this is a normal photo (NOT background),
    // always keep ONLY ONE "Photo Layer" on the canvas.
    if (!asBackground) {
      studioLayer.getChildren().forEach((child) => {
        if (child.name && child.name() === "Photo Layer") {
          child.destroy();
        }
      });
    }

    const node = new Konva.Image({
      image: img,
      x: studioStage.width() / 2,
      y: studioStage.height() / 2,
      width: w,
      height: h,
      offsetX: w / 2,
      offsetY: h / 2,
      draggable: true,
      name: asBackground ? "Background Photo" : "Photo Layer",
    });

    attachNodeInteractions(node);
    studioLayer.add(node);

    if (asBackground) {
      // push background under everything
      node.moveToBottom();
      const bgRect = studioLayer.findOne(".BackgroundLayer");
      if (bgRect) bgRect.moveToBottom();
    }

    studioLayer.draw();
    selectStudioNode(node);
    saveStudioHistory();
  };

  img.onerror = (err) => {
    console.error("[DesignStudio] Failed to load image:", safeUrl, err);
  };

  img.src = safeUrl;
}






  function exportStudioAsPng() {
    if (!studioStage) return;
    try {
      const dataURL = studioStage.toDataURL({ pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataURL;
      a.download = "lot-rocket-design.png";
      a.click();
    } catch (err) {
      console.error("Export PNG error (likely CORS):", err);
      alert(
        "Browser blocked exporting this design (CORS). Some dealer images may not export."
      );
    }
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

  function clearStudioNonBackgroundNodes() {
    if (!studioLayer) return;
    studioLayer.getChildren().forEach((node) => {
      if (node.name() === "BackgroundLayer") return;
      if (node.getClassName && node.getClassName() === "Transformer") return;
      node.destroy();
    });
    studioLayer.draw();
    studioSelectedNode = null;
    if (studioTransformer) {
      studioTransformer.nodes([]); 
      studioTransformer.visible(false);
    }
  }

  function applyTemplate(type) {
    if (!studioStage || !studioLayer) {
      initDesignStudio();
    }
    if (!studioStage || !studioLayer) return;

    clearStudioNonBackgroundNodes();

    const cx = studioStage.width() / 2;
    const cy = studioStage.height() / 2;

    if (type === "payment") {
      const barHeight = 220;
      const barWidth = studioStage.width() * 0.95;

      const bar = new Konva.Rect({
        x: cx,
        y: studioStage.height() - barHeight / 2 - 20,
        width: barWidth,
        height: barHeight,
        fill: BRAND.primary,
        cornerRadius: 32,
        offsetX: barWidth / 2,
        offsetY: barHeight / 2,
        name: "Payment Banner",
        draggable: true,
      });

      attachNodeInteractions(bar);
      studioLayer.add(bar);

      const priceText = new Konva.Text({
        x: cx,
        y: studioStage.height() - barHeight + 40,
        text: "ONLY $___ / MO",
        fontFamily: "system-ui, sans-serif",
        fontSize: 72,
        fontStyle: "bold",
        align: "center",
        fill: BRAND.textLight,
        name: "Payment Headline",
        draggable: true,
      });
      priceText.offsetX(priceText.width() / 2);
      attachNodeInteractions(priceText);
      studioLayer.add(priceText);

      const detailsText = new Konva.Text({
        x: cx,
        y: studioStage.height() - barHeight / 2 + 30,
        text: "With $___ down | O.A.C.",
        fontFamily: "system-ui, sans-serif",
        fontSize: 32,
        align: "center",
        fill: BRAND.textLight,
        name: "Payment Details",
        draggable: true,
      });
      detailsText.offsetX(detailsText.width() / 2);
      attachNodeInteractions(detailsText);
      studioLayer.add(detailsText);
    } else if (type === "arrival") {
      const barHeight = 150;
      const barWidth = studioStage.width() * 0.9;

      const bar = new Konva.Rect({
        x: cx,
        y: barHeight / 2 + 30,
        width: barWidth,
        height: barHeight,
        fill: BRAND.secondary,
        cornerRadius: 28,
        offsetX: barWidth / 2,
        offsetY: barHeight / 2,
        name: "Arrival Banner",
        draggable: true,
      });
      attachNodeInteractions(bar);
      studioLayer.add(bar);

      const headline = new Konva.Text({
        x: cx,
        y: bar.y(),
        text: "JUST ARRIVED",
        fontFamily: "system-ui, sans-serif",
        fontSize: 72,
        fontStyle: "bold",
        align: "center",
        fill: BRAND.textLight,
        name: "Arrival Headline",
        draggable: true,
      });
      headline.offsetX(headline.width() / 2);
      attachNodeInteractions(headline);
      studioLayer.add(headline);

      const sub = new Konva.Text({
        x: cx,
        y: bar.y() + 70,
        text: "Be the first to drive it.",
        fontFamily: "system-ui, sans-serif",
        fontSize: 32,
        align: "center",
        fill: BRAND.textLight,
        name: "Arrival Subline",
        draggable: true,
      });
      sub.offsetX(sub.width() / 2);
      attachNodeInteractions(sub);
      studioLayer.add(sub);
    } else if (type === "sale") {
      const sold = new Konva.Text({
        x: cx,
        y: cy,
        text: "SOLD",
        fontFamily: "system-ui, sans-serif",
        fontSize: 180,
        fontStyle: "bold",
        fill: BRAND.textLight,
        stroke: "#DC2626",
        strokeWidth: 8,
        shadowColor: "black",
        shadowBlur: 10,
        shadowOffset: { x: 4, y: 4 },
        shadowOpacity: 0.5,
        rotation: -18,
        align: "center",
        name: "Sold Stamp",
        draggable: true,
      });
      sold.offsetX(sold.width() / 2);
      sold.offsetY(sold.height() / 2);
      attachNodeInteractions(sold);
      studioLayer.add(sold);

      const congrats = new Konva.Text({
        x: cx,
        y: cy + 160,
        text: "Congrats [Customer Name]!",
        fontFamily: "system-ui, sans-serif",
        fontSize: 44,
        align: "center",
        fill: BRAND.textLight,
        name: "Sold Congrats",
        draggable: true,
      });
      congrats.offsetX(congrats.width() / 2);
      attachNodeInteractions(congrats);
      studioLayer.add(congrats);
    } else {
      addStudioText();
    }

    studioLayer.draw();
    rebuildLayersList();
    saveStudioHistory();
  }

  function saveDesignToLocal() {
    if (!studioStage) {
      alert("Open Design Studio first, then save.");
      return;
    }
    try {
      const json = studioStage.toJSON();
      localStorage.setItem(STUDIO_STORAGE_KEY, json);
      alert("Design saved on this device.");
    } catch (err) {
      console.error("Error saving design:", err);
      alert("Could not save this design. Check storage permissions.");
    }
  }

function loadDesignFromLocal() {
  const stored = localStorage.getItem(STUDIO_STORAGE_KEY);
  if (!stored) {
    alert("No saved design found yet.");
    return;
  }
  if (!window.Konva) {
    alert("Design Studio is not available (Konva missing).");
    return;
  }
  const container = document.getElementById("konvaStageContainer");
  if (!container) {
    alert("Design Studio area not found.");
    return;
  }

  try {
    if (studioStage) {
      studioStage.destroy();
    }

    studioStage = Konva.Node.create(stored, container);
    const layers = studioStage.getLayers();
    studioLayer = layers[0] || new Konva.Layer();
    if (!layers.length) studioStage.add(studioLayer);

    studioTransformer =
      studioStage.findOne("Transformer") ||
      new Konva.Transformer({
        rotateEnabled: true,
        enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"],
        anchorSize: 10,
        borderStroke: "#e5e7eb",
        anchorFill: BRAND.primary,
        anchorStroke: BRAND.primary,
        anchorCornerRadius: 4,
      });

    if (!studioTransformer.getStage()) {
      studioLayer.add(studioTransformer);
    }

    studioSelectedNode = null;
    studioHistory = [stored];
    studioHistoryIndex = 0;

    attachEventsToAllNodes();
    rebuildLayersList();
    wireDesignStudioUI();
    saveStudioHistory();

    if (designStudioOverlay) {
      designStudioOverlay.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Error loading design:", err);
    alert("Could not load saved design. Save a new one and try again.");
  }
}


  function wireDesignStudioUI() {
    if (studioUIWired) return;
    studioUIWired = true;

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
        setStudioBackground(BRAND.dark)
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

        if (studioTransformer) {
          studioTransformer.nodes([]);
          studioTransformer.visible(false);
        }

        studioLayer.draw();
        rebuildLayersList();
        saveStudioHistory();
      });
    }
  }

  function gatherImageUrlsForStudios() {
    const urls = new Set();

    // 1) Creative Lab thumbs
    if (creativeThumbGrid) {
      creativeThumbGrid.querySelectorAll("img").forEach((img) => {
        if (img.src) urls.add(img.src);
      });
    }

    // 2) Social-ready strip
    if (Array.isArray(socialReadyPhotos) && socialReadyPhotos.length) {
      socialReadyPhotos.forEach((p) => {
        if (p && p.url) urls.add(p.url);
      });
    }

    // 3) Dealer photos (selected first, then all)
    if (dealerPhotos && dealerPhotos.length) {
      const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
      const fallback = dealerPhotos.map((p) => p.src);
      (selected.length ? selected : fallback).forEach((u) => urls.add(u));
    }

    return Array.from(urls).slice(0, 24);
  }

  function renderStudioPhotoTray() {
    if (!studioPhotoTray) return;
    studioPhotoTray.innerHTML = "";

    if (!studioAvailablePhotos || !studioAvailablePhotos.length) {
      const msg = document.createElement("p");
      msg.className = "small-note";
      msg.textContent =
        "No photos loaded yet. Boost a listing or load/edit photos in the Creative Lab, then open Design Studio.";
      studioPhotoTray.appendChild(msg);
      return;
    }

    studioAvailablePhotos.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Design photo";
      img.loading = "lazy";
      img.className = "studio-photo-thumb";
      img.draggable = true;

      // CLICK = drop onto canvas
      img.addEventListener("click", (e) => {
        if (e.shiftKey) {
          addStudioImageFromUrl(url, true); // shift+click = background
        } else {
          addStudioImageFromUrl(url, false);
        }
      });

      // DOUBLE-CLICK = force background
      img.addEventListener("dblclick", () => {
        addStudioImageFromUrl(url, true);
      });

      // Optional drag → drop into canvas
      img.addEventListener("dragstart", (e) => {
        try {
          e.dataTransfer.setData("text/plain", url);
        } catch (_) {}
      });

      studioPhotoTray.appendChild(img);
    });

    const konvaContainer = document.getElementById("konvaStageContainer");
    if (konvaContainer && !studioDnDWired) {
      studioDnDWired = true;

      konvaContainer.addEventListener("dragover", (e) => {
        e.preventDefault();
      });

      konvaContainer.addEventListener("drop", (e) => {
        e.preventDefault();
        let url = "";
        try {
          url = e.dataTransfer.getData("text/plain");
        } catch (_) {}

        if (url) addStudioImageFromUrl(url, false);
      });
    }
  }

  function openDesignStudio(forceSources) {
    if (!designStudioOverlay) return;
    designStudioOverlay.classList.remove("hidden");

    if (!studioStage && window.Konva) {
      initDesignStudio();
    } else if (studioStage) {
      studioStage.draw();
    }

    // Decide photos
    if (Array.isArray(forceSources) && forceSources.length) {
      studioAvailablePhotos = forceSources.slice(0, 24);
    } else {
      studioAvailablePhotos = gatherImageUrlsForStudios();
    }

    renderStudioPhotoTray();
  }

  function closeDesignStudio() {
    if (!designStudioOverlay) return;
    designStudioOverlay.classList.add("hidden");
  }

  if (designLauncher) {
    designLauncher.addEventListener("click", () => openDesignStudio());
  }
  if (designCloseBtn && designStudioOverlay) {
    designCloseBtn.addEventListener("click", closeDesignStudio);
    designStudioOverlay.addEventListener("click", (e) => {
      if (e.target === designStudioOverlay) closeDesignStudio();
    });
  }

  if (templatePaymentBtn) {
    templatePaymentBtn.addEventListener("click", () =>
      applyTemplate("payment")
    );
  }
  if (templateArrivalBtn) {
    templateArrivalBtn.addEventListener("click", () =>
      applyTemplate("arrival")
    );
  }
  if (templateSaleBtn) {
    templateSaleBtn.addEventListener("click", () => applyTemplate("sale"));
  }
  if (saveDesignBtn) {
    saveDesignBtn.addEventListener("click", saveDesignToLocal);
  }
  if (loadDesignBtn) {
    loadDesignBtn.addEventListener("click", loadDesignFromLocal);
  }

function pushUrlsIntoDesignStudio(urls) {
  const list = (Array.isArray(urls) ? urls : []).filter(Boolean);

  if (!list.length) {
    alert("No photos available. Boost a listing or add photos first.");
    return;
  }

  studioAvailablePhotos = list.slice(0, 24);
  openDesignStudio(list);

  // Auto-drop first few onto canvas (first as background)
  list.slice(0, 24).forEach((url, index) => {
    addStudioImageFromUrl(url, index === 0);
  });
}








  // --------------------------------------------------
  // Social-ready Photo Strip (Carousel) Actions
  // --------------------------------------------------

  // Open selected (or all) social-ready photos in Design Studio
  if (openDesignFromCarouselBtn) {
    openDesignFromCarouselBtn.addEventListener("click", () => {
      if (!socialReadyPhotos.length) {
        alert(
          "No social-ready photos yet. Double-click a photo in the grid above to add it."
        );
        return;
      }

      const selected = socialReadyPhotos
        .filter((p) => p.selected)
        .map((p) => p.url);

      const chosen = (selected.length
        ? selected
        : socialReadyPhotos.map((p) => p.url)
      ).slice(0, 24);

      pushUrlsIntoDesignStudio(chosen);
    });
  }

  // Open selected (or all) social-ready photos in Canvas Studio
  if (openCanvasFromCarouselBtn) {
    openCanvasFromCarouselBtn.addEventListener("click", () => {
      if (!socialReadyPhotos.length) {
        alert(
          "No social-ready photos yet. Double-click a photo in the grid above to add it."
        );
        return;
      }

      const selected = socialReadyPhotos
        .filter((p) => p.selected)
        .map((p) => p.url);

      const urls = (selected.length
        ? selected
        : socialReadyPhotos.map((p) => p.url)
      ).slice(0, 24);

      openCreativeStudio();
      urls.forEach((url) => addImageFromUrl(url));
    });
  }

  // Revert current social photo back to original (first version)
  if (revertSocialPhotoBtn) {
    revertSocialPhotoBtn.addEventListener("click", () => {
      if (!socialReadyPhotos.length) {
        alert("No social-ready photos to revert.");
        return;
      }
      const idx = socialCurrentIndex;
      const photo = socialReadyPhotos[idx];
      if (!photo || !photo.originalUrl) {
        alert("No original version saved for this photo.");
        return;
      }
      photo.url = photo.originalUrl;
      renderSocialCarousel();
    });
  }

if (downloadAllEditedBtn) {
  downloadAllEditedBtn.addEventListener("click", () => {
    if (!socialReadyPhotos.length) {
      alert(
        "No social-ready photos to download. Double-click a photo in the grid above first."
      );
      return;
    }

    const urls = socialReadyPhotos
      .map((p) => (p && p.url ? p.url : null))
      .filter(Boolean);

    if (!urls.length) {
      alert("No valid photo URLs to download.");
      return;
    }

    const originalLabel = downloadAllEditedBtn.textContent;
    downloadAllEditedBtn.disabled = true;
    downloadAllEditedBtn.textContent = "Downloading JPGs…";

    // Fire one download per photo. Small delay helps browsers keep up.
    urls.forEach((url, index) => {
      setTimeout(() => {
        try {
          triggerSocialDownload(url, index);
        } catch (e) {
          console.error("Download failed for", url, e);
        }
      }, index * 200); // 0ms, 200ms, 400ms, ...
    });

    // Re-enable button after the last download is triggered
    const totalDelay = urls.length * 200 + 400;
    setTimeout(() => {
      downloadAllEditedBtn.disabled = false;
      downloadAllEditedBtn.textContent =
        originalLabel || "Download JPGs for IG / FB Carousel";
    }, totalDelay);
  });
}


  // Initialize social strip UI on load so status text isn't blank
  renderSocialCarousel();

  console.log("✅ Lot Rocket frontend wiring complete");
}); // end DOMContentLoaded

