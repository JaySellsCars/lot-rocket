// public/app.js – frontend logic for Lot Rocket Social Kit + side panels

document.addEventListener("DOMContentLoaded", () => {
  const apiBase = "";

  // ---------- ELEMENTS: main inputs ----------
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
  const videoScript = document.getElementById("videoScript");
  const shotPlan = document.getElementById("shotPlan");

  const buildVideoButton = document.getElementById("buildVideoButton");
  const photosGrid = document.getElementById("photosGrid");
  const photosStatus = document.getElementById("photosStatus");
  const videoPlan = document.getElementById("videoPlan");

  const newScriptButton = document.getElementById("newScriptButton");

  const designTypeSelect = document.getElementById("designType");
  const designButton = document.getElementById("designButton");
  const designOutput = document.getElementById("designOutput");

  // Theme
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const themeLabel = document.getElementById("themeLabel");

  // Objection coach modal (AI)
  const objectionLauncher = document.getElementById("objectionLauncher");
  const objectionModal = document.getElementById("objectionModal");
  const objectionCloseButton = document.getElementById("objectionCloseButton");
  const objectionHistory = document.getElementById("objectionHistory");
  const objectionInput = document.getElementById("objectionInput");
  const objectionSendButton = document.getElementById("objectionSendButton");

  // Side-panel launchers
  const paymentLauncher = document.getElementById("paymentLauncher");
  const messageLauncher = document.getElementById("messageLauncher");
  const incomeLauncher = document.getElementById("incomeLauncher");

  // Payment panel
  const paymentPanel = document.getElementById("paymentPanel");
  const paymentClose = document.getElementById("paymentClose");
  const paymentForm = document.getElementById("paymentForm");
  const paymentResult = document.getElementById("paymentResult");
  const amountFinancedEl = document.getElementById("amountFinanced");
  const totalPaidEl = document.getElementById("totalPaid");

  // Message panel
  const messagePanel = document.getElementById("messagePanel");
  const messageClose = document.getElementById("messageClose");
  const messageForm = document.getElementById("messageForm");
  const messageOutput = document.getElementById("messageOutput");

  // Income panel
  const incomePanel = document.getElementById("incomePanel");
  const incomeClose = document.getElementById("incomeClose");
  const incomeForm = document.getElementById("incomeForm");
  const dealsPerMonthEl = document.getElementById("dealsPerMonth");
  const dealsPerDayEl = document.getElementById("dealsPerDay");
  const showsPerDayEl = document.getElementById("showsPerDay");
  const appointmentsPerDayEl = document.getElementById("appointmentsPerDay");

  let currentPhotos = [];
  let currentUrl = "";
  let isBoosting = false;

  // chat history for objection coach
  let objectionMessages = []; // { role: 'user' | 'assistant', content: string }

  // ---------------- THEME ----------------

  function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    if (theme === "dark") {
      themeIcon.textContent = "🌙";
      themeLabel.textContent = "Dark";
    } else {
      themeIcon.textContent = "☀️";
      themeLabel.textContent = "Light";
    }
    localStorage.setItem("lotRocketTheme", theme);
  }

  function initTheme() {
    const saved = localStorage.getItem("lotRocketTheme");
    if (saved === "light" || saved === "dark") {
      applyTheme(saved);
    } else {
      applyTheme("dark");
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current =
        document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  initTheme();

  // ---------------- HELPERS ----------------

  function setStatus(text, isLoading = false) {
    if (!statusText) return;
    if (isLoading) {
      statusText.innerHTML = '<span class="loading-dot"></span>' + text;
    } else {
      statusText.textContent = text;
    }
  }

  function safeTrim(str) {
    return (str || "").toString().trim();
  }

  function formatMoney(value) {
    const n = Number(value) || 0;
    return n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function updateSummary(label, price) {
    if (summaryLabel) {
      summaryLabel.textContent = safeTrim(label) || "Vehicle ready";
    }
    if (summaryPrice) {
      summaryPrice.textContent =
        safeTrim(price) || "Message for current pricing";
    }
  }

  function fillSocialKit(kit) {
    if (facebookPost) facebookPost.value = kit.facebook || "";
    if (instagramPost) instagramPost.value = kit.instagram || "";
    if (tiktokPost) tiktokPost.value = kit.tiktok || "";
    if (linkedinPost) linkedinPost.value = kit.linkedin || "";
    if (twitterPost) twitterPost.value = kit.twitter || "";
    if (textBlurb) textBlurb.value = kit.textBlurb || "";
    if (marketplacePost) marketplacePost.value = kit.marketplace || "";
    if (hashtags) hashtags.value = kit.hashtags || "";
    if (videoScript) videoScript.value = kit.videoScript || "";
    if (shotPlan) shotPlan.value = kit.shotPlan || "";
  }

  function renderPhotosGrid(photos) {
    if (!photosGrid || !photosStatus) return;
    photosGrid.innerHTML = "";
    if (!photos || !photos.length) {
      photosStatus.textContent = "No photos found yet.";
      return;
    }
    photos.forEach((url) => {
      const wrapper = document.createElement("div");
      wrapper.className = "photo-thumb";
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Vehicle photo";
      wrapper.appendChild(img);
      wrapper.addEventListener("click", () => {
        window.open(url, "_blank");
      });
      photosGrid.appendChild(wrapper);
    });
    photosStatus.textContent =
      photos.length + " photos found. Click any to open full size.";
  }

  async function callJson(endpoint, body) {
    const res = await fetch(apiBase + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error("Request failed: " + res.status + " " + txt);
    }
    return res.json();
  }

  // ------------- OBJECTION CHAT RENDER -------------

  function renderObjectionChat() {
    if (!objectionHistory) return;
    objectionHistory.innerHTML = "";
    if (!objectionMessages.length) {
      const empty = document.createElement("div");
      empty.className = "objection-bubble";
      empty.style.opacity = "0.7";
      empty.textContent =
        "Paste the customer objection (or ask a question) and your Andy Elliott–style coach will give you word tracks and breakdowns.";
      objectionHistory.appendChild(empty);
      return;
    }

    objectionMessages.forEach((m) => {
      const labelDiv = document.createElement("div");
      labelDiv.className =
        "objection-bubble " +
        (m.role === "assistant" ? "coach-label" : "you-label");
      labelDiv.textContent = m.role === "assistant" ? "COACH" : "YOU";

      const bubble = document.createElement("div");
      bubble.className =
        "objection-bubble " + (m.role === "assistant" ? "coach" : "you");
      bubble.textContent = m.content || "";

      objectionHistory.appendChild(labelDiv);
      objectionHistory.appendChild(bubble);
    });

    objectionHistory.scrollTop = objectionHistory.scrollHeight;
  }

  // ------------- BOOST FLOW -------------

  async function handleBoost() {
    if (isBoosting) return;
    const url = safeTrim(vehicleUrlInput && vehicleUrlInput.value);
    if (!url) {
      alert("Paste a dealer vehicle URL first.");
      return;
    }

    let label = safeTrim(vehicleLabelInput && vehicleLabelInput.value);
    if (!label) {
      label = "This vehicle";
      if (vehicleLabelInput) vehicleLabelInput.value = label;
    }
    let price = safeTrim(priceInfoInput && priceInfoInput.value);
    if (!price) {
      price = "Message for current pricing";
      if (priceInfoInput) priceInfoInput.value = price;
    }

    isBoosting = true;
    if (boostButton) boostButton.disabled = true;
    setStatus("Building social kit with AI…", true);

    try {
      currentUrl = url;
      const resp = await callJson("/api/social-kit", { url, label, price });
      if (!resp.success) throw new Error("API returned error");
      fillSocialKit(resp.kit);
      updateSummary(label, price);
      setStatus("Social kit ready. You can spin new posts or scripts anytime.");

      // reset objection chat for the new vehicle
      objectionMessages = [];
      renderObjectionChat();

      // Auto load photos
      try {
        if (photosStatus)
          photosStatus.textContent = "Trying to grab photos from dealer page…";
        const photoResp = await callJson("/api/grab-photos", { url });
        if (photoResp.success) {
          currentPhotos = photoResp.photos || [];
          renderPhotosGrid(currentPhotos);
        } else if (photosStatus) {
          photosStatus.textContent = "Could not grab photos.";
        }
      } catch (err) {
        console.error("Auto photo grab failed:", err);
        if (photosStatus) photosStatus.textContent = "Auto photo load failed.";
      }
    } catch (err) {
      console.error(err);
      setStatus("Something went wrong. Try again or check the URL.");
      alert("Error building social kit. Check the URL and try again.");
    } finally {
      isBoosting = false;
      if (boostButton) boostButton.disabled = false;
    }
  }

  if (boostButton) {
    boostButton.addEventListener("click", handleBoost);
  }

  // ------------- NEW POST BUTTONS -------------

  document.querySelectorAll(".button-new-post").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const platform = btn.getAttribute("data-platform");
      const url = safeTrim(vehicleUrlInput && vehicleUrlInput.value);
      const label = safeTrim(vehicleLabelInput && vehicleLabelInput.value);
      const price = safeTrim(priceInfoInput && priceInfoInput.value);

      if (!url || !label) {
        alert(
          "Please paste a URL and hit Boost at least once before spinning posts."
        );
        return;
      }

      btn.disabled = true;
      const oldText = btn.innerHTML;
      btn.innerHTML = '<span class="icon">⏳</span><span>Working…</span>';

      try {
        const resp = await callJson("/api/new-post", {
          platform,
          url,
          label,
          price,
        });
        if (!resp.success) throw new Error("API returned error");
        const text = resp.post || "";

        switch (platform) {
          case "facebook":
            if (facebookPost) facebookPost.value = text;
            break;
          case "instagram":
            if (instagramPost) instagramPost.value = text;
            break;
          case "tiktok":
            if (tiktokPost) tiktokPost.value = text;
            break;
          case "linkedin":
            if (linkedinPost) linkedinPost.value = text;
            break;
          case "twitter":
            if (twitterPost) twitterPost.value = text;
            break;
          case "text":
            if (textBlurb) textBlurb.value = text;
            break;
          case "marketplace":
            if (marketplacePost) marketplacePost.value = text;
            break;
          case "hashtags":
            if (hashtags) hashtags.value = text;
            break;
        }
      } catch (err) {
        console.error(err);
        alert("Error generating a new post. Try again.");
      } finally {
        btn.disabled = false;
        btn.innerHTML = oldText;
      }
    });
  });

  // ------------- NEW VIDEO SCRIPT -------------

  if (newScriptButton) {
    newScriptButton.addEventListener("click", async () => {
      const url = safeTrim(vehicleUrlInput && vehicleUrlInput.value);
      const label = safeTrim(vehicleLabelInput && vehicleLabelInput.value);
      const price = safeTrim(priceInfoInput && priceInfoInput.value);

      if (!url || !label) {
        alert(
          "Please paste a URL and hit Boost at least once before spinning scripts."
        );
        return;
      }

      newScriptButton.disabled = true;
      const oldText = newScriptButton.innerHTML;
      newScriptButton.innerHTML =
        '<span class="icon">⏳</span><span>Working…</span>';

      try {
        const resp = await callJson("/api/new-script", { url, label, price });
        if (!resp.success) throw new Error("API error");
        if (videoScript) videoScript.value = resp.script || "";
      } catch (err) {
        console.error(err);
        alert("Error generating a new script. Try again.");
      } finally {
        newScriptButton.disabled = false;
        newScriptButton.innerHTML = oldText;
      }
    });
  }

  // ------------- BUILD VIDEO PLAN FROM PHOTOS -------------

  if (buildVideoButton) {
    buildVideoButton.addEventListener("click", async () => {
      if (!currentPhotos || !currentPhotos.length) {
        alert("No photos yet. Boost a listing first so we can grab photos.");
        return;
      }

      buildVideoButton.disabled = true;
      const oldText = buildVideoButton.innerHTML;
      buildVideoButton.innerHTML =
        '<span class="icon">⏳</span><span>Building…</span>';

      try {
        const label =
          safeTrim(vehicleLabelInput && vehicleLabelInput.value) ||
          "this vehicle";
        const resp = await callJson("/api/video-from-photos", {
          photos: currentPhotos,
          label,
        });
        if (!resp.success) throw new Error("API error");
        if (videoPlan) videoPlan.value = resp.plan || "";
      } catch (err) {
        console.error(err);
        alert("Error building video plan. Try again.");
      } finally {
        buildVideoButton.disabled = false;
        buildVideoButton.innerHTML = oldText;
      }
    });
  }

  // ------------- DESIGN LAB -------------

  if (designButton) {
    designButton.addEventListener("click", async () => {
      const type = designTypeSelect && designTypeSelect.value;
      const url = safeTrim(vehicleUrlInput && vehicleUrlInput.value);
      const label = safeTrim(vehicleLabelInput && vehicleLabelInput.value);
      const price = safeTrim(priceInfoInput && priceInfoInput.value);

      if (!url || !label) {
        alert(
          "Please paste a URL and hit Boost at least once before generating design ideas."
        );
        return;
      }

      designButton.disabled = true;
      const oldText = designButton.innerHTML;
      designButton.innerHTML =
        '<span class="icon">⏳</span><span>Designing…</span>';

      try {
        const resp = await callJson("/api/design-idea", {
          type,
          url,
          label,
          price,
        });
        if (!resp.success) throw new Error("API error");
        if (designOutput) designOutput.value = resp.design || "";
      } catch (err) {
        console.error(err);
        alert("Error generating a design idea. Try again.");
      } finally {
        designButton.disabled = false;
        designButton.innerHTML = oldText;
      }
    });
  }

  // ------------- OBJECTION COACH MODAL (AI) -------------

  function openObjectionModal() {
    if (!objectionModal) return;
    objectionModal.classList.remove("hidden");
    if (!objectionMessages.length) {
      renderObjectionChat();
    }
    setTimeout(() => {
      if (objectionInput) objectionInput.focus();
    }, 50);
  }

  function closeObjectionModal() {
    if (!objectionModal) return;
    objectionModal.classList.add("hidden");
  }

  if (objectionLauncher) {
    objectionLauncher.addEventListener("click", openObjectionModal);
  }
  if (objectionCloseButton) {
    objectionCloseButton.addEventListener("click", closeObjectionModal);
  }
  if (objectionModal) {
    objectionModal.addEventListener("click", (e) => {
      if (e.target === objectionModal) {
        closeObjectionModal();
      }
    });
  }

  function sendObjection() {
    const text = (objectionInput && objectionInput.value || "").trim();
    if (!text) {
      alert("Type the customer’s objection or your question first.");
      return;
    }

    const label =
      safeTrim(vehicleLabelInput && vehicleLabelInput.value) ||
      "this vehicle";
    const price =
      safeTrim(priceInfoInput && priceInfoInput.value) ||
      "Message for current pricing";

    objectionMessages.push({ role: "user", content: text });
    renderObjectionChat();
    if (objectionInput) objectionInput.value = "";

    if (!objectionSendButton) return;
    objectionSendButton.disabled = true;
    const oldText = objectionSendButton.innerHTML;
    objectionSendButton.innerHTML = "<span>⏳ Coaching…</span>";

    callJson("/api/objection-coach", {
      messages: objectionMessages,
      label,
      price,
    })
      .then((resp) => {
        if (!resp.success) throw new Error("API error");
        const reply = resp.reply || "";
        objectionMessages.push({ role: "assistant", content: reply });
        renderObjectionChat();
      })
      .catch((err) => {
        console.error(err);
        alert("Error generating a response. Try again.");
      })
      .finally(() => {
        objectionSendButton.disabled = false;
        objectionSendButton.innerHTML = oldText;
      });
  }

  if (objectionSendButton) {
    objectionSendButton.addEventListener("click", sendObjection);
  }
  if (objectionInput) {
    objectionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        sendObjection();
      }
    });
  }

  // initial render for objection chat
  renderObjectionChat();

  // ------------- SIDE PANEL HELPERS -------------

  function openPanel(panel) {
    if (!panel) return;
    panel.classList.remove("hidden");
  }

  function closePanel(panel) {
    if (!panel) return;
    panel.classList.add("hidden");
  }

  // Payment panel open/close
  if (paymentLauncher && paymentPanel) {
    paymentLauncher.addEventListener("click", () => openPanel(paymentPanel));
  }
  if (paymentClose && paymentPanel) {
    paymentClose.addEventListener("click", () => closePanel(paymentPanel));
  }

  // Message panel open/close
  if (messageLauncher && messagePanel) {
    messageLauncher.addEventListener("click", () => openPanel(messagePanel));
  }
  if (messageClose && messagePanel) {
    messageClose.addEventListener("click", () => closePanel(messagePanel));
  }

  // Income panel open/close
  if (incomeLauncher && incomePanel) {
    incomeLauncher.addEventListener("click", () => openPanel(incomePanel));
  }
  if (incomeClose && incomePanel) {
    incomeClose.addEventListener("click", () => closePanel(incomePanel));
  }

  // Click on any backdrop closes respective panel (using data-close-panel)
  document.querySelectorAll(".side-panel-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", () => {
      const id = backdrop.getAttribute("data-close-panel");
      if (!id) return;
      const panel = document.getElementById(id);
      closePanel(panel);
    });
  });

  // ------------- PAYMENT HELPER CALCULATOR -------------

  if (paymentForm && paymentResult && amountFinancedEl && totalPaidEl) {
    paymentForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const price =
        Number(document.getElementById("price").value || "0") || 0;
      const down =
        Number(document.getElementById("downPayment").value || "0") || 0;
      const term = Number(document.getElementById("term").value || "0") || 0;
      const apr = Number(document.getElementById("apr").value || "0") || 0;

      if (!price || !term) {
        paymentResult.textContent = "Enter price and term.";
        amountFinancedEl.textContent = "$0.00";
        totalPaidEl.textContent = "$0.00";
        return;
      }

      const amountFinanced = Math.max(price - down, 0);
      const monthlyRate = apr > 0 ? apr / 100 / 12 : 0;

      let payment = 0;
      if (monthlyRate === 0) {
        payment = amountFinanced / term;
      } else {
        const base = 1 + monthlyRate;
        const pow = Math.pow(base, term);
        const factor = (monthlyRate * pow) / (pow - 1);
        payment = amountFinanced * factor;
      }

      const totalPaid = payment * term;

      paymentResult.textContent = `${formatMoney(payment)} / mo`;
      amountFinancedEl.textContent = formatMoney(amountFinanced);
      totalPaidEl.textContent = formatMoney(totalPaid);
    });
  }

  // ------------- CUSTOM MESSAGE BUILDER -------------

  if (messageForm && messageOutput) {
    messageForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name =
        safeTrim(document.getElementById("msgCustomer").value) || "there";
      const platform =
        document.getElementById("msgPlatform").value || "sms";
      const vehicle = safeTrim(
        document.getElementById("msgVehicle").value
      );
      const goal =
        document.getElementById("msgGoal").value || "appointment";
      const notes = safeTrim(
        document.getElementById("msgNotes").value
      );

      let opener =
        platform === "email"
          ? `Hi ${name},`
          : `Hey ${name}, it’s ${"your salesperson"} over at the store.`;

      const vehicleLine = vehicle
        ? `I was looking at the ${vehicle} we talked about and wanted to check in with you.`
        : `I wanted to check in with you about your vehicle search.`;

      let goalLine = "";
      switch (goal) {
        case "appointment":
          goalLine =
            "I’d love to set up a quick visit so you can see it in person and make sure it fits what you’re looking for.";
          break;
        case "trade":
          goalLine =
            "If you send me a couple photos and miles on your trade, I can work up real numbers and save you a ton of time at the store.";
          break;
        case "followup":
          goalLine =
            "Just wanted to make sure your questions are answered and see what you’d like your next step to be.";
          break;
        case "credit":
          goalLine =
            "We can put together a simple approval gameplan that keeps the payment comfortable and actually helps your credit long-term.";
          break;
      }

      const notesLine = notes ? `\n\nQuick note: ${notes}` : "";

      let closer = "";
      if (platform === "email") {
        closer =
          "\n\nIf you have a minute, hit reply and let me know what works best for you – I’m here to make this easy.";
      } else {
        closer =
          "\n\nWhat works better for you – a quick call or a text to go over options? I’ll move at your pace.";
      }

      const msg = `${opener}

${vehicleLine}
${goalLine}${notesLine}${closer}`;

      messageOutput.value = msg.trim();
    });

    // copy button for message
    document
      .querySelectorAll("[data-copy-target]")
      .forEach((copyBtn) => {
        copyBtn.addEventListener("click", () => {
          const targetId = copyBtn.getAttribute("data-copy-target");
          if (!targetId) return;
          const el = document.getElementById(targetId);
          if (!el) return;
          el.select();
          document.execCommand("copy");
        });
      });
  }

  // ------------- INCOME BUILDER -------------

  if (
    incomeForm &&
    dealsPerMonthEl &&
    dealsPerDayEl &&
    showsPerDayEl &&
    appointmentsPerDayEl
  ) {
    incomeForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const incomeGoal =
        Number(document.getElementById("incomeGoal").value || "0") ||
        0;
      const perDeal =
        Number(
          document.getElementById("commissionPerDeal").value || "0"
        ) || 0;
      const workDays =
        Number(document.getElementById("workDays").value || "0") || 0;
      const closeRate =
        Number(document.getElementById("closeRate").value || "0") || 0;

      if (!incomeGoal || !perDeal || !workDays || !closeRate) {
        dealsPerMonthEl.textContent = "0.0";
        dealsPerDayEl.textContent = "0.00";
        showsPerDayEl.textContent = "0.00";
        appointmentsPerDayEl.textContent = "0.00";
        return;
      }

      const dealsPerMonth = incomeGoal / perDeal;
      const dealsPerDay = dealsPerMonth / workDays;

      const closeFraction = closeRate / 100;
      const showsPerDay =
        closeFraction > 0 ? dealsPerDay / closeFraction : 0;

      // assume 70% of appointments show
      const showRate = 0.7;
      const appointmentsPerDay =
        showRate > 0 ? showsPerDay / showRate : 0;

      dealsPerMonthEl.textContent = dealsPerMonth.toFixed(1);
      dealsPerDayEl.textContent = dealsPerDay.toFixed(2);
      showsPerDayEl.textContent = showsPerDay.toFixed(2);
      appointmentsPerDayEl.textContent = appointmentsPerDay.toFixed(2);
    });
  }
});
