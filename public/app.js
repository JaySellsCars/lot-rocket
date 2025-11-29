// public/app.js – Lot Rocket V2 frontend

document.addEventListener("DOMContentLoaded", () => {
  const apiBase = ""; // same origin

  // ---------- Basic helpers ----------
  function setStatus(msg, isError = false) {
    const statusEl = document.getElementById("statusText");
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("error", !!isError);
  }

  async function safeJson(res) {
    try {
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // ---------- Theme toggle ----------
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-theme");
    });
  }

  // ---------- Elements: Step 1 ----------
  const vehicleUrlInput = document.getElementById("vehicleUrl");
  const vehicleLabelInput = document.getElementById("vehicleLabel");
  const priceInfoInput = document.getElementById("priceInfo");
  const boostButton = document.getElementById("boostButton");
  const summaryLabel = document.getElementById("summaryLabel");
  const summaryPrice = document.getElementById("summaryPrice");
  const photoGrid = document.getElementById("photoGrid");

  // ---------- Elements: Step 2 ----------
  const facebookPost = document.getElementById("facebookPost");
  const instagramPost = document.getElementById("instagramPost");
  const tiktokPost = document.getElementById("tiktokPost");
  const linkedinPost = document.getElementById("linkedinPost");
  const twitterPost = document.getElementById("twitterPost");
  const textBlurb = document.getElementById("textBlurb");
  const marketplacePost = document.getElementById("marketplacePost");
  const hashtags = document.getElementById("hashtags");
  const selfieScript = document.getElementById("selfieScript");
  const videoPlan = document.getElementById("videoPlan");
  const canvaIdea = document.getElementById("canvaIdea");

  // ---------- Elements: Step 3 (Creative Lab) ----------
  const labVideoVehicle = document.getElementById("labVideoVehicle");
  const labVideoHook = document.getElementById("labVideoHook");
  const labVideoAspect = document.getElementById("labVideoAspect");
  const labVideoStyle = document.getElementById("labVideoStyle");
  const labVideoLength = document.getElementById("labVideoLength");
  const generateLabVideo = document.getElementById("generateLabVideo");
  const labVideoOutput = document.getElementById("labVideoOutput");

  const labDesignType = document.getElementById("labDesignType");
  const labDesignHeadline = document.getElementById("labDesignHeadline");
  const labDesignCTA = document.getElementById("labDesignCTA");
  const labDesignVibe = document.getElementById("labDesignVibe");
  const generateLabDesign = document.getElementById("generateLabDesign");
  const labDesignOutput = document.getElementById("labDesignOutput");

  const photoUpload = document.getElementById("photoUpload");
  const photoPreview = document.getElementById("photoPreview");
  const brightnessRange = document.getElementById("brightnessRange");
  const contrastRange = document.getElementById("contrastRange");
  const saturationRange = document.getElementById("saturationRange");

  // ---------- Step 1: Boost This Listing ----------
  if (boostButton) {
    boostButton.addEventListener("click", async () => {
      const url = (vehicleUrlInput?.value || "").trim();
      if (!url) {
        setStatus("Please paste a dealer vehicle URL first.", true);
        return;
      }

      setStatus("Scraping dealer page and generating social kit...");
      boostButton.disabled = true;

      try {
        const body = {
          url,
          labelOverride: (vehicleLabelInput?.value || "").trim() || null,
          priceOverride: (priceInfoInput?.value || "").trim() || null,
        };

        const res = await fetch(`${apiBase}/api/social-kit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          setStatus("Error building social kit. Check URL or try again.", true);
          boostButton.disabled = false;
          return;
        }

        const data = await safeJson(res);
        if (!data) {
          setStatus("Unexpected response from server.", true);
          boostButton.disabled = false;
          return;
        }

        // Summary
        if (summaryLabel) summaryLabel.textContent = data.label || body.labelOverride || "—";
        if (summaryPrice) summaryPrice.textContent = data.price || body.priceOverride || "—";

        // Posts
        if (facebookPost) facebookPost.value = data.facebook || "";
        if (instagramPost) instagramPost.value = data.instagram || "";
        if (tiktokPost) tiktokPost.value = data.tiktok || "";
        if (linkedinPost) linkedinPost.value = data.linkedin || "";
        if (twitterPost) twitterPost.value = data.twitter || "";
        if (textBlurb) textBlurb.value = data.text || "";
        if (marketplacePost) marketplacePost.value = data.marketplace || "";
        if (hashtags) hashtags.value = data.hashtags || "";
        if (selfieScript) selfieScript.value = data.selfieScript || "";
        if (videoPlan) videoPlan.value = data.videoPlan || "";
        if (canvaIdea) canvaIdea.value = data.canvaIdea || "";

        // Photos
        if (photoGrid) {
          photoGrid.innerHTML = "";
          const photos = Array.isArray(data.photos) ? data.photos : [];
          photos.slice(0, 24).forEach((src) => {
            const img = document.createElement("img");
            img.src = src;
            img.className = "photo-thumb";
            img.alt = "Vehicle photo";
            photoGrid.appendChild(img);
          });
        }

        setStatus("Social kit generated. You can fine-tune and copy any section.");
      } catch (err) {
        console.error(err);
        setStatus("Error building social kit. Please try again.", true);
      } finally {
        boostButton.disabled = false;
      }
    });
  }

  // ---------- Copy Buttons (all platforms) ----------
  function attachCopyButtons() {
    const copyButtons = document.querySelectorAll(".copy-btn[data-target]");
    copyButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const targetId = btn.getAttribute("data-target");
        if (!targetId) return;
        const field = document.getElementById(targetId);
        if (!field || !field.value.trim()) return;

        try {
          await navigator.clipboard.writeText(field.value);
          const original = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(() => {
            btn.textContent = original;
          }, 1000);
        } catch (err) {
          console.error("Copy failed", err);
        }
      });
    });
  }

  attachCopyButtons();

  // ---------- Regeneration per platform ----------
  function attachRegenButtons() {
    const regenButtons = document.querySelectorAll(".regen-btn[data-platform]");
    regenButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const platform = btn.getAttribute("data-platform");
        const url = (vehicleUrlInput?.value || "").trim();
        if (!platform || !url) {
          alert("You need a dealer URL and to hit Boost at least once first.");
          return;
        }

        const labelOverride = (vehicleLabelInput?.value || "").trim() || null;
        const priceOverride = (priceInfoInput?.value || "").trim() || null;

        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = "Thinking...";

        try {
          const res = await fetch(`${apiBase}/api/new-post`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              platform,
              labelOverride,
              priceOverride,
            }),
          });

          if (!res.ok) throw new Error("Failed to regenerate post");

          const data = await safeJson(res);
          const text = data?.content || data?.post || "";

          const targetMap = {
            facebook: "facebookPost",
            instagram: "instagramPost",
            tiktok: "tiktokPost",
            linkedin: "linkedinPost",
            twitter: "twitterPost",
            text: "textBlurb",
            marketplace: "marketplacePost",
            hashtags: "hashtags",
            selfie: "selfieScript",
            videoPlan: "videoPlan",
            canva: "canvaIdea",
          };

          const targetId = targetMap[platform];
          if (targetId) {
            const field = document.getElementById(targetId);
            if (field) field.value = text;
          }
        } catch (err) {
          console.error(err);
          alert("Error regenerating post. Please try again.");
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
      });
    });
  }

  attachRegenButtons();

  // ---------- Creative Lab: Video Idea ----------
  if (generateLabVideo && labVideoOutput) {
    generateLabVideo.addEventListener("click", async () => {
      const vehicle = (labVideoVehicle?.value || "").trim();
      const hook = (labVideoHook?.value || "").trim();
      const aspect = (labVideoAspect?.value || "9:16").trim();
      const style = (labVideoStyle?.value || "hype").trim();
      const length = parseInt(labVideoLength?.value || "30", 10);

      if (!vehicle) {
        labVideoOutput.value = "Add a vehicle or offer first.";
        return;
      }

      generateLabVideo.disabled = true;
      const originalText = generateLabVideo.textContent;
      generateLabVideo.textContent = "Thinking...";

      try {
        const res = await fetch(`${apiBase}/api/new-script`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicle,
            hook,
            aspect,
            style,
            length,
          }),
        });

        if (!res.ok) throw new Error("Video script failed");
        const data = await safeJson(res);
        labVideoOutput.value =
          data?.script ||
          data?.content ||
          "No script returned. Try again with more detail.";
      } catch (err) {
        console.error(err);
        labVideoOutput.value = "Error generating video idea. Please try again.";
      } finally {
        generateLabVideo.disabled = false;
        generateLabVideo.textContent = originalText;
      }
    });
  }

  // ---------- Creative Lab: Canva Layout ----------
  if (generateLabDesign && labDesignOutput) {
    generateLabDesign.addEventListener("click", async () => {
      const creativeType = (labDesignType?.value || "").trim();
      const headline = (labDesignHeadline?.value || "").trim();
      const cta = (labDesignCTA?.value || "").trim();
      const vibe = (labDesignVibe?.value || "").trim();

      if (!creativeType) {
        labDesignOutput.value = "Add a creative type first.";
        return;
      }

      generateLabDesign.disabled = true;
      const originalText = generateLabDesign.textContent;
      generateLabDesign.textContent = "Thinking...";

      try {
        const res = await fetch(`${apiBase}/api/design-idea`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creativeType,
            headline,
            cta,
            vibe,
          }),
        });

        if (!res.ok) throw new Error("Design idea failed");
        const data = await safeJson(res);
        labDesignOutput.value =
          data?.idea ||
          data?.content ||
          "No layout idea returned. Try again with more detail.";
      } catch (err) {
        console.error(err);
        labDesignOutput.value = "Error generating layout idea. Please try again.";
      } finally {
        generateLabDesign.disabled = false;
        generateLabDesign.textContent = originalText;
      }
    });
  }

  // ---------- Photo Editor (preview only) ----------
  function applyPhotoFilters() {
    if (!photoPreview) return;
    const b = Number(brightnessRange?.value || 100);
    const c = Number(contrastRange?.value || 100);
    const s = Number(saturationRange?.value || 100);
    photoPreview.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  }

  if (photoUpload && photoPreview) {
    photoUpload.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        photoPreview.src = evt.target.result;
        applyPhotoFilters();
      };
      reader.readAsDataURL(file);
    });
  }

  [brightnessRange, contrastRange, saturationRange].forEach((slider) => {
    if (!slider) return;
    slider.addEventListener("input", applyPhotoFilters);
  });

  // ---------- Modal helpers ----------
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  }

  // ---------- Objection Coach ----------
  const objectionLauncher = document.getElementById("objectionLauncher");
  const objectionClose = document.getElementById("objectionClose");
  const objectionInput = document.getElementById("objectionInput");
  const objectionHistory = document.getElementById("objectionHistory");
  const sendObjection = document.getElementById("sendObjection");

  objectionLauncher?.addEventListener("click", () => openModal("objectionModal"));
  objectionClose?.addEventListener("click", () => closeModal("objectionModal"));

  sendObjection?.addEventListener("click", async () => {
    const text = (objectionInput?.value || "").trim();
    if (!text) return;

    sendObjection.disabled = true;
    const res = await fetch(`${apiBase}/api/objection-coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objection: text, history: objectionHistory?.value || "" }),
    });

    const data = await safeJson(res);
    const reply = data?.reply || data?.content || "No response.";
    if (objectionHistory) {
      objectionHistory.value +=
        (objectionHistory.value ? "\n\n" : "") + "Customer: " + text + "\nYou: " + reply;
    }
    sendObjection.disabled = false;
  });

  // ---------- Payment Estimator ----------
  const paymentLauncher = document.getElementById("paymentLauncher");
  const paymentClose = document.getElementById("paymentClose");
  const payPrice = document.getElementById("payPrice");
  const payDown = document.getElementById("payDown");
  const payRate = document.getElementById("payRate");
  const payTerm = document.getElementById("payTerm");
  const payTax = document.getElementById("payTax");
  const calcPayment = document.getElementById("calcPayment");
  const paymentResult = document.getElementById("paymentResult");

  paymentLauncher?.addEventListener("click", () => openModal("paymentModal"));
  paymentClose?.addEventListener("click", () => closeModal("paymentModal"));

  calcPayment?.addEventListener("click", async () => {
    const body = {
      price: Number(payPrice?.value || 0),
      down: Number(payDown?.value || 0),
      rate: Number(payRate?.value || 0),
      term: Number(payTerm?.value || 0),
      tax: Number(payTax?.value || 0),
    };

    const res = await fetch(`${apiBase}/api/payment-helper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await safeJson(res);
    paymentResult.value = data?.result || data?.text || "No estimate returned.";
  });

  // ---------- Income Estimator ----------
  const incomeLauncher = document.getElementById("incomeLauncher");
  const incomeClose = document.getElementById("incomeClose");
  const incomePayment = document.getElementById("incomePayment");
  const incomeDTI = document.getElementById("incomeDTI");
  const calcIncome = document.getElementById("calcIncome");
  const incomeResult = document.getElementById("incomeResult");

  incomeLauncher?.addEventListener("click", () => openModal("incomeModal"));
  incomeClose?.addEventListener("click", () => closeModal("incomeModal"));

  calcIncome?.addEventListener("click", async () => {
    const body = {
      payment: Number(incomePayment?.value || 0),
      dti: Number(incomeDTI?.value || 0),
    };

    const res = await fetch(`${apiBase}/api/income-helper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await safeJson(res);
    incomeResult.value = data?.result || data?.text || "No estimate returned.";
  });

  // ---------- AI Work Flow Expert ----------
  const workflowLauncher = document.getElementById("workflowLauncher");
  const workflowClose = document.getElementById("workflowClose");
  const workflowInput = document.getElementById("workflowInput");
  const workflowGenerate = document.getElementById("workflowGenerate");
  const workflowResult = document.getElementById("workflowResult");
  const workflowCopy = document.getElementById("workflowCopy");

  workflowLauncher?.addEventListener("click", () => openModal("workflowModal"));
  workflowClose?.addEventListener("click", () => closeModal("workflowModal"));

  workflowGenerate?.addEventListener("click", async () => {
    const text = (workflowInput?.value || "").trim();
    if (!text) return;

    workflowGenerate.disabled = true;
    const res = await fetch(`${apiBase}/api/message-helper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "workflow", context: text }),
    });

    const data = await safeJson(res);
    workflowResult.value =
      data?.result || data?.content || "No workflow returned. Try with more detail.";
    workflowGenerate.disabled = false;
  });

  workflowCopy?.addEventListener("click", async () => {
    if (!workflowResult?.value.trim()) return;
    await navigator.clipboard.writeText(workflowResult.value);
    const original = workflowCopy.textContent;
    workflowCopy.textContent = "Copied!";
    setTimeout(() => (workflowCopy.textContent = original), 1000);
  });

  // ---------- AI Message Builder ----------
  const messageLauncher = document.getElementById("messageLauncher");
  const messageClose = document.getElementById("messageClose");
  const messageContext = document.getElementById("messageContext");
  const messageTone = document.getElementById("messageTone");
  const messageChannel = document.getElementById("messageChannel");
  const messageGenerate = document.getElementById("messageGenerate");
  const messageResult = document.getElementById("messageResult");
  const messageCopy = document.getElementById("messageCopy");

  messageLauncher?.addEventListener("click", () => openModal("messageModal"));
  messageClose?.addEventListener("click", () => closeModal("messageModal"));

  messageGenerate?.addEventListener("click", async () => {
    const context = (messageContext?.value || "").trim();
    if (!context) return;

    const tone = messageTone?.value || "friendly";
    const channel = messageChannel?.value || "text";

    messageGenerate.disabled = true;

    const res = await fetch(`${apiBase}/api/message-helper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "message", context, tone, channel }),
    });

    const data = await safeJson(res);
    messageResult.value = data?.result || data?.content || "No message returned.";
    messageGenerate.disabled = false;
  });

  messageCopy?.addEventListener("click", async () => {
    if (!messageResult?.value.trim()) return;
    await navigator.clipboard.writeText(messageResult.value);
    const original = messageCopy.textContent;
    messageCopy.textContent = "Copied!";
    setTimeout(() => (messageCopy.textContent = original), 1000);
  });

  // ---------- Ask A.I. ----------
  const askLauncher = document.getElementById("askLauncher");
  const askClose = document.getElementById("askClose");
  const askInput = document.getElementById("askInput");
  const askGenerate = document.getElementById("askGenerate");
  const askResult = document.getElementById("askResult");
  const askCopy = document.getElementById("askCopy");

  askLauncher?.addEventListener("click", () => openModal("askModal"));
  askClose?.addEventListener("click", () => closeModal("askModal"));

  askGenerate?.addEventListener("click", async () => {
    const question = (askInput?.value || "").trim();
    if (!question) return;

    askGenerate.disabled = true;

    const res = await fetch(`${apiBase}/api/message-helper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "ask", context: question }),
    });

    const data = await safeJson(res);
    askResult.value = data?.result || data?.content || "No answer returned.";
    askGenerate.disabled = false;
  });

  askCopy?.addEventListener("click", async () => {
    if (!askResult?.value.trim()) return;
    await navigator.clipboard.writeText(askResult.value);
    const original = askCopy.textContent;
    askCopy.textContent = "Copied!";
    setTimeout(() => (askCopy.textContent = original), 1000);
  });

  // ---------- AI Car Expert ----------
  const carLauncher = document.getElementById("carLauncher");
  const carClose = document.getElementById("carClose");
  const carQuestion = document.getElementById("carQuestion");
  const carGenerate = document.getElementById("carGenerate");
  const carResult = document.getElementById("carResult");
  const carCopy = document.getElementById("carCopy");

  carLauncher?.addEventListener("click", () => openModal("carModal"));
  carClose?.addEventListener("click", () => closeModal("carModal"));

  carGenerate?.addEventListener("click", async () => {
    const question = (carQuestion?.value || "").trim();
    if (!question) return;

    carGenerate.disabled = true;

    const res = await fetch(`${apiBase}/api/message-helper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "car", context: question }),
    });

    const data = await safeJson(res);
    carResult.value = data?.result || data?.content || "No answer returned.";
    carGenerate.disabled = false;
  });

  carCopy?.addEventListener("click", async () => {
    if (!carResult?.value.trim()) return;
    await navigator.clipboard.writeText(carResult.value);
    const original = carCopy.textContent;
    carCopy.textContent = "Copied!";
    setTimeout(() => (carCopy.textContent = original), 1000);
  });

  // ---------- NEW: AI Image & Video Generation (placeholders only) ----------
  const imageGenLauncher = document.getElementById("imageGenLauncher");
  const imageGenModal = document.getElementById("imageGenModal");
  const imageGenClose = document.getElementById("imageGenClose");

  imageGenLauncher?.addEventListener("click", () => {
    imageGenModal?.classList.remove("hidden");
  });
  imageGenClose?.addEventListener("click", () => {
    imageGenModal?.classList.add("hidden");
  });
  imageGenModal?.addEventListener("click", (e) => {
    if (e.target === imageGenModal) imageGenModal.classList.add("hidden");
  });

  const videoGenLauncher = document.getElementById("videoGenLauncher");
  const videoGenModal = document.getElementById("videoGenModal");
  const videoGenClose = document.getElementById("videoGenClose");

  videoGenLauncher?.addEventListener("click", () => {
    videoGenModal?.classList.remove("hidden");
  });
  videoGenClose?.addEventListener("click", () => {
    videoGenModal?.classList.add("hidden");
  });
  videoGenModal?.addEventListener("click", (e) => {
    if (e.target === videoGenModal) videoGenModal.classList.add("hidden");
  });
});
