// public/app.js – Lot Rocket frontend logic

document.addEventListener("DOMContentLoaded", () => {
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

    // default: dark
    applyTheme(true);

    themeToggleInput.addEventListener("change", () => {
      applyTheme(themeToggleInput.checked);
    });
  }

  // ---------- STEP 1: BOOST WORKFLOW ----------
  const vehicleUrlInput = document.getElementById("vehicleUrl");
  const vehicleLabelInput = document.getElementById("vehicleLabel");
  const priceInfoInput = document.getElementById("priceInfo");
  const boostButton = document.getElementById("boostButton");
  const statusText = document.getElementById("statusText");

  const summaryLabel = document.getElementById("summaryLabel");
  const summaryPrice = document.getElementById("summaryPrice");

  const photosGrid = document.getElementById("photosGrid");
  const sendPhotosToStudioBtn = document.getElementById("sendPhotosToStudio");

  // will hold the last batch of photos from Boost
  let latestPhotoUrls = [];
  if (sendPhotosToStudioBtn) {
    sendPhotosToStudioBtn.disabled = true;
  }

  const facebookPost = document.getElementById("facebookPost");
  const instagramPost = document.getElementById("instagramPost");
  const tiktokPost = document.getElementById("tiktokPost");
  const linkedinPost = document.getElementById("linkedinPost");
  const twitterPost = document.getElementById("twitterPost");
  const textBlurb = document.getElementById("textBlurb");
  const marketplacePost = document.getElementById("marketplacePost");
  const hashtags = document.getElementById("hashtags");

  const selfieScript = document.getElementById("selfieScript");
  const shotPlan = document.getElementById("shotPlan");
  const designIdea = document.getElementById("designIdea");

  async function handleBoost() {
    const url = (vehicleUrlInput?.value || "").trim();
    if (!url) {
      statusText.textContent = "Please paste a dealer vehicle URL first.";
      statusText.classList.add("error");
      return;
    }

    statusText.classList.remove("error");
    statusText.textContent = "Building social kit... 🚀";

    try {
      const body = {
        url,
        labelOverride: vehicleLabelInput?.value || "",
        priceOverride: priceInfoInput?.value || "",
      };

      const res = await fetch(apiBase + "/api/social-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();

      // Summary
      if (summaryLabel) summaryLabel.textContent = data.vehicleLabel || "—";
      if (summaryPrice) summaryPrice.textContent = data.priceInfo || "—";

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
      if (shotPlan) shotPlan.value = data.shotPlan || "";
      if (designIdea) designIdea.value = data.designIdea || "";

      // ---------- PHOTOS ----------
      if (photosGrid) {
        photosGrid.innerHTML = "";

        const photos = Array.isArray(data.photos) ? data.photos : [];

        // Save the recent photos so Creative Studio can use them
        latestPhotoUrls = photos.slice(0, 8); // top 8

        latestPhotoUrls.forEach((url) => {
          const img = document.createElement("img");
          img.src = url;
          img.alt = "Vehicle photo";
          img.className = "photo-thumb";
          photosGrid.appendChild(img);
        });

        // Enable the "Send to Creative Studio" button only when photos exist
        if (sendPhotosToStudioBtn) {
          sendPhotosToStudioBtn.disabled = latestPhotoUrls.length === 0;
        }
      }

      statusText.textContent = "Social kit ready! 🎯";
    } catch (err) {
      console.error(err);
      statusText.textContent =
        "Error building social kit. Check URL or try again.";
      statusText.classList.add("error");
    }
  }

  if (boostButton) {
    boostButton.addEventListener("click", handleBoost);
  }

  // ---------- COPY BUTTONS ----------
  function wireCopyButtons() {
    const copyButtons = document.querySelectorAll(".copy-btn[data-copy-target]");
    copyButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-copy-target");
        const target = document.getElementById(targetId);
        if (!target) return;

        const value = target.value || target.textContent || "";
        if (!value.trim()) {
          btn.classList.add("empty");
          btn.textContent = "Empty";
          setTimeout(() => {
            btn.classList.remove("empty");
            btn.textContent = "Copy";
          }, 1000);
          return;
        }

        navigator.clipboard
          .writeText(value)
          .then(() => {
            btn.classList.add("copied");
            btn.textContent = "Copied!";
            setTimeout(() => {
              btn.classList.remove("copied");
              btn.textContent = "Copy";
            }, 1200);
          })
          .catch(() => {
            btn.textContent = "Oops";
            setTimeout(() => (btn.textContent = "Copy"), 1200);
          });
      });
    });
  }
  wireCopyButtons();

  // ---------- REGEN BUTTONS (SOCIAL KIT) ----------
  const regenButtons = document.querySelectorAll(".regen-btn[data-platform]");
  regenButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const platform = btn.getAttribute("data-platform");
      if (!platform) return;

      const url = (vehicleUrlInput?.value || "").trim();
      const label = summaryLabel?.textContent || "";
      const price = summaryPrice?.textContent || "";

      try {
        btn.disabled = true;
        btn.textContent = "Spinning...";

        const res = await fetch(apiBase + "/api/new-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, url, label, price }),
        });

        if (!res.ok) throw new Error(`Server ${res.status}`);

        const data = await res.json();

        const map = {
          facebook: facebookPost,
          instagram: instagramPost,
          tiktok: tiktokPost,
          linkedin: linkedinPost,
          twitter: twitterPost,
          marketplace: marketplacePost,
          text: textBlurb,
          hashtags,
        };

        const target = map[platform];
        if (target && data.text) {
          target.value = data.text;
        }
      } catch (err) {
        console.error(err);
      } finally {
        btn.disabled = false;
        btn.textContent =
          platform === "text"
            ? "New Text"
            : platform === "hashtags"
            ? "New Set"
            : "New Post";
      }
    });
  });

  // Selfie script / shot plan / design idea regen
  const regenSelfieScriptBtn = document.getElementById("regenSelfieScript");
  const regenShotPlanBtn = document.getElementById("regenShotPlan");
  const regenDesignIdeaBtn = document.getElementById("regenDesignIdea");

  if (regenSelfieScriptBtn && selfieScript) {
    regenSelfieScriptBtn.addEventListener("click", async () => {
      const url = (vehicleUrlInput?.value || "").trim();
      try {
        regenSelfieScriptBtn.disabled = true;
        regenSelfieScriptBtn.textContent = "Spinning...";
        const res = await fetch(apiBase + "/api/new-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, kind: "selfie" }),
        });
        const data = await res.json();
        selfieScript.value = data.script || "";
      } catch (err) {
        console.error(err);
      } finally {
        regenSelfieScriptBtn.disabled = false;
        regenSelfieScriptBtn.textContent = "New Script";
      }
    });
  }

  if (regenShotPlanBtn && shotPlan) {
    regenShotPlanBtn.addEventListener("click", async () => {
      const url = (vehicleUrlInput?.value || "").trim();
      try {
        regenShotPlanBtn.disabled = true;
        regenShotPlanBtn.textContent = "Spinning...";
        const res = await fetch(apiBase + "/api/video-from-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        shotPlan.value = data.plan || "";
      } catch (err) {
        console.error(err);
      } finally {
        regenShotPlanBtn.disabled = false;
        regenShotPlanBtn.textContent = "New Plan";
      }
    });
  }

  if (regenDesignIdeaBtn && designIdea) {
    regenDesignIdeaBtn.addEventListener("click", async () => {
      const label = summaryLabel?.textContent || "";
      try {
        regenDesignIdeaBtn.disabled = true;
        regenDesignIdeaBtn.textContent = "Spinning...";
        const res = await fetch(apiBase + "/api/design-idea", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label }),
        });
        const data = await res.json();
        designIdea.value = data.idea || "";
      } catch (err) {
        console.error(err);
      } finally {
        regenDesignIdeaBtn.disabled = false;
        regenDesignIdeaBtn.textContent = "New Idea";
      }
    });
  }

  // ---------- CREATIVE LAB: VIDEO IDEA & LAYOUT ----------
  const videoVehicle = document.getElementById("videoVehicle");
  const videoHook = document.getElementById("videoHook");
  const videoStyle = document.getElementById("videoStyle");
  const videoLength = document.getElementById("videoLength");
  const videoIdeaOutput = document.getElementById("videoIdeaOutput");
  const generateVideoIdeaBtn = document.getElementById("generateVideoIdea");

  if (generateVideoIdeaBtn) {
    generateVideoIdeaBtn.addEventListener("click", async () => {
      try {
        generateVideoIdeaBtn.disabled = true;
        generateVideoIdeaBtn.textContent = "Thinking...";

        const res = await fetch(apiBase + "/api/new-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "idea",
            vehicle: videoVehicle.value,
            hook: videoHook.value,
            style: videoStyle.value,
            length: videoLength.value,
          }),
        });

        const data = await res.json();
        videoIdeaOutput.value = data.script || "";
      } catch (err) {
        console.error(err);
        videoIdeaOutput.value = "Error generating video idea.";
      } finally {
        generateVideoIdeaBtn.disabled = false;
        generateVideoIdeaBtn.textContent = "Generate Video Idea";
      }
    });
  }

  const layoutType = document.getElementById("layoutType");
  const layoutHeadline = document.getElementById("layoutHeadline");
  const layoutCTA = document.getElementById("layoutCTA");
  const layoutVibe = document.getElementById("layoutVibe");
  const layoutIdeaOutput = document.getElementById("layoutIdeaOutput");
  const generateLayoutIdeaBtn = document.getElementById("generateLayoutIdea");

  if (generateLayoutIdeaBtn) {
    generateLayoutIdeaBtn.addEventListener("click", async () => {
      try {
        generateLayoutIdeaBtn.disabled = true;
        generateLayoutIdeaBtn.textContent = "Thinking...";

        const res = await fetch(apiBase + "/api/design-idea", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: layoutType.value,
            headline: layoutHeadline.value,
            cta: layoutCTA.value,
            vibe: layoutVibe.value,
          }),
        });

        const data = await res.json();
        layoutIdeaOutput.value = data.idea || "";
      } catch (err) {
        console.error(err);
        layoutIdeaOutput.value = "Error generating layout idea.";
      } finally {
        generateLayoutIdeaBtn.disabled = false;
        generateLayoutIdeaBtn.textContent = "Generate Layout Idea";
      }
    });
  }

  // ---------- PHOTO EDITOR ----------
  const photoUpload = document.getElementById("photoUpload");
  const photoPreview = document.getElementById("photoPreview");
  const photoPlaceholder = document.getElementById("photoPlaceholder");
  const brightnessRange = document.getElementById("brightnessRange");
  const contrastRange = document.getElementById("contrastRange");
  const saturationRange = document.getElementById("saturationRange");

  function updatePhotoFilters() {
    if (!photoPreview) return;
    const b = brightnessRange ? brightnessRange.value : 100;
    const c = contrastRange ? contrastRange.value : 100;
    const s = saturationRange ? saturationRange.value : 100;
    photoPreview.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  }

  if (photoUpload && photoPreview) {
    photoUpload.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        photoPreview.src = ev.target.result;
        photoPreview.style.display = "block";
        if (photoPlaceholder) photoPlaceholder.style.display = "none";
        updatePhotoFilters();
      };
      reader.readAsDataURL(file);
    });
  }

  [brightnessRange, contrastRange, saturationRange].forEach((slider) => {
    if (!slider) return;
    slider.addEventListener("input", updatePhotoFilters);
  });

  // ---------- COMMON MONEY HELPER ----------
  function formatMoney(value) {
    if (isNaN(value)) return "$0.00";
    const rounded = Math.round(value * 100) / 100;
    return (
      "$" + rounded.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    );
  }

  // ---------- PAYMENT CALCULATOR MATH ----------
  const autoPriceInput = document.getElementById("autoPrice");
  const loanTermInput = document.getElementById("loanTermMonths");
  const interestRateInput = document.getElementById("interestRate");
  const cashIncentivesInput = document.getElementById("cashIncentives");
  const downPaymentInput = document.getElementById("downPayment");
  const tradeInValueInput = document.getElementById("tradeInValue");
  const tradeOwedInput = document.getElementById("tradeOwed");
  const salesTaxInput = document.getElementById("salesTax");
  const feesInput = document.getElementById("fees");
  const paymentOutput = document.getElementById("paymentOutput");
  const runPaymentHelperBtn = document.getElementById("runPaymentHelper");

  if (runPaymentHelperBtn) {
    runPaymentHelperBtn.addEventListener("click", () => {
      const price = parseFloat(autoPriceInput.value || "0");
      const termMonths = parseInt(loanTermInput.value || "0", 10);
      const rateAnnual = parseFloat(interestRateInput.value || "0");
      const incentives = parseFloat(cashIncentivesInput.value || "0");
      const down = parseFloat(downPaymentInput.value || "0");
      const tradeValue = parseFloat(tradeInValueInput.value || "0");
      const tradeOwed = parseFloat(tradeOwedInput.value || "0");
      const salesTaxPct = parseFloat(salesTaxInput.value || "0");
      const fees = parseFloat(feesInput.value || "0");

      if (!price || !termMonths) {
        paymentOutput.value =
          "Please enter at least Auto Price and Loan Term to estimate a payment.";
        return;
      }

      const priceAfterIncentives = Math.max(price - incentives, 0);
      const netTrade = tradeValue - tradeOwed;
      const taxableAmount = priceAfterIncentives;
      const taxAmount = taxableAmount * (salesTaxPct / 100);
      const amountFinanced =
        priceAfterIncentives - down - netTrade + taxAmount + fees;
      const monthlyRate = rateAnnual / 100 / 12;

      let monthlyPayment;
      if (!rateAnnual || !monthlyRate) {
        monthlyPayment = amountFinanced / termMonths;
      } else {
        const factor = Math.pow(1 + monthlyRate, -termMonths);
        monthlyPayment = (amountFinanced * monthlyRate) / (1 - factor);
      }

      const totalPayments = monthlyPayment * termMonths;
      const totalInterest = totalPayments - amountFinanced;
      const upfront = down + fees;

      paymentOutput.value =
        `Monthly Payment: ${formatMoney(monthlyPayment)}\n\n` +
        `Total Loan Amount (amount financed): ${formatMoney(
          amountFinanced
        )}\n` +
        `Sales Tax: ${formatMoney(taxAmount)}\n` +
        `Upfront Payment (down + fees): ${formatMoney(upfront)}\n\n` +
        `Total of ${termMonths} Payments: ${formatMoney(totalPayments)}\n` +
        `Total Loan Interest: ${formatMoney(totalInterest)}\n` +
        `Estimated Total Cost (vehicle, tax, fees, interest): ${formatMoney(
          totalPayments + upfront
        )}`;
    });
  }

  // ---------- STANDALONE BASIC CALCULATOR ----------
  const basicCalcPanel = document.getElementById("basicCalcPanel");
  const basicCalcDisplay = document.getElementById("basicCalcDisplay");

  if (basicCalcPanel && basicCalcDisplay) {
    let calcExpression = "0";

    const updateDisplay = () => {
      basicCalcDisplay.textContent = calcExpression || "0";
    };

    basicCalcPanel.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-calc]");
      if (!btn) return;
      const value = btn.getAttribute("data-calc");

      if (value === "C") {
        calcExpression = "0";
        updateDisplay();
        return;
      }

      if (value === "DEL") {
        calcExpression = calcExpression.slice(0, -1) || "0";
        updateDisplay();
        return;
      }

      if (value === "=") {
        try {
          if (!/^[0-9+\-*/().\s]+$/.test(calcExpression)) {
            throw new Error("Invalid expression");
          }
          const result = Function(`"use strict"; return (${calcExpression})`)();
          calcExpression = String(result);
        } catch {
          calcExpression = "Error";
        }
        updateDisplay();
        return;
      }

      if (calcExpression === "0" && /[0-9.]/.test(value)) {
        calcExpression = value;
      } else if (calcExpression === "Error") {
        calcExpression = value;
      } else {
        calcExpression += value;
      }

      updateDisplay();
    });

    updateDisplay();
  }

  // ---------- INCOME CALCULATOR ----------
  const ytdIncomeInput = document.getElementById("ytdIncome");
  const hireDateInput = document.getElementById("hireDate");
  const checkDateInput = document.getElementById("checkDate");
  const incomeOutput = document.getElementById("incomeOutput");
  const runIncomeHelperBtn = document.getElementById("runIncomeHelper");

  if (runIncomeHelperBtn) {
    runIncomeHelperBtn.addEventListener("click", () => {
      const ytd = parseFloat(ytdIncomeInput.value || "0");
      const hireVal = hireDateInput.value;
      const checkVal = checkDateInput.value;

      if (!ytd || !hireVal || !checkVal) {
        incomeOutput.value =
          "Please enter Year to Date income, hire date, and check date.";
        return;
      }

      const hire = new Date(hireVal);
      const check = new Date(checkVal);

      if (!(hire instanceof Date) || !(check instanceof Date) || hire >= check) {
        incomeOutput.value =
          "Check date must be after hire date. Please double-check your dates.";
        return;
      }

      const msPerDay = 1000 * 60 * 60 * 24;
      const daysWorked = Math.max(
        1,
        Math.round((check.getTime() - hire.getTime()) / msPerDay)
      );
      const dailyIncome = ytd / daysWorked;
      const annualIncome = dailyIncome * 365;
      const monthlyIncome = annualIncome / 12;

      incomeOutput.value =
        `Estimated Monthly Income: ${formatMoney(monthlyIncome)}\n\n` +
        `Based on:\n` +
        `Year-to-Date Income: ${formatMoney(ytd)}\n` +
        `Days Worked: ${daysWorked}\n` +
        `Estimated Annual Income: ${formatMoney(annualIncome)}`;
    });
  }

  // ---------- AI TOOL HELPERS (BACKEND ENDPOINTS) ----------
  async function callHelper(endpoint, payload) {
    const res = await fetch(apiBase + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return res.json();
  }

  // Objection coach
  const objectionInput = document.getElementById("objectionInput");
  const objectionOutput = document.getElementById("objectionOutput");
  const runObjectionCoachBtn = document.getElementById("runObjectionCoach");

  if (runObjectionCoachBtn) {
    runObjectionCoachBtn.addEventListener("click", async () => {
      try {
        runObjectionCoachBtn.disabled = true;
        runObjectionCoachBtn.textContent = "Thinking...";

        const data = await callHelper("/api/objection-coach", {
          objection: objectionInput.value,
        });

        objectionOutput.value = data.answer || "";
      } catch (err) {
        console.error(err);
        objectionOutput.value = "Error generating coaching response.";
      } finally {
        runObjectionCoachBtn.disabled = false;
        runObjectionCoachBtn.textContent = "Get Coaching";
      }
    });
  }

  // Workflow expert
  const workflowSituation = document.getElementById("workflowSituation");
  const workflowOutput = document.getElementById("workflowOutput");
  const runWorkflowHelperBtn = document.getElementById("runWorkflowHelper");

  if (runWorkflowHelperBtn) {
    runWorkflowHelperBtn.addEventListener("click", async () => {
      try {
        runWorkflowHelperBtn.disabled = true;
        runWorkflowHelperBtn.textContent = "Thinking...";

        const data = await callHelper("/api/message-helper", {
          mode: "workflow",
          prompt: workflowSituation.value,
        });

        workflowOutput.value = data.text || "";
      } catch (err) {
        console.error(err);
        workflowOutput.value = "Error generating workflow.";
      } finally {
        runWorkflowHelperBtn.disabled = false;
        runWorkflowHelperBtn.textContent = "Build Workflow";
      }
    });
  }

  // Message builder
  const messageType = document.getElementById("messageType");
  const messageGoal = document.getElementById("messageGoal");
  const messageDetails = document.getElementById("messageDetails");
  const messageOutput = document.getElementById("messageOutput");
  const runMessageHelperBtn = document.getElementById("runMessageHelper");

  if (runMessageHelperBtn) {
    runMessageHelperBtn.addEventListener("click", async () => {
      try {
        runMessageHelperBtn.disabled = true;
        runMessageHelperBtn.textContent = "Thinking...";

        const data = await callHelper("/api/message-helper", {
          mode: "message",
          type: messageType.value,
          goal: messageGoal.value,
          details: messageDetails.value,
        });

        messageOutput.value = data.text || "";
      } catch (err) {
        console.error(err);
        messageOutput.value = "Error generating message.";
      } finally {
        runMessageHelperBtn.disabled = false;
        runMessageHelperBtn.textContent = "Generate Message";
      }
    });
  }

  // Ask AI
  const askQuestion = document.getElementById("askQuestion");
  const askOutput = document.getElementById("askOutput");
  const runAskHelperBtn = document.getElementById("runAskHelper");

  if (runAskHelperBtn) {
    runAskHelperBtn.addEventListener("click", async () => {
      try {
        runAskHelperBtn.disabled = true;
        runAskHelperBtn.textContent = "Thinking...";

        const data = await callHelper("/api/message-helper", {
          mode: "ask",
          question: askQuestion.value,
        });

        askOutput.value = data.text || "";
      } catch (err) {
        console.error(err);
        askOutput.value = "Error answering question.";
      } finally {
        runAskHelperBtn.disabled = false;
        runAskHelperBtn.textContent = "Ask";
      }
    });
  }

  // Car expert
  const carQuestion = document.getElementById("carQuestion");
  const carOutput = document.getElementById("carOutput");
  const runCarHelperBtn = document.getElementById("runCarHelper");

  if (runCarHelperBtn) {
    runCarHelperBtn.addEventListener("click", async () => {
      try {
        runCarHelperBtn.disabled = true;
        runCarHelperBtn.textContent = "Thinking...";

        const data = await callHelper("/api/message-helper", {
          mode: "car",
          question: carQuestion.value,
        });

        carOutput.value = data.text || "";
      } catch (err) {
        console.error(err);
        carOutput.value = "Error answering car question.";
      } finally {
        runCarHelperBtn.disabled = false;
        runCarHelperBtn.textContent = "Ask Car Expert";
      }
    });
  }

  // Image generation prompt (brief)
  const imagePrompt = document.getElementById("imagePrompt");
  const imageOutput = document.getElementById("imageOutput");
  const runImageHelperBtn = document.getElementById("runImageHelper");

  if (runImageHelperBtn) {
    runImageHelperBtn.addEventListener("click", async () => {
      try {
        runImageHelperBtn.disabled = true;
        runImageHelperBtn.textContent = "Thinking...";

        const data = await callHelper("/api/message-helper", {
          mode: "image-brief",
          prompt: imagePrompt.value,
        });

        imageOutput.value =
          data.text ||
          "Describe your image in detail (vehicle, background, lighting, angle, style).";
      } catch (err) {
        console.error(err);
        imageOutput.value = "Error generating image prompt.";
      } finally {
        runImageHelperBtn.disabled = false;
        runImageHelperBtn.textContent = "Build Image Prompt";
      }
    });
  }

  // Video generation brief
  const videoGenPrompt = document.getElementById("videoGenPrompt");
  const videoGenOutput = document.getElementById("videoGenOutput");
  const runVideoHelperBtn = document.getElementById("runVideoHelper");

  if (runVideoHelperBtn) {
    runVideoHelperBtn.addEventListener("click", async () => {
      try {
        runVideoHelperBtn.disabled = true;
        runVideoHelperBtn.textContent = "Thinking...";

        const data = await callHelper("/api/message-helper", {
          mode: "video-brief",
          prompt: videoGenPrompt.value,
        });

        videoGenOutput.value = data.text || "";
      } catch (err) {
        console.error(err);
        videoGenOutput.value = "Error generating video brief.";
      } finally {
        runVideoHelperBtn.disabled = false;
        runVideoHelperBtn.textContent = "Build Video Brief";
      }
    });
  }

// ===============================================
// CREATIVE STUDIO – FABRIC.JS CANVAS WIRING
// ===============================================

const creativeOverlay = document.getElementById("creativeStudioOverlay");
const openCreativeStudioBtn = document.getElementById("openCreativeStudio");

if (creativeOverlay && openCreativeStudioBtn && window.fabric) {



    const closeCreativeStudioBtn = document.getElementById("creativeClose");
    const exportPngBtn = document.getElementById("creativeExportPng");
    const canvasPresetSelect = document.getElementById("creativeCanvasPreset");
    const imageInput = document.getElementById("creativeImageInput");

    const undoBtn = document.getElementById("creativeUndo");
    const redoBtn = document.getElementById("creativeRedo");
    const deleteBtn = document.getElementById("creativeDelete");

    const toolButtons = document.querySelectorAll(".tool-btn[data-tool]");

    const propFillColor = document.getElementById("propFillColor");
    const propStrokeColor = document.getElementById("propStrokeColor");
    const propStrokeWidth = document.getElementById("propStrokeWidth");
    const textOptions = document.getElementById("textOptions");
    const propFontSize = document.getElementById("propFontSize");
    const propTextAlign = document.getElementById("propTextAlign");

    let creativeCanvas = null;
    let activeTool = "select";

    // Simple undo/redo stacks
    const history = [];
    const redoStack = [];
    let isRestoringHistory = false;

    function pushHistory() {
      if (!creativeCanvas || isRestoringHistory) return;
      const json = creativeCanvas.toJSON();
      history.push(json);
      if (history.length > 50) {
        history.shift();
      }
      redoStack.length = 0;
    }

    function restoreFromJson(json) {
      if (!creativeCanvas) return;
      isRestoringHistory = true;
      creativeCanvas.loadFromJSON(json, () => {
        creativeCanvas.renderAll();
        isRestoringHistory = false;
      });
    }

    function handleUndo() {
      if (history.length <= 1) return;
      const current = history.pop();
      redoStack.push(current);
      const previous = history[history.length - 1];
      restoreFromJson(previous);
    }

    function handleRedo() {
      if (redoStack.length === 0) return;
      const next = redoStack.pop();
      history.push(next);
      restoreFromJson(next);
    }

  function initCreativeCanvas() {

  // Safety check – make sure Fabric.js loaded
  if (typeof fabric === "undefined") {
    console.warn("Fabric.js not loaded – Creative Studio disabled.");
    return;
  }

  const canvasEl = document.getElementById("creativeCanvas");
  if (!canvasEl) return;

  creativeCanvas = new fabric.Canvas("creativeCanvas", {
    preserveObjectStacking: true,
    selection: true,
    backgroundColor: "#0b0b12",
  });

  // ...rest of your code...
}


      // Initial preset size
      applyCanvasPreset();

      // Track history
      creativeCanvas.on("object:added", pushHistory);
      creativeCanvas.on("object:modified", pushHistory);
      creativeCanvas.on("object:removed", pushHistory);

      creativeCanvas.on("selection:created", updatePropertyPanel);
      creativeCanvas.on("selection:updated", updatePropertyPanel);
      creativeCanvas.on("selection:cleared", updatePropertyPanel);

      // Seed initial empty state in history
      pushHistory();
    }

    function applyCanvasPreset() {
      if (!creativeCanvas || !canvasPresetSelect) return;
      const value = canvasPresetSelect.value || "1080x1080";
      const [w, h] = value.split("x").map(Number);

      creativeCanvas.setWidth(w);
      creativeCanvas.setHeight(h);
      creativeCanvas.calcOffset();
      creativeCanvas.requestRenderAll();
    }

    function openCreativeStudio() {
      creativeOverlay.classList.remove("hidden");
      if (!creativeCanvas) {
        initCreativeCanvas();
      } else {
        creativeCanvas.calcOffset();
        creativeCanvas.requestRenderAll();
      }
    }

    function closeCreativeStudio() {
      creativeOverlay.classList.add("hidden");
    }

    function setActiveTool(toolName) {
      activeTool = toolName;
      toolButtons.forEach((btn) => {
        const t = btn.getAttribute("data-tool");
        if (t === toolName) {
          btn.classList.add("tool-btn-active");
        } else {
          btn.classList.remove("tool-btn-active");
        }
      });
      if (toolName === "select" && creativeCanvas) {
        creativeCanvas.isDrawingMode = false;
      }
    }

    function addTextObject() {
      if (!creativeCanvas) return;
      const text = new fabric.Textbox("Your text here", {
        left: creativeCanvas.getWidth() / 2,
        top: creativeCanvas.getHeight() / 2,
        originX: "center",
        originY: "center",
        fontSize: 40,
        fill: "#ffffff",
        fontFamily: "system-ui",
        textAlign: "center",
      });
      creativeCanvas.add(text);
      creativeCanvas.setActiveObject(text);
      creativeCanvas.requestRenderAll();
    }

    function addRectObject() {
      if (!creativeCanvas) return;
      const rect = new fabric.Rect({
        left: creativeCanvas.getWidth() / 2 - 150,
        top: creativeCanvas.getHeight() / 2 - 40,
        rx: 10,
        ry: 10,
        width: 300,
        height: 80,
        fill: "rgba(15,23,42,0.9)",
        stroke: "#f97316",
        strokeWidth: 2,
      });
      creativeCanvas.add(rect);
      creativeCanvas.setActiveObject(rect);
      creativeCanvas.requestRenderAll();
    }

    function addBadgeObject() {
      if (!creativeCanvas) return;
      const badge = new fabric.Rect({
        left: creativeCanvas.getWidth() / 2 - 100,
        top: creativeCanvas.getHeight() / 2 - 40,
        rx: 40,
        ry: 40,
        width: 200,
        height: 80,
        fill: "#b91c1c",
        stroke: "#fecaca",
        strokeWidth: 2,
      });
      creativeCanvas.add(badge);
      creativeCanvas.setActiveObject(badge);
      creativeCanvas.requestRenderAll();
    }

    function handleUploadImageClick() {
      if (!imageInput) return;
      imageInput.value = "";
      imageInput.click();
    }

    function handleImageSelected(event) {
      if (!creativeCanvas) return;
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        const dataUrl = e.target.result;
        fabric.Image.fromURL(dataUrl, (img) => {
          const scale = Math.min(
            creativeCanvas.getWidth() / img.width,
            creativeCanvas.getHeight() / img.height,
            1
          );
          img.scale(scale * 0.9);
          img.set({
            left: creativeCanvas.getWidth() / 2,
            top: creativeCanvas.getHeight() / 2,
            originX: "center",
            originY: "center",
          });
          creativeCanvas.add(img);
          creativeCanvas.setActiveObject(img);
          creativeCanvas.requestRenderAll();
        });
      };
      reader.readAsDataURL(file);
    }

    function exportAsPng() {
      if (!creativeCanvas) return;
      const dataUrl = creativeCanvas.toDataURL({
        format: "png",
        quality: 1,
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "lot-rocket-design.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function deleteActiveObject() {
      if (!creativeCanvas) return;
      const active = creativeCanvas.getActiveObject();
      if (active) {
        creativeCanvas.remove(active);
        creativeCanvas.discardActiveObject();
        creativeCanvas.requestRenderAll();
      }
    }

    function getActiveObject() {
      if (!creativeCanvas) return null;
      return creativeCanvas.getActiveObject();
    }

    function updatePropertyPanel() {
      const obj = getActiveObject();

      if (!obj) {
        textOptions.style.display = "none";
        return;
      }

      // Fill color
      if (obj.fill && typeof obj.fill === "string") {
        propFillColor.value = rgbToHex(obj.fill) || propFillColor.value;
      }

      // Stroke
      if (obj.stroke && typeof obj.stroke === "string") {
        propStrokeColor.value = rgbToHex(obj.stroke) || propStrokeColor.value;
      }
      if (typeof obj.strokeWidth === "number") {
        propStrokeWidth.value = obj.strokeWidth;
      }

      // Text-specific options
      if (obj.type === "textbox" || obj.type === "text") {
        textOptions.style.display = "block";
        if (typeof obj.fontSize === "number") {
          propFontSize.value = obj.fontSize;
        }
        if (obj.textAlign) {
          propTextAlign.value = obj.textAlign;
        }
      } else {
        textOptions.style.display = "none";
      }
    }

    function rgbToHex(colorStr) {
      if (!colorStr) return null;
      if (colorStr.startsWith("#")) return colorStr;
      const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!match) return null;
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const toHex = (n) => n.toString(16).padStart(2, "0");
      return "#" + toHex(r) + toHex(g) + toHex(b);
    }

    // ====== SEND RECENT PHOTOS INTO CREATIVE STUDIO ======
    if (sendPhotosToStudioBtn) {
      sendPhotosToStudioBtn.addEventListener("click", () => {
        if (!latestPhotoUrls.length) return;

        // Open the studio (this will init the canvas the first time)
        openCreativeStudio();
        if (!creativeCanvas) return;

        const urls = latestPhotoUrls.slice(0, 8);
        const canvasWidth = creativeCanvas.getWidth();
        const canvasHeight = creativeCanvas.getHeight();

        const cols = Math.min(urls.length, 4);
        const rows = Math.ceil(urls.length / cols);
        const cellW = canvasWidth / cols;
        const cellH = canvasHeight / rows;

        urls.forEach((url, index) => {
          fabric.Image.fromURL(
            url,
            (img) => {
              const scale = Math.min(
                (cellW * 0.9) / img.width,
                (cellH * 0.9) / img.height
              );
              img.scale(scale);
              const col = index % cols;
              const row = Math.floor(index / cols);
              img.set({
                left: col * cellW + cellW / 2,
                top: row * cellH + cellH / 2,
                originX: "center",
                originY: "center",
              });
              creativeCanvas.add(img);
              creativeCanvas.requestRenderAll();
            },
            { crossOrigin: "anonymous" }
          );
        });

        pushHistory();
      });
    }

    // Events
    openCreativeStudioBtn.addEventListener("click", openCreativeStudio);
    closeCreativeStudioBtn.addEventListener("click", closeCreativeStudio);

    exportPngBtn.addEventListener("click", exportAsPng);
    canvasPresetSelect.addEventListener("change", () => {
      applyCanvasPreset();
      pushHistory();
    });

    undoBtn.addEventListener("click", handleUndo);
    redoBtn.addEventListener("click", handleRedo);
    deleteBtn.addEventListener("click", deleteActiveObject);

    imageInput.addEventListener("change", handleImageSelected);

    toolButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-tool");
        if (!tool) return;

        if (tool === "uploadImage") {
          handleUploadImageClick();
          return;
        }

        setActiveTool(tool);

        if (tool === "addText") {
          addTextObject();
        } else if (tool === "addRect") {
          addRectObject();
        } else if (tool === "addBadge") {
          addBadgeObject();
        } else if (tool === "select") {
          // Fabric already handles selection
        }
      });
    });

    // Property changes
    propFillColor.addEventListener("input", () => {
      const obj = getActiveObject();
      if (!obj) return;
      obj.set("fill", propFillColor.value);
      creativeCanvas.requestRenderAll();
    });

    propStrokeColor.addEventListener("input", () => {
      const obj = getActiveObject();
      if (!obj) return;
      obj.set("stroke", propStrokeColor.value);
      creativeCanvas.requestRenderAll();
    });

    propStrokeWidth.addEventListener("input", () => {
      const obj = getActiveObject();
      if (!obj) return;
      const val = parseInt(propStrokeWidth.value, 10) || 0;
      obj.set("strokeWidth", val);
      creativeCanvas.requestRenderAll();
    });

    propFontSize.addEventListener("input", () => {
      const obj = getActiveObject();
      if (!obj) return;
      if (obj.type === "textbox" || obj.type === "text") {
        const val = parseInt(propFontSize.value, 10) || 16;
        obj.set("fontSize", val);
        creativeCanvas.requestRenderAll();
      }
    });

    propTextAlign.addEventListener("change", () => {
      const obj = getActiveObject();
      if (!obj) return;
      if (obj.type === "textbox") {
        obj.set("textAlign", propTextAlign.value);
        creativeCanvas.requestRenderAll();
      }
    });

    // Optional: close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !creativeOverlay.classList.contains("hidden")) {
        closeCreativeStudio();
      }
    });
  }
} // <-- closes the Creative Studio wrapper

  // ---------- MODAL OPEN/CLOSE WIRING ----------
  function wireModal(triggerId, modalId, closeId) {
    const trigger = document.getElementById(triggerId);
    const modal = document.getElementById(modalId);
    const close = document.getElementById(closeId);

    if (!trigger || !modal || !close) return;

    trigger.addEventListener("click", () => {
      modal.classList.remove("hidden");
    });

    close.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });
  }

  wireModal("objectionLauncher", "objectionModal", "objectionClose");
  wireModal("calcLauncher", "calcModal", "calcClose");
  wireModal("paymentLauncher", "paymentModal", "paymentClose");
  wireModal("incomeLauncher", "incomeModal", "incomeClose");
  wireModal("workflowLauncher", "workflowModal", "workflowClose");
  wireModal("messageLauncher", "messageModal", "messageClose");
  wireModal("askLauncher", "askModal", "askClose");
  wireModal("carLauncher", "carModal", "carClose");
  wireModal("imageLauncher", "imageModal", "imageClose");
  wireModal("videoLauncher", "videoModal", "videoClose");
});
