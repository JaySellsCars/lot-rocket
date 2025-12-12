// public/app.js – Lot Rocket frontend logic v2.5.9 (CLEANED)
// Stable: theme toggle, Boost, calculators, side tools.
// Step 3: Creative Hub (Fabric) + Design Studio 3.5 (Konva) + Social Strip.

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Lot Rocket frontend loaded v2.5.9");
  const apiBase = "";

  // ==================================================
  // UTIL
  // ==================================================
  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 4 + "px";
  }

  // Auto-grow ALL textareas
  document.querySelectorAll("textarea").forEach((ta) => {
    autoResizeTextarea(ta);
    ta.addEventListener("input", () => autoResizeTextarea(ta));
  });

  const BRAND = {
    primary: "#f97316",
    secondary: "#ec4899",
    dark: "#020617",
    light: "#f9fafb",
    textLight: "#f9fafb",
    textDark: "#020617",
  };

  const STUDIO_STORAGE_KEY = "lotRocketDesignStudio";

  // ==================================================
  // THEME TOGGLE
  // ==================================================
  const themeToggleInput = document.getElementById("themeToggle");
  if (themeToggleInput) {
    const applyTheme = (isDark) => {
      document.body.classList.toggle("dark-theme", !!isDark);
      themeToggleInput.checked = !!isDark;
    };
    applyTheme(true);
    themeToggleInput.addEventListener("change", () => applyTheme(themeToggleInput.checked));
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

  // Dealer photos state
  let dealerPhotos = []; // [{ src, selected }]

  function renderDealerPhotos() {
    if (!photosGrid) return;
    photosGrid.innerHTML = "";

    dealerPhotos.forEach((photo, index) => {
      const wrapper = document.createElement("button");
      wrapper.type = "button";
      wrapper.className = "photo-thumb-btn" + (photo.selected ? " photo-thumb-selected" : "");
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
        if (!dealerPhotos[idx]) return;
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
        body: JSON.stringify({ url, labelOverride, priceOverride }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Boost failed (HTTP ${res.status}).`);

      if (summaryLabel) summaryLabel.textContent = data.vehicleLabel || "—";
      if (summaryPrice) summaryPrice.textContent = data.priceInfo || "—";

      if (vehicleLabelInput && !vehicleLabelInput.value) vehicleLabelInput.value = data.vehicleLabel || "";
      if (priceInfoInput && !priceInfoInput.value) priceInfoInput.value = data.priceInfo || "";

      const setTA = (el, v) => {
        if (!el) return;
        el.value = v || "";
        autoResizeTextarea(el);
      };

      setTA(facebookPost, data.facebook);
      setTA(instagramPost, data.instagram);
      setTA(tiktokPost, data.tiktok);
      setTA(linkedinPost, data.linkedin);
      setTA(twitterPost, data.twitter);
      setTA(textBlurb, data.text);
      setTA(marketplacePost, data.marketplace);
      setTA(hashtags, data.hashtags);

      const photos = Array.isArray(data.photos) ? data.photos.slice(0, 40) : [];
      dealerPhotos = photos.map((src) => ({ src, selected: false }));
      renderDealerPhotos();

      document.body.classList.add("kit-ready");
      if (statusText) statusText.textContent = "Social kit ready ✔";
    } catch (err) {
      console.error("❌ Boost error:", err);
      if (statusText) statusText.textContent = err?.message || "Failed to build kit.";
    } finally {
      boostButton.disabled = false;
    }
  }

  if (boostButton) boostButton.addEventListener("click", doBoostListing);

  // ==================================================
  // COPY / REGEN
  // ==================================================
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
        const label = vehicleLabelInput?.value.trim() || summaryLabel?.textContent || "";
        const price = priceInfoInput?.value.trim() || summaryPrice?.textContent || "";

        const res = await fetch(apiBase + "/api/new-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, url, label, price }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `Regen failed (HTTP ${res.status}).`);

        const text = data.text || "";
        const map = {
          facebook: "facebookPost",
          instagram: "instagramPost",
          tiktok: "tiktokPost",
          linkedin: "linkedinPost",
          twitter: "twitterPost",
          text: "textBlurb",
          marketplace: "marketplacePost",
          hashtags: "hashtags",
        };

        const targetId = map[platform] || "";
        const ta = targetId ? document.getElementById(targetId) : null;
        if (ta) {
          ta.value = text;
          autoResizeTextarea(ta);
        }
      } catch (err) {
        console.error("❌ regen error", err);
        alert(err?.message || "Failed to generate a new post.");
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });

  // ==================================================
  // RIGHT-SIDE TOOL MODALS (DRAWERS)
  // ==================================================
  const videoContextField = document.getElementById("videoContext");

  function buildVideoContextFromKit() {
    const parts = [];
    const label =
      vehicleLabelInput?.value.trim() ||
      (summaryLabel?.textContent || "").trim() ||
      "";
    const price =
      priceInfoInput?.value.trim() ||
      (summaryPrice?.textContent || "").trim() ||
      "";
    const url = vehicleUrlInput ? vehicleUrlInput.value.trim() : "";
    const tags = hashtags ? (hashtags.value || "").trim() : "";

    if (label) parts.push(`Vehicle: ${label}`);
    if (price) parts.push(`Price/Offer: ${price}`);
    if (url) parts.push(`Listing URL: ${url}`);
    if (tags) parts.push(`Hashtags: ${tags}`);

    return parts.join("\n");
  }

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
    if (!launcher || !modal) return;

    if (launcher.dataset.wired === "true") return;
    launcher.dataset.wired = "true";

    const closeBtn =
      modal.querySelector(".side-modal-close") ||
      modal.querySelector(".modal-close-btn");

    const close = () => {
      modal.classList.add("hidden");
      modal.style.display = "none";
    };

    launcher.addEventListener("click", () => {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
      if (typeof onOpen === "function") onOpen();
    });

    if (closeBtn && closeBtn.dataset.wired !== "true") {
      closeBtn.dataset.wired = "true";
      closeBtn.addEventListener("click", close);
    }

    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
  }

  TOOL_CONFIG.forEach(([launcherId, modalId]) => {
    if (launcherId === "videoLauncher") {
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

  // ==================================================
  // BASIC CALCULATOR (scratchpad keypad)
  // ==================================================
  const basicCalcDisplay = document.getElementById("basicCalcDisplay");
  const basicCalcButtons = document.querySelectorAll("[data-calc-key]");

  if (basicCalcDisplay && basicCalcButtons.length) {
    let calcExpr = "";

    const renderCalc = () => (basicCalcDisplay.value = calcExpr || "0");

    basicCalcButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-calc-key");
        if (!key) return;

        if (key === "C") calcExpr = "";
        else if (key === "DEL") calcExpr = calcExpr.slice(0, -1);
        else if (key === "=") {
          try {
            // eslint-disable-next-line no-eval
            calcExpr = String(eval(calcExpr || "0"));
          } catch {
            calcExpr = "";
          }
        } else calcExpr += key;

        renderCalc();
      });
    });

    renderCalc();
  }

  // ==================================================
  // PAYMENT CALCULATOR
  // ==================================================
  const paymentForm = document.getElementById("paymentForm");
  if (paymentForm) {
    const priceInput = document.getElementById("paymentPrice");
    const cashDownInput = document.getElementById("paymentCashDown");
    const tradeValueInput = document.getElementById("paymentTradeValue");
    const tradeOweInput = document.getElementById("paymentTradeOwe");
    const rateInput = document.getElementById("paymentRate");
    const termInput = document.getElementById("paymentTerm");
    const taxInput = document.getElementById("paymentTax");

    const paymentMonthlyEl = document.getElementById("paymentMonthly");
    const paymentDetailsEl = document.getElementById("paymentDetails");

    const cleanNumber = (val) => {
      if (!val) return 0;
      const n = parseFloat(String(val).replace(/[^0-9.]/g, ""));
      return Number.isNaN(n) ? 0 : n;
    };

    paymentForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const price = cleanNumber(priceInput?.value);
      const cashDown = cleanNumber(cashDownInput?.value);
      const tradeValue = cleanNumber(tradeValueInput?.value);
      const tradeOwe = cleanNumber(tradeOweInput?.value);
      const apr = parseFloat(rateInput?.value || "0");
      const years = parseFloat(termInput?.value || "0");
      const taxRate = parseFloat(taxInput?.value || "0");

      if (!price || !years) {
        if (paymentDetailsEl)
          paymentDetailsEl.textContent = "Please enter at least a vehicle price and term in years.";
        return;
      }

      const taxableBase = Math.max(price - tradeValue, 0);
      const taxAmount = taxableBase * (taxRate / 100);

      let financedBeforeTax = price - cashDown - tradeValue + tradeOwe;
      if (financedBeforeTax < 0) financedBeforeTax = 0;

      const amountFinanced = financedBeforeTax + taxAmount;
      const months = years * 12;

      let monthly = 0;
      if (apr > 0) {
        const monthlyRate = apr / 100 / 12;
        const factor = Math.pow(1 + monthlyRate, months);
        monthly = (amountFinanced * (monthlyRate * factor)) / (factor - 1);
      } else {
        monthly = amountFinanced / months;
      }

      const negativeEquity = Math.max(tradeOwe - tradeValue, 0);

      const fmtMoney = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      if (paymentMonthlyEl) paymentMonthlyEl.textContent = `$${fmtMoney(monthly)}`;

      let details = `Amount Financed (est.): $${fmtMoney(amountFinanced)}. `;
      details += `Includes approx. $${fmtMoney(taxAmount)} in tax. `;
      if (negativeEquity > 0) details += `Rolled-in negative equity: $${fmtMoney(negativeEquity)}. `;
      details += "This is an estimate only; final figures may vary by lender and fees.";

      if (paymentDetailsEl) paymentDetailsEl.textContent = details;
    });
  }

  // ==================================================
  // INCOME CALCULATOR
  // ==================================================
  const incomeForm = document.getElementById("incomeForm");
  if (incomeForm) {
    const incomeYtdInput = document.getElementById("incomeYtd");
    const incomeLastPaycheckInput = document.getElementById("incomeLastPaycheck");
    const incomeOutput = document.getElementById("incomeOutput");

    incomeForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const rawYtd = (incomeYtdInput?.value || "").replace(/[^0-9.]/g, "");
      const ytd = parseFloat(rawYtd);
      if (!ytd || Number.isNaN(ytd)) {
        if (incomeOutput) incomeOutput.textContent = "Please enter your year-to-date gross income (numbers only).";
        return;
      }

      if (!incomeLastPaycheckInput?.value) {
        if (incomeOutput) incomeOutput.textContent = "Please choose the date of your last paycheck.";
        return;
      }

      const lastDate = new Date(incomeLastPaycheckInput.value + "T12:00:00");
      if (Number.isNaN(lastDate.getTime())) {
        if (incomeOutput) incomeOutput.textContent = "That paycheck date doesn’t look valid.";
        return;
      }

      const year = lastDate.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const diffMs = lastDate - startOfYear;
      const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

      const weeksIntoYear = dayOfYear / 7;
      const dailyRate = ytd / dayOfYear;
      const estYearly = dailyRate * 365;
      const estMonthly = estYearly / 12;

      const fmtMoney0 = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

      if (incomeOutput) {
        incomeOutput.textContent =
          `Estimated Yearly Gross: $${fmtMoney0(estYearly)}  ` +
          `Weeks into Year: ${weeksIntoYear.toFixed(1)}  ` +
          `Estimated Average Monthly Income: $${fmtMoney0(estMonthly)}`;
      }
    });
  }

  // ==================================================
  // OBJECTION COACH (server endpoint)
  // ==================================================
  const objectionForm = document.getElementById("objectionForm");
  const objectionOutput = document.getElementById("objectionOutput");

  if (objectionForm && objectionOutput) {
    objectionForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(objectionForm);
      const payload = {};
      formData.forEach((value, key) => (payload[key] = value));

      objectionOutput.value = "Coaching that objection…";
      autoResizeTextarea(objectionOutput);

      try {
        const res = await fetch(apiBase + "/api/objection-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `Error (HTTP ${res.status}) from objection coach.`);

        const reply = data?.coachedMessage || data?.answer || data?.message || "";
        if (!reply.trim()) throw new Error("Empty coached reply from server");

        objectionOutput.value = reply;
      } catch (err) {
        console.error("Objection coach error:", err);
        objectionOutput.value = "Lot Rocket couldn't coach that objection right now. Try again in a bit.";
      }

      autoResizeTextarea(objectionOutput);
    });
  }

  // ==================================================
  // OBJECTION DRILL MODE – Q&A + GRADING
  // ==================================================
  const drillLauncher = document.getElementById("drillLauncher");
  const drillModal = document.getElementById("drillModeModal");
  const closeDrillModeBtn = document.getElementById("closeDrillMode");

  const drillObjectionText = document.getElementById("drillObjectionText");
  const getDrillObjectionBtn = document.getElementById("getDrillObjection");

  const drillReplyInput = document.getElementById("drillReplyInput");
  const gradeDrillReplyBtn = document.getElementById("gradeDrillReply");

  const drillResult = document.getElementById("drillResult");
  const drillTimerDisplay = document.getElementById("drillTimer");

  const DRILL_OBJECTIONS = [
    "The price is too high.",
    "I need to talk to my spouse first.",
    "I want to think about it.",
    "Can you send me some numbers and I’ll get back to you?",
    "I’m just looking right now, not ready to buy.",
    "My payment can’t go up at all.",
    "I found something cheaper online.",
    "I don’t want to run my credit.",
  ];

  let currentDrillObjection = "";
  let drillTimerId = null;
  let drillSecondsLeft = 0;

  function setDrillResult(message = "", show = false) {
    if (!drillResult) return;
    drillResult.textContent = message;
    drillResult.classList.toggle("hidden", !show);
  }

  function stopDrillTimer() {
    if (drillTimerId) {
      clearInterval(drillTimerId);
      drillTimerId = null;
    }
  }

  function resetDrillState() {
    if (drillReplyInput) drillReplyInput.value = "";
    setDrillResult("", false);
    if (drillTimerDisplay) drillTimerDisplay.textContent = "60";
  }

  function startDrillTimer(startSeconds = 60) {
    if (!drillTimerDisplay) return;

    stopDrillTimer();
    drillSecondsLeft = Number.isFinite(startSeconds) ? startSeconds : 60;
    drillTimerDisplay.textContent = String(drillSecondsLeft);

    drillTimerId = setInterval(() => {
      drillSecondsLeft = Math.max(0, drillSecondsLeft - 1);
      drillTimerDisplay.textContent = String(drillSecondsLeft);
      if (drillSecondsLeft <= 0) stopDrillTimer();
    }, 1000);
  }

  function openDrillModal() {
    if (!drillModal) return;
    drillModal.classList.remove("hidden");
    resetDrillState();
  }

  function closeDrillModal() {
    if (!drillModal) return;
    drillModal.classList.add("hidden");
    stopDrillTimer();
  }

  if (drillLauncher && closeDrillModeBtn) {
    drillLauncher.addEventListener("click", openDrillModal);
    closeDrillModeBtn.addEventListener("click", closeDrillModal);
  }

  if (getDrillObjectionBtn && drillObjectionText) {
    getDrillObjectionBtn.addEventListener("click", () => {
      if (!DRILL_OBJECTIONS.length) return;
      const idx = Math.floor(Math.random() * DRILL_OBJECTIONS.length);
      currentDrillObjection = DRILL_OBJECTIONS[idx];
      drillObjectionText.textContent = currentDrillObjection;
      resetDrillState();
      startDrillTimer(60);
      drillReplyInput?.focus?.();
    });
  }

  if (gradeDrillReplyBtn && drillReplyInput) {
    gradeDrillReplyBtn.addEventListener("click", async () => {
      const reply = (drillReplyInput.value || "").trim();

      if (!currentDrillObjection) {
        setDrillResult('Hit “Give Me an Objection” first.', true);
        return;
      }
      if (!reply) {
        setDrillResult("Type your response first, then I’ll grade it.", true);
        return;
      }

      stopDrillTimer();
      setDrillResult("Grading your reply and building coaching tips...", true);

      try {
        const res = await fetch(apiBase + "/api/message-helper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "objection-drill",
            objection: currentDrillObjection,
            reply,
            secondsRemaining: drillSecondsLeft,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `AI grading failed (HTTP ${res.status}).`);

        setDrillResult(
          data.text ||
            "I couldn’t grade that one, but keep practicing and try another objection.",
          true
        );
      } catch (err) {
        console.error("Drill Mode grading error:", err);
        setDrillResult(err?.message || "There was an error talking to AI. Try again in a moment.", true);
      }
    });
  }

  // ==================================================
  // AI HELPERS (message-helper)
  // ==================================================
  function wireMessageHelper(formId, outputId, mode) {
    const form = document.getElementById(formId);
    const output = document.getElementById(outputId);
    if (!form || !output) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      const payload = { mode };
      fd.forEach((value, key) => (payload[key] = value));

      output.value = "Spinning up AI...";
      autoResizeTextarea(output);

      try {
        const res = await fetch(apiBase + "/api/message-helper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} from message helper${text ? `: ${text}` : ""}`);
        }

        const data = await res.json().catch(() => ({}));
        const text =
          (typeof data?.text === "string" && data.text.trim()) ||
          (typeof data?.message === "string" && data.message.trim()) ||
          "";

        output.value = text || "AI didn't return a message. Try again.";
      } catch (err) {
        console.error("Message helper error:", err);
        output.value = "Lot Rocket hit a snag talking to AI. Try again in a minute.";
      }

      autoResizeTextarea(output);
    });
  }

  wireMessageHelper("messageForm", "messageOutput", "message");
  wireMessageHelper("askForm", "askOutput", "ask");
  wireMessageHelper("carForm", "carOutput", "car");
  wireMessageHelper("imageForm", "imageOutput", "image-brief");

  // ==================================================
  // VIDEO SHOT PLAN + SCRIPT
  // ==================================================
  const videoFormEl = document.getElementById("videoForm");
  const videoScriptOutput = document.getElementById("videoScriptOutput");
  const videoShotListOutput = document.getElementById("videoShotListOutput");
  const videoAIPromptOutput = document.getElementById("videoAIPromptOutput");
  const videoThumbPromptOutput = document.getElementById("videoThumbPromptOutput");

  const videoScriptOutputBottom = document.getElementById("videoScriptOutputBottom");
  const videoShotListOutputBottom = document.getElementById("videoShotListOutputBottom");
  const videoAIPromptOutputBottom = document.getElementById("videoAIPromptOutputBottom");
  const videoThumbPromptOutputBottom = document.getElementById("videoThumbPromptOutputBottom");

  function populateVideoOutputs(sections) {
    if (!sections) return;
    const { script = "", shots = "", aiPrompt = "", thumbPrompt = "" } = sections;

    const set = (el, v) => {
      if (!el) return;
      el.value = v || "";
      autoResizeTextarea(el);
    };

    set(videoScriptOutput, script);
    set(videoShotListOutput, shots);
    set(videoAIPromptOutput, aiPrompt);
    set(videoThumbPromptOutput, thumbPrompt);

    set(videoScriptOutputBottom, script);
    set(videoShotListOutputBottom, shots);
    set(videoAIPromptOutputBottom, aiPrompt);
    set(videoThumbPromptOutputBottom, thumbPrompt);
  }

  function parseVideoSections(full) {
    if (!full || typeof full !== "string") return { script: "", shots: "", aiPrompt: "", thumbPrompt: "" };

    const h1 = "### 1. Video Script";
    const h2 = "### 2. Shot List";
    const h3 = "### 3. AI Video Generator Prompt";
    const h4 = "### 4. Thumbnail Prompt";

    function getSection(startMarker, endMarker) {
      const startIdx = full.indexOf(startMarker);
      if (startIdx === -1) return "";
      const fromStart = full.slice(startIdx + startMarker.length);
      if (!endMarker) return fromStart.trim();
      const endIdx = fromStart.indexOf(endMarker);
      if (endIdx === -1) return fromStart.trim();
      return fromStart.slice(0, endIdx).trim();
    }

    return {
      script: getSection(h1, h2),
      shots: getSection(h2, h3),
      aiPrompt: getSection(h3, h4),
      thumbPrompt: getSection(h4, null),
    };
  }

  if (videoFormEl) {
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
        fd.forEach((value, key) => (payload[key] = value));

        const res = await fetch(apiBase + "/api/message-helper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `Video builder error (HTTP ${res.status}).`);

        const full = data.text || "";
        populateVideoOutputs(parseVideoSections(full));
      } catch (err) {
        console.error("❌ Video builder error:", err);
        alert("Lot Rocket hit a snag building that video shot plan. Try again in a moment.");
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

  const hiddenTunerCanvas = document.createElement("canvas");
  const hiddenTunerCtx = hiddenTunerCanvas.getContext ? hiddenTunerCanvas.getContext("2d") : null;

  let currentTunerFilter = "";

  // Social strip UI
  const socialCarousel = document.getElementById("socialCarousel");
  const openCanvasFromCarouselBtn = document.getElementById("openCanvasFromCarousel");
  const openDesignFromCarouselBtn = document.getElementById("openDesignFromCarousel");
  const revertSocialPhotoBtn = document.getElementById("revertSocialPhotoBtn");
  const downloadAllEditedBtn = document.getElementById("downloadAllEditedBtn");

  const socialCarouselPreviewImg = document.getElementById("socialCarouselPreviewImg");
  const socialPrevBtn = document.getElementById("socialPrevBtn");
  const socialNextBtn = document.getElementById("socialNextBtn");
  const socialCarouselStatus = document.getElementById("socialCarouselStatus");

  // Canvas overlay
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

  // Social-ready photos: [{ url, selected, originalUrl, locked }]
  let socialReadyPhotos = [];
  let socialCurrentIndex = 0;

  const MAX_STEP3_PHOTOS = 24;

  // ---------------- Step 1 → Send Top Photos
  const step1SendTopBtn = document.getElementById("sendTopPhotosBtn");
  if (step1SendTopBtn) {
    step1SendTopBtn.addEventListener("click", () => {
      if (!dealerPhotos || !dealerPhotos.length) {
        alert("Boost a listing first so Lot Rocket can grab photos.");
        return;
      }

      const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
      const chosen = (selected.length ? selected : dealerPhotos.map((p) => p.src)).slice(0, 12);
      if (!chosen.length) {
        alert("No photos available to send.");
        return;
      }

      step1SendTopBtn.disabled = true;
      step1SendTopBtn.classList.add("loading");

      chosen.forEach((url) => {
        localCreativePhotos.push(url);
        addCreativeThumb(url);

        if (tunerPreviewImg && !tunerPreviewImg.src) {
          tunerPreviewImg.src = url;
          applyTunerFilters();
        }
      });

      renderSocialCarousel();

      step1SendTopBtn.classList.remove("loading");
      step1SendTopBtn.classList.add("success");
      setTimeout(() => {
        step1SendTopBtn.classList.remove("success");
        step1SendTopBtn.disabled = false;
      }, 900);
    });
  }

  // ---------------- Tuner
  function applyTunerFilters() {
    if (!tunerPreviewImg) return;
    const b = tunerBrightness ? Number(tunerBrightness.value || 100) : 100;
    const c = tunerContrast ? Number(tunerContrast.value || 100) : 100;
    const s = tunerSaturation ? Number(tunerSaturation.value || 100) : 100;
    currentTunerFilter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    tunerPreviewImg.style.filter = currentTunerFilter;
  }

  tunerBrightness?.addEventListener("input", applyTunerFilters);
  tunerContrast?.addEventListener("input", applyTunerFilters);
  tunerSaturation?.addEventListener("input", applyTunerFilters);

  autoEnhanceBtn?.addEventListener("click", () => {
    if (tunerBrightness) tunerBrightness.value = "115";
    if (tunerContrast) tunerContrast.value = "115";
    if (tunerSaturation) tunerSaturation.value = "120";
    applyTunerFilters();
  });

  async function buildEditedDataUrl(src) {
    if (!src || !hiddenTunerCanvas || !hiddenTunerCtx) return src;

    return new Promise((resolve) => {
      const img = new Image();

      // NOTE: crossOrigin only helps if server allows it — otherwise toDataURL will fail
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
          console.warn("[LotRocket] Canvas tainted, using original URL:", err);
          resolve(src);
        }
      };

      img.onerror = () => resolve(src);
      img.src = src;
    });
  }

  // ---------------- Creative thumbs
  function addCreativeThumb(url) {
    if (!creativeThumbGrid) return;

    const img = document.createElement("img");
    img.src = url;
    img.alt = "Creative photo";
    img.loading = "lazy";
    img.className = "creative-thumb";
    img.title = "Click to select/deselect. Double-click to send edited copy to social strip.";

    img.addEventListener("click", () => {
      img.classList.toggle("selected");
      if (tunerPreviewImg) {
        tunerPreviewImg.src = url;
        applyTunerFilters();
      }
    });

    img.addEventListener("dblclick", async () => {
      const editedUrl = await buildEditedDataUrl(url);
      addPhotoToSocialReady(editedUrl);
    });

    creativeThumbGrid.appendChild(img);

    const thumbs = creativeThumbGrid.querySelectorAll(".creative-thumb");
    if (thumbs.length > MAX_STEP3_PHOTOS) {
      const extra = thumbs.length - MAX_STEP3_PHOTOS;
      for (let i = 0; i < extra; i++) creativeThumbGrid.removeChild(thumbs[i]);
    }
  }

  function handleCreativeFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    files.forEach((file) => {
      if (!file?.type?.startsWith("image/")) return;
      const url = URL.createObjectURL(file);

      localCreativePhotos.push(url);
      if (localCreativePhotos.length > MAX_STEP3_PHOTOS) {
        localCreativePhotos = localCreativePhotos.slice(-MAX_STEP3_PHOTOS);
      }

      addCreativeThumb(url);

      if (tunerPreviewImg && !tunerPreviewImg.src) {
        tunerPreviewImg.src = url;
        applyTunerFilters();
      }
    });
  }

  // Dropzone
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

    ["dragleave", "dragend"].forEach((evt) => {
      photoDropZone.addEventListener(evt, (e) => {
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
      let files = dt?.files;

      if ((!files || !files.length) && dt?.items) {
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

  // ==================================================
  // SOCIAL STRIP (THIS WAS BROKEN BEFORE — FIXED HERE)
  // ==================================================
  function addPhotoToSocialReady(url) {
    if (!url) return;

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

    socialReadyPhotos.push({
      url,
      originalUrl: url,
      selected: true,
      locked: false,
    });

    if (socialReadyPhotos.length > MAX_STEP3_PHOTOS) {
      socialReadyPhotos = socialReadyPhotos.slice(-MAX_STEP3_PHOTOS);
    }

    socialCurrentIndex = socialReadyPhotos.length - 1;
    renderSocialCarousel();
  }

  function updateSocialPreview() {
    if (!socialCarouselPreviewImg) return;

    if (!socialReadyPhotos.length) {
      socialCarouselPreviewImg.src = "";
      socialCarouselPreviewImg.alt = "";
      if (socialCarouselStatus) {
        socialCarouselStatus.textContent = "No social-ready photos yet. Double-click a photo above to add it.";
      }
      return;
    }

    socialCurrentIndex = Math.max(0, Math.min(socialCurrentIndex, socialReadyPhotos.length - 1));
    const active = socialReadyPhotos[socialCurrentIndex];
    if (!active?.url) return;

    socialCarouselPreviewImg.src = active.url;
    socialCarouselPreviewImg.alt = "Social-ready preview";

    if (socialCarouselStatus) {
      const selectedCount = socialReadyPhotos.filter((p) => p.selected).length;
      socialCarouselStatus.textContent = `Photo ${socialCurrentIndex + 1}/${socialReadyPhotos.length} • Selected: ${selectedCount}`;
    }
  }

  function renderSocialCarousel() {
    if (!socialCarousel) return;
    socialCarousel.innerHTML = "";

    socialReadyPhotos.forEach((photo, index) => {
      if (typeof photo.locked !== "boolean") photo.locked = false;

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

      const controls = document.createElement("div");
      controls.className = "social-carousel-controls";

      const lockBtn = document.createElement("button");
      lockBtn.type = "button";
      lockBtn.className = "social-carousel-control-btn lock-btn";
      lockBtn.title = photo.locked ? "Unlock this photo so it can be removed" : "Lock this photo so it can't be removed";
      lockBtn.textContent = photo.locked ? "🔒" : "🔓";

      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(item.dataset.index || "0");
        const p = socialReadyPhotos[idx];
        if (!p) return;
        p.locked = !p.locked;
        renderSocialCarousel();
      });

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
          alert("This photo is locked. Unlock it first if you want to remove it.");
          return;
        }

        item.classList.add("social-carousel-item-removing");
        setTimeout(() => {
          socialReadyPhotos.splice(idx, 1);
          if (socialCurrentIndex >= socialReadyPhotos.length) socialCurrentIndex = socialReadyPhotos.length - 1;
          if (socialCurrentIndex < 0) socialCurrentIndex = 0;
          renderSocialCarousel();
        }, 160);
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

      item.addEventListener("click", (e) => {
        if (e.target.closest(".social-carousel-control-btn")) return;
        const idx = Number(item.dataset.index || "0");
        if (!socialReadyPhotos[idx]) return;
        socialReadyPhotos[idx].selected = !socialReadyPhotos[idx].selected;
        socialCurrentIndex = idx;
        renderSocialCarousel();
      });

      item.addEventListener("dblclick", (e) => {
        e.preventDefault();
        removePhotoWithAnimation();
      });
    });

    updateSocialPreview();
  }

  socialPrevBtn?.addEventListener("click", () => {
    if (!socialReadyPhotos.length) return;
    socialCurrentIndex = (socialCurrentIndex - 1 + socialReadyPhotos.length) % socialReadyPhotos.length;
    updateSocialPreview();
  });

  socialNextBtn?.addEventListener("click", () => {
    if (!socialReadyPhotos.length) return;
    socialCurrentIndex = (socialCurrentIndex + 1) % socialReadyPhotos.length;
    updateSocialPreview();
  });

  // Revert
  revertSocialPhotoBtn?.addEventListener("click", () => {
    if (!socialReadyPhotos.length) {
      alert("No social-ready photos to revert.");
      return;
    }
    const photo = socialReadyPhotos[socialCurrentIndex];
    if (!photo?.originalUrl) {
      alert("No original version saved for this photo.");
      return;
    }
    photo.url = photo.originalUrl;
    renderSocialCarousel();
  });

  // Download helper (proxy-aware)
  function getProxiedImageUrl(rawUrl) {
    if (!rawUrl) return rawUrl;
    try {
      const u = new URL(rawUrl, window.location.origin);
      if (u.origin === window.location.origin || u.protocol === "blob:" || u.protocol === "data:") return rawUrl;
      if (u.pathname.startsWith("/api/proxy-image")) return rawUrl;
      return `/api/proxy-image?url=${encodeURIComponent(u.toString())}`;
    } catch {
      return rawUrl;
    }
  }

  function triggerSocialDownload(url, index) {
    if (!url) return;
    const safeUrl = typeof getProxiedImageUrl === "function" ? getProxiedImageUrl(url) : url;
    const a = document.createElement("a");
    a.href = safeUrl;
    a.download = `lot-rocket-photo-${(index ?? 0) + 1}.jpg`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  downloadAllEditedBtn?.addEventListener("click", () => {
    if (!socialReadyPhotos.length) {
      alert("No social-ready photos to download. Double-click a photo in the grid above first.");
      return;
    }

    const urls = socialReadyPhotos.map((p) => p?.url).filter(Boolean);
    if (!urls.length) return;

    const originalLabel = downloadAllEditedBtn.textContent;
    downloadAllEditedBtn.disabled = true;
    downloadAllEditedBtn.textContent = "Downloading JPGs…";

    urls.forEach((url, index) => {
      setTimeout(() => triggerSocialDownload(url, index), index * 200);
    });

    setTimeout(() => {
      downloadAllEditedBtn.disabled = false;
      downloadAllEditedBtn.textContent = originalLabel || "Download JPGs";
    }, urls.length * 200 + 400);
  });

  // ==================================================
  // CANVAS STUDIO (Fabric) — minimal stable wiring
  // ==================================================
  function ensureCanvas() {
    if (creativeCanvas) return creativeCanvas;
    if (typeof fabric === "undefined") {
      console.error("Fabric.js not loaded");
      return null;
    }
    creativeCanvas = new fabric.Canvas("creativeCanvas", { preserveObjectStacking: true });
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
    creativeCanvas.loadFromJSON(creativeHistory[index], () => creativeCanvas.renderAll());
  }

  function addImageFromUrl(url) {
    const canvas = ensureCanvas();
    if (!canvas || !url) return;

    // use proxied URL for cross-origin
    const safeUrl = getProxiedImageUrl(url);

    fabric.Image.fromURL(
      safeUrl,
      (img) => {
        if (!img) return;
        const scale = Math.min(canvas.width / (img.width * 1.2), canvas.height / (img.height * 1.2), 1);
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
      { crossOrigin: "anonymous" }
    );
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

  canvasLauncher?.addEventListener("click", openCreativeStudio);

  if (creativeCloseBtn && creativeStudioOverlay) {
    creativeCloseBtn.addEventListener("click", closeCreativeStudio);
    creativeStudioOverlay.addEventListener("click", (e) => {
      if (e.target === creativeStudioOverlay) closeCreativeStudio();
    });
  }

  canvasPresetSelect?.addEventListener("change", () => {
    const canvas = ensureCanvas();
    if (!canvas) return;
    const [w, h] = canvasPresetSelect.value.split("x").map(Number);
    canvas.setWidth(w);
    canvas.setHeight(h);
    canvas.calcOffset();
    canvas.renderAll();
    saveCanvasState();
  });

  creativeUndo?.addEventListener("click", () => {
    if (creativeHistoryIndex > 0) loadCanvasState(creativeHistoryIndex - 1);
  });

  creativeRedo?.addEventListener("click", () => {
    if (creativeHistoryIndex < creativeHistory.length - 1) loadCanvasState(creativeHistoryIndex + 1);
  });

  creativeDelete?.addEventListener("click", () => {
    if (!creativeCanvas) return;
    const active = creativeCanvas.getActiveObject();
    if (!active) return;
    creativeCanvas.remove(active);
    creativeCanvas.discardActiveObject();
    creativeCanvas.renderAll();
    saveCanvasState();
  });

  creativeExportPng?.addEventListener("click", () => {
    const canvas = ensureCanvas();
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL({ format: "png", quality: 1.0 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "lot-rocket-creative.png";
      a.click();
    } catch (err) {
      console.error("Export PNG error:", err);
      alert("Browser blocked exporting this image (CORS). Some dealer images may not export.");
    }
  });

  if (creativeImageInput) {
    creativeImageInput.addEventListener("change", (e) => {
      const files = e.target.files;
      if (!files?.length) return;
      handleCreativeFiles(files);
      creativeImageInput.value = "";
    });
  }

  creativeToolButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = btn.getAttribute("data-tool");
      if (!tool) return;

      creativeToolButtons.forEach((b) => b.classList.remove("tool-btn-active"));
      btn.classList.add("tool-btn-active");

      if (tool === "uploadImage" && creativeImageInput) creativeImageInput.click();
    });
  });

  // ==================================================
  // DESIGN STUDIO 3.5 (Konva) — cleaned init + loader
  // ==================================================
  const designStudioOverlay = document.getElementById("designStudioOverlay");
  const designLauncher = document.getElementById("designLauncher");
  const designCloseBtn = document.getElementById("designClose");

  const studioExportPng = document.getElementById("studioExportPng");
  const studioUndoBtn = document.getElementById("studioUndoBtn");
  const studioRedoBtn = document.getElementById("studioRedoBtn");
  const studioSizePreset = document.getElementById("studioSizePreset");

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

  const sendDesignToStripBtn = document.getElementById("studioToStep3Btn");

  let studioStage = null;
  let studioLayer = null;
  let studioSelectedNode = null;
  let studioTransformer = null;
  let studioHistory = [];
  let studioHistoryIndex = -1;
  let studioUIWired = false;
  let studioDnDWired = false;
  let studioAvailablePhotos = [];

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

  function attachNodeInteractions(node) {
    node.on("click tap", () => selectStudioNode(node));
    node.on("dragend transformend", () => saveStudioHistory());
  }

  function attachEventsToAllNodes() {
    if (!studioLayer) return;
    studioLayer.getChildren().forEach((node) => {
      if (node.name() === "BackgroundLayer") return;
      if (node.getClassName && node.getClassName() === "Transformer") return;
      attachNodeInteractions(node);
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
    if (!window.Konva || !studioHistory.length) return;
    if (index < 0 || index >= studioHistory.length) return;

    const container =
      (studioStage && studioStage.container()) ||
      document.getElementById("konvaStageContainer");
    if (!container) return;

    const json = studioHistory[index];

    if (studioStage) studioStage.destroy();

    studioStage = Konva.Node.create(json, container);
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

    if (!studioTransformer.getStage()) studioLayer.add(studioTransformer);

    studioSelectedNode = null;
    studioHistoryIndex = index;

    attachEventsToAllNodes();
    rebuildLayersList();
    wireDesignStudioUI();
  }

  function studioUndo() {
    if (studioHistoryIndex > 0) restoreStudioFromHistory(studioHistoryIndex - 1);
  }
  function studioRedo() {
    if (studioHistoryIndex < studioHistory.length - 1) restoreStudioFromHistory(studioHistoryIndex + 1);
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
      li.addEventListener("click", () => selectStudioNode(node));
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
      if (layerFontSizeInput) layerFontSizeInput.value = studioSelectedNode.fontSize() || 40;
    } else {
      if (layerTextInput) layerTextInput.value = "";
      if (layerFontSizeInput) layerFontSizeInput.value = "";
    }

    if (layerOpacityInput) layerOpacityInput.value = studioSelectedNode.opacity() ?? 1;
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

  function addStudioImageFromUrl(url, asBackground = false) {
    if (!studioLayer || !studioStage || !url) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    const safeUrl = getProxiedImageUrl(url);

    img.onload = () => {
      const fitRatio = Math.min(studioStage.width() / img.width, studioStage.height() / img.height) || 1;
      const finalRatio = fitRatio * 0.9;
      const w = img.width * finalRatio;
      const h = img.height * finalRatio;

      if (!asBackground) {
        studioLayer.getChildren().forEach((child) => {
          if (child.name && child.name() === "Photo Layer") child.destroy();
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
        node.moveToBottom();
        const bgRect = studioLayer.findOne(".BackgroundLayer");
        if (bgRect) bgRect.moveToBottom();
      }

      studioLayer.draw();
      selectStudioNode(node);
      saveStudioHistory();
    };

    img.onerror = (err) => console.error("[DesignStudio] Failed to load image:", safeUrl, err);
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
      console.error("Export PNG error:", err);
      alert("Browser blocked exporting this design (CORS). Some dealer images may not export.");
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
    if (!studioStage || !studioLayer) initDesignStudio();
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
      localStorage.setItem(STUDIO_STORAGE_KEY, studioStage.toJSON());
      alert("Design saved on this device.");
    } catch (err) {
      console.error("Error saving design:", err);
      alert("Could not save this design.");
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
      if (studioStage) studioStage.destroy();
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

      if (!studioTransformer.getStage()) studioLayer.add(studioTransformer);

      studioSelectedNode = null;
      studioHistory = [stored];
      studioHistoryIndex = 0;

      attachEventsToAllNodes();
      rebuildLayersList();
      wireDesignStudioUI();
      saveStudioHistory();

      designStudioOverlay?.classList.remove("hidden");
    } catch (err) {
      console.error("Error loading design:", err);
      alert("Could not load saved design.");
    }
  }

  function wireDesignStudioUI() {
    if (studioUIWired) return;
    studioUIWired = true;

    toolAddText?.addEventListener("click", () => addStudioText());
    toolAddShape?.addEventListener("click", () => addStudioShape());
    toolAddBadge?.addEventListener("click", () => addStudioBadge());
    toolSetBackground?.addEventListener("click", () => setStudioBackground(BRAND.dark));

    studioExportPng?.addEventListener("click", exportStudioAsPng);
    studioUndoBtn?.addEventListener("click", studioUndo);
    studioRedoBtn?.addEventListener("click", studioRedo);
    studioSizePreset?.addEventListener("change", applyStudioSizePreset);

    layerTextInput?.addEventListener("input", () => {
      if (studioSelectedNode && studioSelectedNode.className === "Text") {
        studioSelectedNode.text(layerTextInput.value);
        studioLayer.batchDraw();
        saveStudioHistory();
      }
    });

    layerFontSizeInput?.addEventListener("input", () => {
      if (studioSelectedNode && studioSelectedNode.className === "Text") {
        const size = Number(layerFontSizeInput.value) || 40;
        studioSelectedNode.fontSize(size);
        studioLayer.batchDraw();
        saveStudioHistory();
      }
    });

    layerOpacityInput?.addEventListener("input", () => {
      if (studioSelectedNode) {
        studioSelectedNode.opacity(Number(layerOpacityInput.value));
        studioLayer.batchDraw();
        saveStudioHistory();
      }
    });

    layerDeleteBtn?.addEventListener("click", () => {
      if (!studioSelectedNode || !studioLayer) return;
      studioSelectedNode.destroy();
      studioSelectedNode = null;
      studioTransformer?.nodes([]);
      studioTransformer?.visible(false);
      studioLayer.draw();
      rebuildLayersList();
      saveStudioHistory();
    });

    saveDesignBtn?.addEventListener("click", saveDesignToLocal);
    loadDesignBtn?.addEventListener("click", loadDesignFromLocal);

    templatePaymentBtn?.addEventListener("click", () => applyTemplate("payment"));
    templateArrivalBtn?.addEventListener("click", () => applyTemplate("arrival"));
    templateSaleBtn?.addEventListener("click", () => applyTemplate("sale"));
  }

  function initDesignStudio() {
    const container = document.getElementById("konvaStageContainer");
    if (!container || !window.Konva) return;

    const width = container.clientWidth || 1080;
    const height = container.clientHeight || width;

    studioStage = new Konva.Stage({ container: "konvaStageContainer", width, height });
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
      if (target === studioStage || target === studioLayer || target.name() === "BackgroundLayer") {
        selectStudioNode(null);
      }
    });

    wireDesignStudioUI();
    attachEventsToAllNodes();
    rebuildLayersList();
    saveStudioHistory();
  }

  function gatherImageUrlsForStudios() {
    const urls = new Set();

    // Creative thumbs
    creativeThumbGrid?.querySelectorAll("img").forEach((img) => img?.src && urls.add(img.src));

    // Social strip
    socialReadyPhotos.forEach((p) => p?.url && urls.add(p.url));

    // Dealer photos (selected first)
    if (dealerPhotos?.length) {
      const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
      const fallback = dealerPhotos.map((p) => p.src);
      (selected.length ? selected : fallback).forEach((u) => urls.add(u));
    }

    return Array.from(urls).slice(0, 24);
  }

  function renderStudioPhotoTray() {
    if (!studioPhotoTray) return;
    studioPhotoTray.innerHTML = "";

    if (!studioAvailablePhotos?.length) {
      const msg = document.createElement("p");
      msg.className = "small-note";
      msg.textContent = "No photos loaded yet. Boost a listing or load/edit photos in the Creative Lab, then open Design Studio.";
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

      img.addEventListener("click", (e) => addStudioImageFromUrl(url, !!e.shiftKey));
      img.addEventListener("dblclick", () => addStudioImageFromUrl(url, true));

      img.addEventListener("dragstart", (e) => {
        try { e.dataTransfer.setData("text/plain", url); } catch {}
      });

      studioPhotoTray.appendChild(img);
    });

    const konvaContainer = document.getElementById("konvaStageContainer");
    if (konvaContainer && !studioDnDWired) {
      studioDnDWired = true;
      konvaContainer.addEventListener("dragover", (e) => e.preventDefault());
      konvaContainer.addEventListener("drop", (e) => {
        e.preventDefault();
        let url = "";
        try { url = e.dataTransfer.getData("text/plain"); } catch {}
        if (url) addStudioImageFromUrl(url, false);
      });
    }
  }

  function openDesignStudio(forceSources) {
    if (!designStudioOverlay) return;
    designStudioOverlay.classList.remove("hidden");

    if (!studioStage && window.Konva) initDesignStudio();
    else studioStage?.draw?.();

    studioAvailablePhotos = Array.isArray(forceSources) && forceSources.length
      ? forceSources.slice(0, 24)
      : gatherImageUrlsForStudios();

    renderStudioPhotoTray();
  }

  function closeDesignStudio() {
    designStudioOverlay?.classList.add("hidden");
  }

  designLauncher?.addEventListener("click", () => openDesignStudio());
  if (designCloseBtn && designStudioOverlay) {
    designCloseBtn.addEventListener("click", closeDesignStudio);
    designStudioOverlay.addEventListener("click", (e) => {
      if (e.target === designStudioOverlay) closeDesignStudio();
    });
  }

  function pushUrlsIntoDesignStudio(urls) {
    const list = (Array.isArray(urls) ? urls : []).filter(Boolean);
    if (!list.length) {
      alert("No photos available. Boost a listing or add photos first.");
      return;
    }
    openDesignStudio(list);

    // Auto-drop first few (first as background)
    list.slice(0, 24).forEach((url, idx) => addStudioImageFromUrl(url, idx === 0));
  }

  // Step 3 → send selected photos into Design Studio
  sendToDesignStudioBtn?.addEventListener("click", () => {
    let urls = [];

    const selectedThumbs = creativeThumbGrid?.querySelectorAll(".creative-thumb.selected") || [];
    if (selectedThumbs.length) {
      selectedThumbs.forEach((img) => img?.src && urls.push(img.src));
    }

    if (!urls.length && Array.isArray(localCreativePhotos)) urls = localCreativePhotos.slice(0, 24);
    if (!urls.length && dealerPhotos?.length) urls = dealerPhotos.map((p) => p.src).slice(0, 24);

    if (!urls.length) {
      alert("Load or select a photo in the Creative Lab first before sending to Design Studio.");
      return;
    }

    pushUrlsIntoDesignStudio(urls);
  });

  // Social strip → open Design Studio
  openDesignFromCarouselBtn?.addEventListener("click", () => {
    if (!socialReadyPhotos.length) {
      alert("No social-ready photos yet. Double-click a photo in the grid above to add it.");
      return;
    }

    const selected = socialReadyPhotos.filter((p) => p.selected).map((p) => p.url);
    const chosen = (selected.length ? selected : socialReadyPhotos.map((p) => p.url)).slice(0, 24);
    pushUrlsIntoDesignStudio(chosen);
  });

  // Social strip → open Canvas Studio
  openCanvasFromCarouselBtn?.addEventListener("click", () => {
    if (!socialReadyPhotos.length) {
      alert("No social-ready photos yet. Double-click a photo in the grid above to add it.");
      return;
    }

    const selected = socialReadyPhotos.filter((p) => p.selected).map((p) => p.url);
    const urls = (selected.length ? selected : socialReadyPhotos.map((p) => p.url)).slice(0, 24);

    openCreativeStudio();
    urls.forEach((u) => addImageFromUrl(u));
  });

  // Design Studio → Send to Step 3
  sendDesignToStripBtn?.addEventListener("click", async () => {
    if (!studioStage) return;

    let dataUrl;
    try {
      dataUrl = studioStage.toDataURL({ pixelRatio: 2 });
    } catch (e) {
      console.error("❌ Konva toDataURL failed:", e);
      alert("Design export failed due to CORS. Try using only proxied images (dealer/Creative images).");
      return;
    }

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    addPhotoToSocialReady(objectUrl);
    localCreativePhotos.push(objectUrl);
    addCreativeThumb(objectUrl);

    if (tunerPreviewImg && !tunerPreviewImg.src) {
      tunerPreviewImg.src = objectUrl;
      applyTunerFilters();
    }
  });

  // ==================================================
  // FINAL INIT
  // ==================================================
  renderSocialCarousel();
});
