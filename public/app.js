// public/app.js – Lot Rocket front-end
// Social Media Kit + Objection Coach + Design Lab + Floating Tools

const apiBase = "";

// ----- Grab main DOM elements -----

// Step 1 inputs
const vehicleUrlInput = document.getElementById("vehicleUrl");
const vehicleLabelInput = document.getElementById("vehicleLabel");
const priceInfoInput = document.getElementById("priceInfo");
const boostButton = document.getElementById("boostButton");
const statusText = document.getElementById("statusText");

// Summary
const summaryLabel = document.getElementById("summaryLabel");
const summaryPrice = document.getElementById("summaryPrice");

// Social post boxes
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

// Media & video plan
const buildVideoButton = document.getElementById("buildVideoButton");
const photosGrid = document.getElementById("photosGrid");
const photosStatus = document.getElementById("photosStatus");
const videoPlan = document.getElementById("videoPlan");

// Script button
const newScriptButton = document.getElementById("newScriptButton");

// Design Lab
const designTypeSelect = document.getElementById("designType");
const designButton = document.getElementById("designButton");
const designOutput = document.getElementById("designOutput");

// Theme toggle
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeLabel = document.getElementById("themeLabel");

// Floating tool launchers
const objectionLauncher = document.getElementById("objectionLauncher");
const paymentLauncher = document.getElementById("paymentLauncher");
const incomeLauncher = document.getElementById("incomeLauncher");
const messageLauncher = document.getElementById("messageLauncher");

// Objection modal elements
const objectionModal = document.getElementById("objectionModal");
const objectionCloseButton = document.getElementById("objectionCloseButton");
const objectionHistory = document.getElementById("objectionHistory");
const objectionInput = document.getElementById("objectionInput");
const objectionSendButton = document.getElementById("objectionSendButton");

// Payment modal elements
const paymentModal = document.getElementById("paymentModal");
const paymentCloseButton = document.getElementById("paymentCloseButton");
const payPrice = document.getElementById("payPrice");
const payDown = document.getElementById("payDown");
const payApr = document.getElementById("payApr");
const payTerm = document.getElementById("payTerm");
const paymentCalcButton = document.getElementById("paymentCalcButton");
const paymentResultText = document.getElementById("paymentResultText");

// Income modal elements
const incomeModal = document.getElementById("incomeModal");
const incomeCloseButton = document.getElementById("incomeCloseButton");
const incHourly = document.getElementById("incHourly");
const incHours = document.getElementById("incHours");
const incomeCalcButton = document.getElementById("incomeCalcButton");
const incomeResultText = document.getElementById("incomeResultText");

// AI Message modal elements
const messageModal = document.getElementById("messageModal");
const messageCloseButton = document.getElementById("messageCloseButton");
const msgChannel = document.getElementById("msgChannel");
const msgTone = document.getElementById("msgTone");
const msgFollowups = document.getElementById("msgFollowups");
const msgVariants = document.getElementById("msgVariants");
const msgAudience = document.getElementById("msgAudience");
const msgGoal = document.getElementById("msgGoal");
const msgDetails = document.getElementById("msgDetails");
const messageGenerateButton = document.getElementById("messageGenerateButton");
const msgResult = document.getElementById("msgResult");

// State
let currentPhotos = [];
let currentUrl = "";
let isBoosting = false;
let objectionMessages = []; // { role: 'user' | 'assistant', content: string }

// ----- Theme handling -----

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

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
});

initTheme();

// ----- Helpers -----

function setStatus(text, isLoading = false) {
  if (isLoading) {
    statusText.innerHTML = '<span class="loading-dot"></span>' + text;
  } else {
    statusText.textContent = text;
  }
}

function safeTrim(str) {
  return (str || "").toString().trim();
}

function updateSummary(label, price) {
  summaryLabel.textContent = safeTrim(label) || "Vehicle ready";
  summaryPrice.textContent =
    safeTrim(price) || "Message for current pricing";
}

function fillSocialKit(kit) {
  facebookPost.value = kit.facebook || "";
  instagramPost.value = kit.instagram || "";
  tiktokPost.value = kit.tiktok || "";
  linkedinPost.value = kit.linkedin || "";
  twitterPost.value = kit.twitter || "";
  textBlurb.value = kit.textBlurb || "";
  marketplacePost.value = kit.marketplace || "";
  hashtags.value = kit.hashtags || "";
  videoScript.value = kit.videoScript || "";
  shotPlan.value = kit.shotPlan || "";
}

function renderPhotosGrid(photos) {
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

// Render objection chat history
function renderObjectionChat() {
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

// ----- Boost flow -----

async function handleBoost() {
  if (isBoosting) return;
  const url = safeTrim(vehicleUrlInput.value);
  if (!url) {
    alert("Paste a dealer vehicle URL first.");
    return;
  }

  let label = safeTrim(vehicleLabelInput.value);
  if (!label) {
    label = "This vehicle";
    vehicleLabelInput.value = label;
  }
  let price = safeTrim(priceInfoInput.value);
  if (!price) {
    price = "Message for current pricing";
    priceInfoInput.value = price;
  }

  isBoosting = true;
  boostButton.disabled = true;
  setStatus("Building social kit with AI…", true);

  try {
    currentUrl = url;
    const resp = await callJson("/api/social-kit", { url, label, price });
    if (!resp.success) throw new Error("API returned error");
    fillSocialKit(resp.kit);
    updateSummary(label, price);
    setStatus("Social kit ready. You can spin new posts or scripts anytime.");

    // reset objection chat
    objectionMessages = [];
    renderObjectionChat();

    // Auto load photos
    try {
      photosStatus.textContent =
        "Trying to grab photos from dealer page…";
      const photoResp = await callJson("/api/grab-photos", { url });
      if (photoResp.success) {
        currentPhotos = photoResp.photos || [];
        renderPhotosGrid(currentPhotos);
      } else {
        photosStatus.textContent = "Could not grab photos.";
      }
    } catch (err) {
      console.error("Auto photo grab failed:", err);
      photosStatus.textContent = "Auto photo load failed.";
    }
  } catch (err) {
    console.error(err);
    setStatus("Something went wrong. Try again or check the URL.");
    alert("Error building social kit. Check the URL and try again.");
  } finally {
    isBoosting = false;
    boostButton.disabled = false;
  }
}

boostButton.addEventListener("click", handleBoost);

// ----- New post buttons -----

document.querySelectorAll(".button-new-post").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const platform = btn.getAttribute("data-platform");
    const url = safeTrim(vehicleUrlInput.value);
    const label = safeTrim(vehicleLabelInput.value);
    const price = safeTrim(priceInfoInput.value);

    if (!url || !label) {
      alert(
        "Please paste a URL and hit Boost at least once before spinning posts."
      );
      return;
    }

    btn.disabled = true;
    const oldText = btn.innerHTML;
    btn.innerHTML =
      '<span class="icon">⏳</span><span>Working…</span>';

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
          facebookPost.value = text;
          break;
        case "instagram":
          instagramPost.value = text;
          break;
        case "tiktok":
          tiktokPost.value = text;
          break;
        case "linkedin":
          linkedinPost.value = text;
          break;
        case "twitter":
          twitterPost.value = text;
          break;
        case "text":
          textBlurb.value = text;
          break;
        case "marketplace":
          marketplacePost.value = text;
          break;
        case "hashtags":
          hashtags.value = text;
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

// ----- New video script -----

newScriptButton.addEventListener("click", async () => {
  const url = safeTrim(vehicleUrlInput.value);
  const label = safeTrim(vehicleLabelInput.value);
  const price = safeTrim(priceInfoInput.value);

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
    const resp = await callJson("/api/new-script", {
      url,
      label,
      price,
    });
    if (!resp.success) throw new Error("API error");
    videoScript.value = resp.script || "";
  } catch (err) {
    console.error(err);
    alert("Error generating a new script. Try again.");
  } finally {
    newScriptButton.disabled = false;
    newScriptButton.innerHTML = oldText;
  }
});

// ----- Build video plan from photos -----

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
    const label = safeTrim(vehicleLabelInput.value) || "this vehicle";
    const resp = await callJson("/api/video-from-photos", {
      photos: currentPhotos,
      label,
    });
    if (!resp.success) throw new Error("API error");
    videoPlan.value = resp.plan || "";
  } catch (err) {
    console.error(err);
    alert("Error building video plan. Try again.");
  } finally {
    buildVideoButton.disabled = false;
    buildVideoButton.innerHTML = oldText;
  }
});

// ----- Design Lab -----

designButton.addEventListener("click", async () => {
  const type = designTypeSelect.value;
  const url = safeTrim(vehicleUrlInput.value);
  const label = safeTrim(vehicleLabelInput.value);
  const price = safeTrim(priceInfoInput.value);

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
    designOutput.value = resp.design || "";
  } catch (err) {
    console.error(err);
    alert("Error generating a design idea. Try again.");
  } finally {
    designButton.disabled = false;
    designButton.innerHTML = oldText;
  }
});

// ----- Objection Coach modal -----

function openObjectionModal() {
  objectionModal.classList.remove("hidden");
  if (!objectionMessages.length) {
    renderObjectionChat();
  }
  setTimeout(() => {
    objectionInput.focus();
  }, 50);
}

function closeObjectionModal() {
  objectionModal.classList.add("hidden");
}

objectionLauncher.addEventListener("click", openObjectionModal);
objectionCloseButton.addEventListener("click", closeObjectionModal);

objectionModal.addEventListener("click", (e) => {
  if (e.target === objectionModal) {
    closeObjectionModal();
  }
});

function sendObjection() {
  const text = (objectionInput.value || "").trim();
  if (!text) {
    alert("Type the customer’s objection or your question first.");
    return;
  }

  const label = safeTrim(vehicleLabelInput.value) || "this vehicle";
  const price =
    safeTrim(priceInfoInput.value) || "Message for current pricing";

  objectionMessages.push({ role: "user", content: text });
  renderObjectionChat();
  objectionInput.value = "";

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

objectionSendButton.addEventListener("click", sendObjection);

objectionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    sendObjection();
  }
});

// ----- Payment Calculator modal -----

function openPaymentModal() {
  paymentModal.classList.remove("hidden");
  setTimeout(() => payPrice.focus(), 50);
}
function closePaymentModal() {
  paymentModal.classList.add("hidden");
}

paymentLauncher.addEventListener("click", openPaymentModal);
paymentCloseButton.addEventListener("click", closePaymentModal);
paymentModal.addEventListener("click", (e) => {
  if (e.target === paymentModal) closePaymentModal();
});

function calculatePayment() {
  const price = parseFloat(payPrice.value) || 0;
  const down = parseFloat(payDown.value) || 0;
  const apr = parseFloat(payApr.value) || 0;
  const term = parseInt(payTerm.value, 10) || 0;

  const loanAmount = price - down;
  if (loanAmount <= 0 || term <= 0) {
    paymentResultText.textContent =
      "Enter a valid price, down payment, and term.";
    return;
  }

  const monthlyRate = apr > 0 ? apr / 100 / 12 : 0;
  let payment;
  if (monthlyRate === 0) {
    payment = loanAmount / term;
  } else {
    const pow = Math.pow(1 + monthlyRate, term);
    payment =
      (loanAmount * (monthlyRate * pow)) / (pow - 1);
  }

  paymentResultText.textContent =
    "Estimated Payment: $" +
    payment.toFixed(2) +
    " / month (rough estimate, not final finance terms).";
}

paymentCalcButton.addEventListener("click", calculatePayment);

// ----- Income Calculator modal -----

function openIncomeModal() {
  incomeModal.classList.remove("hidden");
  setTimeout(() => incHourly.focus(), 50);
}
function closeIncomeModal() {
  incomeModal.classList.add("hidden");
}

incomeLauncher.addEventListener("click", openIncomeModal);
incomeCloseButton.addEventListener("click", closeIncomeModal);
incomeModal.addEventListener("click", (e) => {
  if (e.target === incomeModal) closeIncomeModal();
});

function calculateIncome() {
  const hourly = parseFloat(incHourly.value) || 0;
  const hoursPerWeek = parseFloat(incHours.value) || 0;

  if (hourly <= 0 || hoursPerWeek <= 0) {
    incomeResultText.textContent =
      "Enter a valid hourly wage and hours per week.";
    return;
  }

  const yearly = hourly * hoursPerWeek * 52;
  incomeResultText.textContent =
    "Estimated Yearly Gross Income: $" +
    yearly.toFixed(2);
}

incomeCalcButton.addEventListener("click", calculateIncome);

// ----- Message Builder modal -----

function openMessageModal() {
  messageModal.classList.remove("hidden");
  setTimeout(() => msgGoal.focus(), 50);
}
function closeMessageModal() {
  messageModal.classList.add("hidden");
}

messageLauncher.addEventListener("click", openMessageModal);
messageCloseButton.addEventListener("click", closeMessageModal);
messageModal.addEventListener("click", (e) => {
  if (e.target === messageModal) closeMessageModal();
});

async function generateMessages() {
  const channel = msgChannel.value || "sms";
  const tone = msgTone.value || "friendly";
  const followups = parseInt(msgFollowups.value, 10) || 4;
  const variants = parseInt(msgVariants.value, 10) || 2;
  const audience = safeTrim(msgAudience.value) || "car buyer";
  const goal = safeTrim(msgGoal.value);
  const details = safeTrim(msgDetails.value);

  if (!goal && !details) {
    alert(
      "Tell the AI what you’re trying to accomplish or give some details."
    );
    return;
  }

  messageGenerateButton.disabled = true;
  const oldText = messageGenerateButton.innerHTML;
  messageGenerateButton.innerHTML = "<span>⏳ Building…</span>";
  msgResult.value =
    "Thinking up your messages and workflows…";

  try {
    const resp = await callJson("/api/ai-message", {
      channel,
      goal,
      details,
      audience,
      tone,
      followups,
      variants,
    });

    let display = "";

    if (Array.isArray(resp.variants)) {
      resp.variants.forEach((variant, idx) => {
        display +=
          "=== Campaign Option " + (idx + 1) + " ===\n\n";
        if (variant.primaryMessage) {
          display +=
            "Primary Message:\n" +
            variant.primaryMessage +
            "\n\n";
        }
        if (Array.isArray(variant.campaign)) {
          display += "Follow-up Workflow:\n";
          variant.campaign.forEach((step, sIdx) => {
            display +=
              "\nStep " +
              (sIdx + 1) +
              " - Day " +
              (step.dayOffset ?? "?") +
              " (" +
              (step.channel || "sms") +
              ")";
            if (step.purpose)
              display += "\nPurpose: " + step.purpose;
            if (step.message)
              display += "\nMessage: " + step.message;
            display += "\n";
          });
        }
        display += "\n";
      });
    } else {
      display = "No variants data returned from AI.";
    }

    msgResult.value = display || "No data returned.";
  } catch (err) {
    console.error(err);
    msgResult.value =
      "Error generating AI message workflow. Try again.";
  } finally {
    messageGenerateButton.disabled = false;
    messageGenerateButton.innerHTML = oldText;
  }
}

messageGenerateButton.addEventListener("click", generateMessages);

// ----- Elite improvements: copy buttons + taller boxes -----

// 1) Make the social boxes taller so most posts are visible without scrolling
(function enlargeSocialBoxes() {
  const socials = [
    facebookPost,
    instagramPost,
    tiktokPost,
    linkedinPost,
    twitterPost,
    textBlurb,
    marketplacePost,
    hashtags,
  ].filter(Boolean);

  socials.forEach((el) => {
    el.style.minHeight = "260px";
    el.style.maxHeight = "340px";
  });
})();

// 2) Add "Copy" buttons to every social card header
(function addCopyButtons() {
  const textareas = [
    facebookPost,
    instagramPost,
    tiktokPost,
    linkedinPost,
    twitterPost,
    textBlurb,
    marketplacePost,
    hashtags,
  ].filter(Boolean);

  async function copyTextToClipboard(text) {
    if (!text.trim()) {
      throw new Error("Nothing to copy");
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    // Fallback: temporary textarea
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(temp);
    }
  }

  function createCopyButtonForTextarea(textarea) {
    const card = textarea.closest(".social-card");
    if (!card) return;
    const header = card.querySelector(".social-card-header");
    if (!header) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button-ghost copy-button";
    btn.innerHTML =
      '<span class="icon">📋</span><span>Copy</span>';

    btn.addEventListener("click", async () => {
      try {
        await copyTextToClipboard(textarea.value || "");
        const original = btn.innerHTML;
        btn.innerHTML =
          '<span class="icon">✅</span><span>Copied</span>';
        setTimeout(() => {
          btn.innerHTML =
            '<span class="icon">📋</span><span>Copy</span>';
        }, 1400);
      } catch (err) {
        console.error(err);
        alert(
          "Nothing to copy yet – generate a post first."
        );
      }
    });

    const newPostBtn = header.querySelector(".button-new-post");
    if (newPostBtn) {
      header.insertBefore(btn, newPostBtn);
    } else {
      header.appendChild(btn);
    }
  }

  textareas.forEach(createCopyButtonForTextarea);
})();

// Initial render of objection chat
renderObjectionChat();
const apiBase = "";

// Inputs & buttons
const vehicleUrlInput = document.getElementById("vehicleUrl");
const vehicleLabelInput = document.getElementById("vehicleLabel");
const priceInfoInput = document.getElementById("priceInfo");
const boostButton = document.getElementById("boostButton");
const statusText = document.getElementById("statusText");

const summaryLabel = document.getElementById("summaryLabel");
const summaryPrice = document.getElementById("summaryPrice");

// social outputs
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

// media & design
const buildVideoButton = document.getElementById("buildVideoButton");
const photosGrid = document.getElementById("photosGrid");
const photosStatus = document.getElementById("photosStatus");
const videoPlan = document.getElementById("videoPlan");

const newScriptButton = document.getElementById("newScriptButton");

const designTypeSelect = document.getElementById("designType");
const designButton = document.getElementById("designButton");
const designOutput = document.getElementById("designOutput");

// theme
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeLabel = document.getElementById("themeLabel");

// Floating tool launchers
const objectionLauncher = document.getElementById("objectionLauncher");
const paymentLauncher = document.getElementById("paymentLauncher");
const incomeLauncher = document.getElementById("incomeLauncher");
const messageLauncher = document.getElementById("messageLauncher");

// Objection modal elements
const objectionModal = document.getElementById("objectionModal");
const objectionCloseButton = document.getElementById("objectionCloseButton");
const objectionHistory = document.getElementById("objectionHistory");
const objectionInput = document.getElementById("objectionInput");
const objectionSendButton = document.getElementById("objectionSendButton");

// Payment modal elements
const paymentModal = document.getElementById("paymentModal");
const paymentCloseButton = document.getElementById("paymentCloseButton");
const payPrice = document.getElementById("payPrice");
const payDown = document.getElementById("payDown");
const payApr = document.getElementById("payApr");
const payTerm = document.getElementById("payTerm");
const paymentCalcButton = document.getElementById("paymentCalcButton");
const paymentResultText = document.getElementById("paymentResultText");

// Income modal elements
const incomeModal = document.getElementById("incomeModal");
const incomeCloseButton = document.getElementById("incomeCloseButton");
const incHourly = document.getElementById("incHourly");
const incHours = document.getElementById("incHours");
const incomeCalcButton = document.getElementById("incomeCalcButton");
const incomeResultText = document.getElementById("incomeResultText");

// Message modal elements
const messageModal = document.getElementById("messageModal");
const messageCloseButton = document.getElementById("messageCloseButton");
const msgChannel = document.getElementById("msgChannel");
const msgTone = document.getElementById("msgTone");
const msgFollowups = document.getElementById("msgFollowups");
const msgVariants = document.getElementById("msgVariants");
const msgAudience = document.getElementById("msgAudience");
const msgGoal = document.getElementById("msgGoal");
const msgDetails = document.getElementById("msgDetails");
const messageGenerateButton = document.getElementById("messageGenerateButton");
const msgResult = document.getElementById("msgResult");

let currentPhotos = [];
let currentUrl = "";
let isBoosting = false;

// chat history for objection coach
let objectionMessages = []; // { role: 'user' | 'assistant', content: string }

// ---------------- THEME HANDLING ----------------

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

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
});

initTheme();

// ---------------- HELPERS ----------------

function setStatus(text, isLoading = false) {
  if (isLoading) {
    statusText.innerHTML = '<span class="loading-dot"></span>' + text;
  } else {
    statusText.textContent = text;
  }
}

function safeTrim(str) {
  return (str || "").toString().trim();
}

function updateSummary(label, price) {
  summaryLabel.textContent = safeTrim(label) || "Vehicle ready";
  summaryPrice.textContent =
    safeTrim(price) || "Message for current pricing";
}

function fillSocialKit(kit) {
  facebookPost.value = kit.facebook || "";
  instagramPost.value = kit.instagram || "";
  tiktokPost.value = kit.tiktok || "";
  linkedinPost.value = kit.linkedin || "";
  twitterPost.value = kit.twitter || "";
  textBlurb.value = kit.textBlurb || "";
  marketplacePost.value = kit.marketplace || "";
  hashtags.value = kit.hashtags || "";
  videoScript.value = kit.videoScript || "";
  shotPlan.value = kit.shotPlan || "";
}

function renderPhotosGrid(photos) {
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

// render objection chat history into modal
function renderObjectionChat() {
  objectionHistory.innerHTML = "";
  if (!objectionMessages.length) {
    const empty = document.createElement("div");
    empty.style.opacity = "0.7";
    empty.textContent =
      "Paste the customer objection (or ask a question) and your Andy Elliott–style coach will give you word tracks and breakdowns.";
    objectionHistory.appendChild(empty);
    return;
  }

  objectionMessages.forEach((m) => {
    const labelDiv = document.createElement("div");
    labelDiv.style.fontSize = "10px";
    labelDiv.style.marginTop = "6px";
    labelDiv.style.opacity = "0.75";
    labelDiv.textContent = m.role === "assistant" ? "COACH" : "YOU";

    const bubble = document.createElement("div");
    bubble.style.whiteSpace = "pre-wrap";
    bubble.style.fontSize = "12px";
    bubble.style.marginTop = "2px";
    bubble.textContent = m.content || "";

    objectionHistory.appendChild(labelDiv);
    objectionHistory.appendChild(bubble);
  });

  objectionHistory.scrollTop = objectionHistory.scrollHeight;
}

// ---------------- BOOST FLOW ----------------

async function handleBoost() {
  if (isBoosting) return;
  const url = safeTrim(vehicleUrlInput.value);
  if (!url) {
    alert("Paste a dealer vehicle URL first.");
    return;
  }

  let label = safeTrim(vehicleLabelInput.value);
  if (!label) {
    label = "This vehicle";
    vehicleLabelInput.value = label;
  }
  let price = safeTrim(priceInfoInput.value);
  if (!price) {
    price = "Message for current pricing";
    priceInfoInput.value = price;
  }

  isBoosting = true;
  boostButton.disabled = true;
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
      photosStatus.textContent = "Trying to grab photos from dealer page…";
      const photoResp = await callJson("/api/grab-photos", { url });
      if (photoResp.success) {
        currentPhotos = photoResp.photos || [];
        renderPhotosGrid(currentPhotos);
      } else {
        photosStatus.textContent = "Could not grab photos.";
      }
    } catch (err) {
      console.error("Auto photo grab failed:", err);
      photosStatus.textContent = "Auto photo load failed.";
    }
  } catch (err) {
    console.error(err);
    setStatus("Something went wrong. Try again or check the URL.");
    alert("Error building social kit. Check the URL and try again.");
  } finally {
    isBoosting = false;
    boostButton.disabled = false;
  }
}

boostButton.addEventListener("click", handleBoost);

// ---------------- NEW POST BUTTONS ----------------

document.querySelectorAll(".button-new-post").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const platform = btn.getAttribute("data-platform");
    const url = safeTrim(vehicleUrlInput.value);
    const label = safeTrim(vehicleLabelInput.value);
    const price = safeTrim(priceInfoInput.value);

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
          facebookPost.value = text;
          break;
        case "instagram":
          instagramPost.value = text;
          break;
        case "tiktok":
          tiktokPost.value = text;
          break;
        case "linkedin":
          linkedinPost.value = text;
          break;
        case "twitter":
          twitterPost.value = text;
          break;
        case "text":
          textBlurb.value = text;
          break;
        case "marketplace":
          marketplacePost.value = text;
          break;
        case "hashtags":
          hashtags.value = text;
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

// ---------------- COPY BUTTONS ----------------

function wireCopyButtons() {
  document.querySelectorAll(".button-copy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const el = document.getElementById(targetId);
      if (!el) return;

      const text = el.value || "";
      const original = btn.innerHTML;

      if (!text.trim()) {
        btn.classList.remove("copied");
        btn.classList.add("empty");
        btn.innerHTML = '<span class="icon">⚠️</span><span>Empty</span>';
        setTimeout(() => {
          btn.classList.remove("empty");
          btn.innerHTML = original;
        }, 1200);
        return;
      }

      navigator.clipboard
        .writeText(text)
        .then(() => {
          btn.classList.remove("empty");
          btn.classList.add("copied");
          btn.innerHTML = '<span class="icon">✅</span><span>Copied!</span>';
          setTimeout(() => {
            btn.classList.remove("copied");
            btn.innerHTML = original;
          }, 1300);
        })
        .catch(() => {
          alert("Could not copy to clipboard. Try selecting and copying.");
        });
    });
  });
}

wireCopyButtons();

// ---------------- NEW VIDEO SCRIPT ----------------

newScriptButton.addEventListener("click", async () => {
  const url = safeTrim(vehicleUrlInput.value);
  const label = safeTrim(vehicleLabelInput.value);
  const price = safeTrim(priceInfoInput.value);

  if (!url || !label) {
    alert("Please paste a URL and hit Boost at least once before spinning scripts.");
    return;
  }

  newScriptButton.disabled = true;
  const oldText = newScriptButton.innerHTML;
  newScriptButton.innerHTML = '<span class="icon">⏳</span><span>Working…</span>';

  try {
    const resp = await callJson("/api/new-script", { url, label, price });
    if (!resp.success) throw new Error("API error");
    videoScript.value = resp.script || "";
  } catch (err) {
    console.error(err);
    alert("Error generating a new script. Try again.");
  } finally {
    newScriptButton.disabled = false;
    newScriptButton.innerHTML = oldText;
  }
});

// ---------------- BUILD VIDEO PLAN FROM PHOTOS ----------------

buildVideoButton.addEventListener("click", async () => {
  if (!currentPhotos || !currentPhotos.length) {
    alert("No photos yet. Boost a listing first so we can grab photos.");
    return;
  }

  buildVideoButton.disabled = true;
  const oldText = buildVideoButton.innerHTML;
  buildVideoButton.innerHTML = '<span class="icon">⏳</span><span>Building…</span>';

  try {
    const label = safeTrim(vehicleLabelInput.value) || "this vehicle";
    const resp = await callJson("/api/video-from-photos", {
      photos: currentPhotos,
      label,
    });
    if (!resp.success) throw new Error("API error");
    videoPlan.value = resp.plan || "";
  } catch (err) {
    console.error(err);
    alert("Error building video plan. Try again.");
  } finally {
    buildVideoButton.disabled = false;
    buildVideoButton.innerHTML = oldText;
  }
});

// ---------------- DESIGN LAB ----------------

designButton.addEventListener("click", async () => {
  const type = designTypeSelect.value;
  const url = safeTrim(vehicleUrlInput.value);
  const label = safeTrim(vehicleLabelInput.value);
  const price = safeTrim(priceInfoInput.value);

  if (!url || !label) {
    alert(
      "Please paste a URL and hit Boost at least once before generating design ideas."
    );
    return;
  }

  designButton.disabled = true;
  const oldText = designButton.innerHTML;
  designButton.innerHTML = '<span class="icon">⏳</span><span>Designing…</span>';

  try {
    const resp = await callJson("/api/design-idea", { type, url, label, price });
    if (!resp.success) throw new Error("API error");
    designOutput.value = resp.design || "";
  } catch (err) {
    console.error(err);
    alert("Error generating a design idea. Try again.");
  } finally {
    designButton.disabled = false;
    designButton.innerHTML = oldText;
  }
});

// ---------------- OBJECTION COACH MODAL ----------------

function openObjectionModal() {
  objectionModal.classList.remove("hidden");
  if (!objectionMessages.length) {
    renderObjectionChat();
  }
  setTimeout(() => objectionInput.focus(), 50);
