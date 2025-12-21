// public/app.js – Lot Rocket frontend logic v2.6 (CLEAN SINGLE-PASS)
// Goals:
// - ZERO duplicate declarations
// - ONE single source of truth for photo state (MAX_PHOTOS = 24 everywhere)
// - Stable buttons + modals + Step 3 tools (Creative Lab + Social Strip + Canvas + Design Studio)

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Lot Rocket frontend loaded (v2.6 clean)");
  const apiBase = "";

  // ==================================================
  // CORE CONSTANTS + GLOBAL STORE
  // ==================================================
  const MAX_PHOTOS = 24;

  window.LOTROCKET = window.LOTROCKET || {};
  const STORE = window.LOTROCKET;

  STORE.creativePhotos = Array.isArray(STORE.creativePhotos) ? STORE.creativePhotos : []; // urls (strings)
  STORE.designStudioPhotos = Array.isArray(STORE.designStudioPhotos) ? STORE.designStudioPhotos : []; // urls (strings)
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : []; // objects (normalized below)

  // ==================================================
  // UTIL (ONE AND ONLY ONE $)
  // ==================================================
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = (el.scrollHeight + 4) + "px";
  }

  function capMax(arr, max = MAX_PHOTOS) {
    return Array.isArray(arr) ? arr.slice(0, max) : [];
  }

  function uniqueUrls(urls) {
    const out = [];
    const seen = new Set();
    (urls || []).forEach((u) => {
      if (!u) return;
      if (seen.has(u)) return;
      seen.add(u);
      out.push(u);
    });
    return out;
  }

  function normalizeSocialReady() {
    STORE.socialReadyPhotos = (STORE.socialReadyPhotos || [])
      .map((p) =>
        typeof p === "string"
          ? { url: p, originalUrl: p, selected: true, locked: false }
          : p
      )
      .filter((p) => p && p.url);

    if (STORE.socialReadyPhotos.length > MAX_PHOTOS) {
      STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(-MAX_PHOTOS);
    }

    if (!STORE.socialReadyPhotos.length) socialIndex = 0;
    else socialIndex = clamp(socialIndex, 0, STORE.socialReadyPhotos.length - 1);
  }

  // Proxy helper for CORS-sensitive images
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

  function triggerDownload(url, filename) {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "lot-rocket.jpg";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ==================================================
  // BRAND + THEME
  // ==================================================
  const BRAND = {
    primary: "#f97316",
    secondary: "#ec4899",
    dark: "#020617",
    light: "#f9fafb",
    textLight: "#f9fafb",
    textDark: "#020617",
  };

  const STUDIO_STORAGE_KEY = "lotRocketDesignStudio";

  const themeToggleInput = $("themeToggle");
  if (themeToggleInput) {
    const applyTheme = (isDark) => {
      document.body.classList.toggle("dark-theme", !!isDark);
      themeToggleInput.checked = !!isDark;
    };
    applyTheme(true);
    themeToggleInput.addEventListener("change", () => applyTheme(themeToggleInput.checked));
  }

  // Auto-grow ALL textareas
  document.querySelectorAll("textarea").forEach((ta) => {
    autoResizeTextarea(ta);
    ta.addEventListener("input", () => autoResizeTextarea(ta));
  });

  // ==================================================
  // RIGHT-SIDE TOOL MODALS (SINGLE, STABLE WIRING)
  // - Uses hidden class + aria-hidden
  // - Prevents double wiring
  // - Global delegated close buttons + ESC close
  // ==================================================
  const SIDE_TOOL_CONFIG = [
    { launcherId: "objectionLauncher", modalIds: ["objectionModal"] },
    { launcherId: "calcLauncher", modalIds: ["calcModal", "calculatorModal", "calcModeModal"] },
    { launcherId: "paymentLauncher", modalIds: ["paymentModal"] },
    { launcherId: "incomeLauncher", modalIds: ["incomeModal"] },
    { launcherId: "workflowLauncher", modalIds: ["workflowModal"] },
    { launcherId: "messageLauncher", modalIds: ["messageModal"] },
    { launcherId: "askLauncher", modalIds: ["askModal"] },
    { launcherId: "carLauncher", modalIds: ["carModal"] },
    { launcherId: "imageLauncher", modalIds: ["imageModal", "imageModeModal", "imageDrawer", "imagePanel"] },
    { launcherId: "videoLauncher", modalIds: ["videoModal", "videoModeModal", "videoDrawer", "videoPanel"] },
  ];

  const sideToolsDebug = (...args) => console.log("🧰 SideTools:", ...args);

  function resolveFirstExisting(ids) {
    return (ids || []).map((id) => $(id)).find(Boolean) || null;
  }

  function openSideModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeSideModal(modal) {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function wireSideTool(launcherId, modalIds, onOpen) {
    const launcher = $(launcherId);
    if (!launcher) return;

    if (launcher.dataset.wired === "true") return;
    launcher.dataset.wired = "true";

    const modal = resolveFirstExisting(modalIds);
    if (!modal) {
      sideToolsDebug("Missing modal for launcher:", launcherId, modalIds);
      return;
    }

    if (modal.dataset.backdropWired !== "true") {
      modal.dataset.backdropWired = "true";
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeSideModal(modal);
      });
    }

    launcher.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSideModal(modal);
      if (typeof onOpen === "function") onOpen();
    });
  }

  // Delegated close buttons for ANY side modal
  if (document.body.dataset.sideModalCloseWired !== "true") {
    document.body.dataset.sideModalCloseWired = "true";

    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest("[data-close], .side-modal-close, .modal-close-btn");
      if (!closeBtn) return;
      const modal = closeBtn.closest(".side-modal");
      if (!modal) return;
      sideToolsDebug("CLOSE:", modal.id);
      closeSideModal(modal);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".side-modal:not(.hidden)").forEach((m) => closeSideModal(m));
    });
  }

  function buildVideoContextFromKit() {
    const parts = [];
    const label = (
      $("vehicleLabel")?.value ||
      $("summaryLabel")?.textContent ||
      ""
    ).trim();
    const price = (
      $("priceInfo")?.value ||
      $("summaryPrice")?.textContent ||
      ""
    ).trim();
    const url = ($("vehicleUrl")?.value || "").trim();
    const tags = ($("hashtags")?.value || "").trim();
    if (label) parts.push(`Vehicle: ${label}`);
    if (price) parts.push(`Price/Offer: ${price}`);
    if (url) parts.push(`Listing URL: ${url}`);
    if (tags) parts.push(`Hashtags: ${tags}`);
    return parts.join("\n");
  }

  // Wire side tools (video fills context on open)
  SIDE_TOOL_CONFIG.forEach((t) => {
    if (t.launcherId === "videoLauncher") {
      wireSideTool(t.launcherId, t.modalIds, () => {
        const videoContextField = $("videoContext");
        if (videoContextField) {
          videoContextField.value = buildVideoContextFromKit();
          autoResizeTextarea(videoContextField);
        }
      });
    } else {
      wireSideTool(t.launcherId, t.modalIds);
    }
  });

  sideToolsDebug("Presence report:", SIDE_TOOL_CONFIG.map((t) => ({
    launcher: t.launcherId,
    launcherFound: !!$(t.launcherId),
    modalIds: t.modalIds,
    modalFound: !!resolveFirstExisting(t.modalIds),
  })));

// ==================================================
// STEP 1 – SOCIAL KIT + DEALER PHOTOS GRID
// ==================================================
const vehicleUrlInput = $("vehicleUrl");
const vehicleLabelInput = $("vehicleLabel");
const priceInfoInput = $("priceInfo");
const boostButton = $("boostButton");
const statusText = $("statusText");

const summaryLabel = $("summaryLabel");
const summaryPrice = $("summaryPrice");

const facebookPost = $("facebookPost");
const instagramPost = $("instagramPost");
const tiktokPost = $("tiktokPost");
const linkedinPost = $("linkedinPost");
const twitterPost = $("twitterPost");
const textBlurb = $("textBlurb");
const marketplacePost = $("marketplacePost");
const hashtags = $("hashtags");

const photosGrid = $("photosGrid");

let socialIndex = 0; // preview index
let dealerPhotos = []; // [{ src, selected }]

// ---------- helpers ----------
function setTA(el, v) {
  if (!el) return;
  el.value = v || "";
  autoResizeTextarea(el);
}

// ---------- grid render (NO FILTERING HERE) ----------
function renderDealerPhotos() {
  if (!photosGrid) return;
  photosGrid.innerHTML = "";

  console.log("🖼️ Rendering dealer photos:", dealerPhotos.length);

  dealerPhotos.forEach((photo, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "photo-thumb-btn" + (photo.selected ? " photo-thumb-selected" : "");
    btn.dataset.index = String(index);

    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = `Dealer photo ${index + 1}`;
    img.loading = "lazy";
    img.className = "photo-thumb-img";

    btn.appendChild(img);
    photosGrid.appendChild(btn);

    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index || "0");
      if (!dealerPhotos[idx]) return;
      dealerPhotos[idx].selected = !dealerPhotos[idx].selected;
      renderDealerPhotos();
    });
  });
}

// ---------- BOOST ----------
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
   const res = await fetch(apiBase + "/api/boost", {

      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, labelOverride, priceOverride }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(data?.message || `Boost failed (HTTP ${res.status})`);
console.log("✅ BOOST RESPONSE keys:", Object.keys(data || {}));
console.log("📥 BOOST photos count:", Array.isArray(data?.photos) ? data.photos.length : "no photos array");
console.log("📥 BOOST sample photos:", (data?.photos || []).slice(0, 20));

    // Summary
    if (summaryLabel) summaryLabel.textContent = data.vehicleLabel || "—";
    if (summaryPrice) summaryPrice.textContent = data.priceInfo || "—";

    if (vehicleLabelInput && !vehicleLabelInput.value)
      vehicleLabelInput.value = data.vehicleLabel || "";
    if (priceInfoInput && !priceInfoInput.value)
      priceInfoInput.value = data.priceInfo || "";

    // Copy blocks
    setTA(facebookPost, data.facebook);
    setTA(instagramPost, data.instagram);
    setTA(tiktokPost, data.tiktok);
    setTA(linkedinPost, data.linkedin);
    setTA(twitterPost, data.twitter);
    setTA(textBlurb, data.text);
    setTA(marketplacePost, data.marketplace);
    setTA(hashtags, data.hashtags);

// ---------- DEALER PHOTOS (FILTER ONCE HERE) ----------
const rawPhotos = Array.isArray(data.photos) ? data.photos : [];
dealerPhotos = rawPhotos.map((src) => ({ src, selected: false }));
renderDealerPhotos();


// ✅ log immediately after we read backend photos
console.log("📥 Raw photos from backend:", rawPhotos.length);

// 1) clean + dedupe early
const cleaned = Array.from(
  new Set(
    rawPhotos
      .map((u) => String(u || "").trim())
      .filter(Boolean)
  )
);

// 2) strong junk detector (cross-dealer)
function isJunkUrl(u) {
  const s = String(u || "").toLowerCase();

  // not photos
  if (s.startsWith("data:") || s.startsWith("blob:")) return true;

  // wrong filetypes
  if (/\.(svg|ico|gif|mp4|webm|css|js)(\?|$)/i.test(s)) return true;

  // must look like an image file OR common photo endpoints
  const looksLikeImage =
    /\.(jpg|jpeg|png|webp)(\?|$)/i.test(s) ||
    s.includes("inventoryphotos") ||
    s.includes("image") ||
    s.includes("photo") ||
    s.includes("media");

  if (!looksLikeImage) return true;

  // obvious junk keywords
  if (
    s.includes("logo") ||
    s.includes("brand") ||
    s.includes("dealer") ||
    s.includes("favicon") ||
    s.includes("sprite") ||
    s.includes("icon") ||
    s.includes("placeholder") ||
    s.includes("loading") ||
    s.includes("spacer") ||
    s.includes("blank") ||
    s.includes("pixel") ||
    s.includes("carfax") ||
    s.includes("autocheck") ||
    s.includes("onstar") ||
    s.includes("youtube") ||
    s.includes("play") ||
    s.includes("special") ||
    s.includes("banner") ||
    s.includes("badge")
  ) return true;

  return false;
}

// 3) prefer obvious vehicle photo feeds if we have enough
const preferred = cleaned.filter((u) => {
  const s = u.toLowerCase();
  return (
    !isJunkUrl(u) &&
    (
      s.includes("inventoryphotos") ||
      s.includes("/photos/") ||
      s.includes("/images/") ||
      s.includes("vehicle") ||
      s.includes("gallery") ||
      s.includes("cdn")
    )
  );
});

const finalList =
  preferred.length >= 10
    ? preferred
    : cleaned.filter((u) => !isJunkUrl(u));

dealerPhotos = finalList.map((src) => ({ src, selected: false }));

// ✅ log after filter + map
console.log("✅ Dealer photos after filter:", dealerPhotos.length);

renderDealerPhotos();


// ==================================================

  // COPY / REGEN
  // ==================================================
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    if (btn.dataset.wired === "true") return;
    btn.dataset.wired = "true";

    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-copy-target");
      if (!targetId) return;
      const el = $(targetId);
      if (!el) return;

      el.select?.();
      try { el.setSelectionRange?.(0, 99999); } catch {}
      document.execCommand("copy");

      btn.classList.add("copied");
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("copied");
      }, 1200);
    });
  });

  document.querySelectorAll(".regen-btn").forEach((btn) => {
    if (btn.dataset.wired === "true") return;
    btn.dataset.wired = "true";

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

        const targetId = map[platform];
        const ta = targetId ? $(targetId) : null;
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
  // PAYMENT CALCULATOR
  // ==================================================
  const paymentForm = $("paymentForm");
  if (paymentForm && paymentForm.dataset.wired !== "true") {
    paymentForm.dataset.wired = "true";

    const priceInput = $("paymentPrice");
    const cashDownInput = $("paymentCashDown");
    const tradeValueInput = $("paymentTradeValue");
    const tradeOweInput = $("paymentTradeOwe");
    const rateInput = $("paymentRate");
    const termInput = $("paymentTerm");
    const taxInput = $("paymentTax");

    const paymentMonthlyEl = $("paymentMonthly");
    const paymentDetailsEl = $("paymentDetails");

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
        if (paymentDetailsEl) paymentDetailsEl.textContent = "Enter vehicle price and term (years).";
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
      details += "Estimate only; lender/fees vary.";
      if (paymentDetailsEl) paymentDetailsEl.textContent = details;
    });
  }

  // ==================================================
  // INCOME CALCULATOR
  // ==================================================
  const incomeForm = $("incomeForm");
  if (incomeForm && incomeForm.dataset.wired !== "true") {
    incomeForm.dataset.wired = "true";

    const incomeYtdInput = $("incomeYtd");
    const incomeLastPaycheckInput = $("incomeLastPaycheck");
    const incomeOutput = $("incomeOutput");

    incomeForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const rawYtd = (incomeYtdInput?.value || "").replace(/[^0-9.]/g, "");
      const ytd = parseFloat(rawYtd);

      if (!ytd || Number.isNaN(ytd)) {
        if (incomeOutput) incomeOutput.textContent = "Enter year-to-date gross income (numbers only).";
        return;
      }

      if (!incomeLastPaycheckInput?.value) {
        if (incomeOutput) incomeOutput.textContent = "Choose the date of your last paycheck.";
        return;
      }

      const lastDate = new Date(incomeLastPaycheckInput.value + "T12:00:00");
      if (Number.isNaN(lastDate.getTime())) {
        if (incomeOutput) incomeOutput.textContent = "That paycheck date isn’t valid.";
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
          `Avg Monthly: $${fmtMoney0(estMonthly)}`;
      }
    });
  }

  // ==================================================
  // OBJECTION COACH (server endpoint)
  // ==================================================
  const objectionForm = $("objectionForm");
  const objectionOutput = $("objectionOutput");

  if (objectionForm && objectionOutput && objectionForm.dataset.wired !== "true") {
    objectionForm.dataset.wired = "true";

    objectionForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fd = new FormData(objectionForm);
      const payload = {};
      fd.forEach((value, key) => (payload[key] = value));

      objectionOutput.value = "Coaching that objection…";
      autoResizeTextarea(objectionOutput);

      try {
        const res = await fetch(apiBase + "/api/objection-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status} from objection coach.`);

        const reply = data?.coachedMessage || data?.answer || data?.message || "";
        objectionOutput.value = reply.trim() ? reply : "Empty reply from server.";
      } catch (err) {
        console.error("Objection coach error:", err);
        objectionOutput.value = "Lot Rocket couldn't coach that objection right now. Try again in a bit.";
      }

      autoResizeTextarea(objectionOutput);
    });
  }

  // ==================================================
  // AI HELPERS (message-helper)
  // ==================================================
  function wireMessageHelper(formId, outputId, mode) {
    const form = $(formId);
    const output = $(outputId);
    if (!form || !output) return;

    if (form.dataset.wired === "true") return;
    form.dataset.wired = "true";

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
  // DRILL MODE – Q&A + GRADING (prefers /api/drill-grade)
  // ==================================================
  const drillLauncher = $("drillLauncher");
  const drillModal = $("drillModeModal");
  const closeDrillModeBtn = $("closeDrillMode");

  const drillObjectionText = $("drillObjectionText");
  const getDrillObjectionBtn = $("getDrillObjection");

  const drillReplyInput = $("drillReplyInput");
  const gradeDrillReplyBtn = $("gradeDrillReply");

  const drillResult = $("drillResult");
  const drillTimerDisplay = $("drillTimer");

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
    drillModal.style.display = "flex";
    resetDrillState();
  }

  function closeDrillModal() {
    if (!drillModal) return;
    drillModal.classList.add("hidden");
    drillModal.style.display = "none";
    stopDrillTimer();
  }

  if (drillLauncher && drillLauncher.dataset.wired !== "true") {
    drillLauncher.dataset.wired = "true";
    drillLauncher.addEventListener("click", (e) => {
      e.preventDefault();
      openDrillModal();
    });
  }

  if (closeDrillModeBtn && closeDrillModeBtn.dataset.wired !== "true") {
    closeDrillModeBtn.dataset.wired = "true";
    closeDrillModeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeDrillModal();
    });
  }

  if (drillModal && drillModal.dataset.backdropWired !== "true") {
    drillModal.dataset.backdropWired = "true";
    drillModal.addEventListener("click", (e) => {
      if (e.target === drillModal) closeDrillModal();
    });
  }

  if (getDrillObjectionBtn && getDrillObjectionBtn.dataset.wired !== "true") {
    getDrillObjectionBtn.dataset.wired = "true";
    getDrillObjectionBtn.addEventListener("click", () => {
      const idx = Math.floor(Math.random() * DRILL_OBJECTIONS.length);
      currentDrillObjection = DRILL_OBJECTIONS[idx];
      if (drillObjectionText) drillObjectionText.textContent = currentDrillObjection;
      resetDrillState();
      startDrillTimer(60);
      drillReplyInput?.focus?.();
    });
  }

  if (gradeDrillReplyBtn && gradeDrillReplyBtn.dataset.wired !== "true") {
    gradeDrillReplyBtn.dataset.wired = "true";
    gradeDrillReplyBtn.addEventListener("click", async () => {
      const reply = (drillReplyInput?.value || "").trim();

      if (!currentDrillObjection) {
        setDrillResult('Hit “Give Me an Objection” first.', true);
        return;
      }
      if (!reply) {
        setDrillResult("Type your response first, then I’ll grade it.", true);
        return;
      }

      stopDrillTimer();
      setDrillResult("Grading your reply…", true);

      const payload = {
        objection: currentDrillObjection,
        reply,
        secondsRemaining: drillSecondsLeft,
        rubric: { tone: "confident, friendly, professional", target: "set appointment or move to numbers" },
      };

      try {
        let res = await fetch(apiBase + "/api/drill-grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          res = await fetch(apiBase + "/api/message-helper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "objection-drill", ...payload }),
          });
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `AI grading failed (HTTP ${res.status}).`);

        if (typeof data?.score === "number") {
          const msg =
            `Score: ${data.score}/100\n\n` +
            `✅ What you did well:\n${data.what_you_did_well || "—"}\n\n` +
            `🔧 What to fix:\n${data.what_to_fix || "—"}\n\n` +
            `🔥 Better response:\n${data.better_response || "—"}\n\n` +
            `Coach tip: ${data.one_sentence_coaching_tip || "—"}`;
          setDrillResult(msg, true);
        } else {
          setDrillResult(data.text || "Couldn’t grade that one. Try another objection.", true);
        }
      } catch (err) {
        console.error("Drill grading error:", err);
        setDrillResult(err?.message || "Error talking to AI. Try again in a moment.", true);
      }
    });
  }

  // ==================================================
  // VIDEO BUILDER (message-helper: video-brief)
  // ==================================================
  const videoFormEl = $("videoForm");
  const videoScriptOutput = $("videoScriptOutput");
  const videoShotListOutput = $("videoShotListOutput");
  const videoAIPromptOutput = $("videoAIPromptOutput");
  const videoThumbPromptOutput = $("videoThumbPromptOutput");

  const videoScriptOutputBottom = $("videoScriptOutputBottom");
  const videoShotListOutputBottom = $("videoShotListOutputBottom");
  const videoAIPromptOutputBottom = $("videoAIPromptOutputBottom");
  const videoThumbPromptOutputBottom = $("videoThumbPromptOutputBottom");

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

  if (videoFormEl && videoFormEl.dataset.wired !== "true") {
    videoFormEl.dataset.wired = "true";

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
  // STEP 3 – CREATIVE LAB (thumbs + tuner + upload)
  // ==================================================
  const photoDropZone = $("photoDropZone");
  const photoFileInput = $("photoFileInput");
  const creativeThumbGrid = $("creativeThumbGrid");
  const sendToDesignStudioBtn = $("sendToDesignStudio");

  const tunerPreviewImg = $("tunerPreviewImg");
  const tunerBrightness = $("tunerBrightness");
  const tunerContrast = $("tunerContrast");
  const tunerSaturation = $("tunerSaturation");
  const autoEnhanceBtn = $("autoEnhanceBtn");

  const hiddenTunerCanvas = document.createElement("canvas");
  const hiddenTunerCtx = hiddenTunerCanvas.getContext ? hiddenTunerCanvas.getContext("2d") : null;
  let currentTunerFilter = "";

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
      img.src = getProxiedImageUrl(src);
    });
  }

  function renderCreativeThumbs() {
    if (!creativeThumbGrid) return;
    creativeThumbGrid.innerHTML = "";

    STORE.creativePhotos = capMax(uniqueUrls(STORE.creativePhotos), MAX_PHOTOS);

    STORE.creativePhotos.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Creative photo";
      img.loading = "lazy";
      img.className = "creative-thumb";
      img.title = "Click to select. Double-click to send edited copy to Social Strip.";

      img.addEventListener("click", () => {
        img.classList.toggle("selected");
        if (tunerPreviewImg) {
          tunerPreviewImg.src = url;
          applyTunerFilters();
        }
      });

      img.addEventListener("dblclick", async () => {
        const edited = await buildEditedDataUrl(url);
        addToSocialReady(edited, true);
      });

      creativeThumbGrid.appendChild(img);
    });

    if (
      tunerPreviewImg &&
      (!tunerPreviewImg.getAttribute("src") || tunerPreviewImg.src === "") &&
      STORE.creativePhotos.length
    ) {
      tunerPreviewImg.src = STORE.creativePhotos[0];
      applyTunerFilters();
    }
  }

  function handleCreativeFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    files.forEach((file) => {
      if (!file?.type?.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      STORE.creativePhotos.push(url);
    });

    STORE.creativePhotos = capMax(uniqueUrls(STORE.creativePhotos), MAX_PHOTOS);
    renderCreativeThumbs();
  }

  if (photoDropZone && photoFileInput && photoDropZone.dataset.wired !== "true") {
    photoDropZone.dataset.wired = "true";

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

  // Step 1 -> Send Top Photos into Creative + Social Strip
  const step1SendTopBtn = $("sendTopPhotosBtn");
  if (step1SendTopBtn && step1SendTopBtn.dataset.wired !== "true") {
    step1SendTopBtn.dataset.wired = "true";

    step1SendTopBtn.addEventListener("click", () => {
      if (!dealerPhotos.length) {
        alert("Boost a listing first so Lot Rocket can grab photos.");
        return;
      }

      const selected = dealerPhotos.filter((p) => p.selected).map((p) => p.src);
      const chosen = (selected.length ? selected : dealerPhotos.map((p) => p.src)).slice(0, MAX_PHOTOS);

      STORE.creativePhotos = capMax(uniqueUrls([...STORE.creativePhotos, ...chosen]), MAX_PHOTOS);
      renderCreativeThumbs();

      chosen.forEach((u) => addToSocialReady(u, false));

      step1SendTopBtn.classList.add("success");
      setTimeout(() => step1SendTopBtn.classList.remove("success"), 700);
    });
  }

  // ==================================================
  // SOCIAL READY STRIP (ONE MODULE ONLY)
  // ==================================================
  const socialCarousel = $("socialCarousel");
  const socialPreviewImg = $("socialCarouselPreviewImg");
  const socialStatus = $("socialCarouselStatus");
  const socialPrevBtn = $("socialPrevBtn");
  const socialNextBtn = $("socialNextBtn");

  const revertSocialPhotoBtn = $("revertSocialPhotoBtn");
  const downloadAllEditedBtn = $("downloadAllEditedBtn");
  const openDesignFromCarouselBtn = $("openDesignFromCarouselBtn");
  const openCanvasFromCarouselBtn = $("openCanvasFromCarouselBtn");

  function renderSocialStrip() {
    normalizeSocialReady();
    if (!socialCarousel) return;

    socialCarousel.innerHTML = "";

    STORE.socialReadyPhotos.forEach((photo, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className =
        "social-carousel-item" +
        (index === socialIndex ? " selected" : "") +
        (photo.selected ? " picked" : "") +
        (photo.locked ? " locked" : "");
      item.title = "Click: select for actions • Double-click: remove";

      const img = document.createElement("img");
      img.src = photo.url;
      img.alt = `Social-ready ${index + 1}`;
      img.loading = "lazy";
      img.className = "social-carousel-img";

      item.appendChild(img);

      item.addEventListener("click", () => {
        socialIndex = index;
        photo.selected = !photo.selected;
        renderSocialStrip();
      });

      item.addEventListener("dblclick", (e) => {
        e.preventDefault();
        if (photo.locked) {
          alert("This photo is locked. Unlock it first to remove it.");
          return;
        }
        STORE.socialReadyPhotos.splice(index, 1);
        socialIndex = clamp(socialIndex, 0, Math.max(0, STORE.socialReadyPhotos.length - 1));
        renderSocialStrip();
      });

      socialCarousel.appendChild(item);
    });

    if (socialPreviewImg) {
      const active = STORE.socialReadyPhotos[socialIndex];
      socialPreviewImg.src = active?.url || "";
      socialPreviewImg.alt = active?.url ? "Social preview" : "";
    }

    if (socialStatus) {
      if (!STORE.socialReadyPhotos.length) {
        socialStatus.textContent = "No social-ready photos yet. Double-click a Creative photo to add it.";
      } else {
        const selectedCount = STORE.socialReadyPhotos.filter((p) => p.selected).length;
        socialStatus.textContent = `Photo ${socialIndex + 1}/${STORE.socialReadyPhotos.length} • Selected: ${selectedCount}`;
      }
    }
  }

  function addToSocialReady(url, selected = true) {
    if (!url) return;
    normalizeSocialReady();

    const existing = STORE.socialReadyPhotos.findIndex((p) => p.url === url);
    if (existing !== -1) {
      socialIndex = existing;
      STORE.socialReadyPhotos[existing].selected = true;
      renderSocialStrip();
      return;
    }

    STORE.socialReadyPhotos.push({
      url,
      originalUrl: url,
      selected: !!selected,
      locked: false,
    });

    normalizeSocialReady();
    socialIndex = STORE.socialReadyPhotos.length - 1;
    renderSocialStrip();
  }

  socialPrevBtn?.addEventListener("click", () => {
    normalizeSocialReady();
    if (!STORE.socialReadyPhotos.length) return;
    socialIndex = (socialIndex - 1 + STORE.socialReadyPhotos.length) % STORE.socialReadyPhotos.length;
    renderSocialStrip();
  });

  socialNextBtn?.addEventListener("click", () => {
    normalizeSocialReady();
    if (!STORE.socialReadyPhotos.length) return;
    socialIndex = (socialIndex + 1) % STORE.socialReadyPhotos.length;
    renderSocialStrip();
  });

  revertSocialPhotoBtn?.addEventListener("click", () => {
    normalizeSocialReady();
    if (!STORE.socialReadyPhotos.length) return alert("No social-ready photos to revert.");
    const p = STORE.socialReadyPhotos[socialIndex];
    if (!p?.originalUrl) return alert("No original saved for this photo.");
    p.url = p.originalUrl;
    renderSocialStrip();
  });

  downloadAllEditedBtn?.addEventListener("click", () => {
    normalizeSocialReady();
    if (!STORE.socialReadyPhotos.length) return alert("No social-ready photos to download.");

    const urls = STORE.socialReadyPhotos.map((p) => p.url).filter(Boolean);
    const proxied = urls.map((u) => getProxiedImageUrl(u));

    const original = downloadAllEditedBtn.textContent;
    downloadAllEditedBtn.disabled = true;
    downloadAllEditedBtn.textContent = "Downloading…";

    proxied.forEach((u, idx) => {
      setTimeout(() => triggerDownload(u, `lot-rocket-photo-${idx + 1}.jpg`), idx * 180);
    });

    setTimeout(() => {
      downloadAllEditedBtn.disabled = false;
      downloadAllEditedBtn.textContent = original || "Download JPGs";
    }, proxied.length * 180 + 500);
  });

  // ==================================================
  // CANVAS STUDIO (Fabric) — stable minimal
  // ==================================================
  const creativeStudioOverlay = $("creativeStudioOverlay");
  const creativeCloseBtn = $("creativeClose");
  const canvasLauncher = $("canvasLauncher");

  const canvasPresetSelect = $("creativeCanvasPreset");
  const creativeUndo = $("creativeUndo");
  const creativeRedo = $("creativeRedo");
  const creativeDelete = $("creativeDelete");
  const creativeExportPng = $("creativeExportPng");
  const creativeImageInput = $("creativeImageInput");
  const creativeToolButtons = document.querySelectorAll(".tool-btn");

  let creativeCanvas = null;
  let creativeHistory = [];
  let creativeHistoryIndex = -1;

  function saveCanvasState() {
    if (!creativeCanvas) return;
    const json = creativeCanvas.toJSON();
    creativeHistory = creativeHistory.slice(0, creativeHistoryIndex + 1);
    creativeHistory.push(json);
    creativeHistoryIndex = creativeHistory.length - 1;
  }

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

  function loadCanvasState(index) {
    if (!creativeCanvas) return;
    if (index < 0 || index >= creativeHistory.length) return;
    creativeHistoryIndex = index;
    creativeCanvas.loadFromJSON(creativeHistory[index], () => creativeCanvas.renderAll());
  }

  function addImageFromUrl(url) {
    const canvas = ensureCanvas();
    if (!canvas || !url) return;

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

  if (canvasLauncher && canvasLauncher.dataset.wired !== "true") {
    canvasLauncher.dataset.wired = "true";
    canvasLauncher.addEventListener("click", (e) => {
      e.preventDefault();
      openCreativeStudio();
    });
  }

  if (creativeCloseBtn && creativeStudioOverlay && creativeCloseBtn.dataset.wired !== "true") {
    creativeCloseBtn.dataset.wired = "true";
    creativeCloseBtn.addEventListener("click", closeCreativeStudio);

    if (creativeStudioOverlay.dataset.backdropWired !== "true") {
      creativeStudioOverlay.dataset.backdropWired = "true";
      creativeStudioOverlay.addEventListener("click", (e) => {
        if (e.target === creativeStudioOverlay) closeCreativeStudio();
      });
    }
  }

  canvasPresetSelect?.addEventListener("change", () => {
    const canvas = ensureCanvas();
    if (!canvas) return;
    const [w, h] = (canvasPresetSelect.value || "").split("x").map(Number);
    if (!w || !h) return;
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
      triggerDownload(dataUrl, "lot-rocket-creative.png");
    } catch (err) {
      console.error("Export PNG error:", err);
      alert("Export blocked (CORS). Use proxied images or uploads.");
    }
  });

  creativeImageInput?.addEventListener("change", (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    handleCreativeFiles(files);
    creativeImageInput.value = "";
  });

  creativeToolButtons.forEach((btn) => {
    if (btn.dataset.wired === "true") return;
    btn.dataset.wired = "true";

    btn.addEventListener("click", () => {
      const tool = btn.getAttribute("data-tool");
      if (!tool) return;

      creativeToolButtons.forEach((b) => b.classList.remove("tool-btn-active"));
      btn.classList.add("tool-btn-active");

      if (tool === "uploadImage" && creativeImageInput) creativeImageInput.click();
    });
  });

  // ==================================================
  // DESIGN STUDIO 3.5 (Konva) — stable init + tray
  // (Your original section kept, just cleaned for wiring consistency)
  // ==================================================
  const designStudioOverlay = $("designStudioOverlay");
  const designLauncher = $("designLauncher");
  const designCloseBtn = $("designClose");

  const studioExportPng = $("studioExportPng");
  const studioUndoBtn = $("studioUndoBtn");
  const studioRedoBtn = $("studioRedoBtn");
  const studioSizePreset = $("studioSizePreset");

  const toolAddText = $("toolAddText");
  const toolAddShape = $("toolAddShape");
  const toolAddBadge = $("toolAddBadge");
  const toolSetBackground = $("toolSetBackground");

  const layersList = $("layersList");
  const layerTextInput = $("layerTextInput");
  const layerFontSizeInput = $("layerFontSizeInput");
  const layerOpacityInput = $("layerOpacityInput");
  const layerDeleteBtn = $("layerDeleteBtn");

  const saveDesignBtn = $("saveDesignBtn");
  const loadDesignBtn = $("loadDesignBtn");

  const templatePaymentBtn = $("templatePayment");
  const templateArrivalBtn = $("templateArrival");
  const templateSaleBtn = $("templateSale");

  const studioPhotoTray = $("studioPhotoTray");
  const sendDesignToStripBtn = $("studioToStep3Btn");

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

  function saveStudioHistory() {
    if (!studioStage) return;
    const json = studioStage.toJSON();
    studioHistory = studioHistory.slice(0, studioHistoryIndex + 1);
    studioHistory.push(json);
    studioHistoryIndex = studioHistory.length - 1;
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

  function restoreStudioFromHistory(index) {
    if (!window.Konva || !studioHistory.length) return;
    if (index < 0 || index >= studioHistory.length) return;

    const container = (studioStage && studioStage.container()) || $("konvaStageContainer");
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

    if (layerOpacityInput) layerOpacityInput.value = studioSelectedNode.opacity?.() ?? 1;
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
      triggerDownload(dataURL, "lot-rocket-design.png");
    } catch (err) {
      console.error("Export PNG error:", err);
      alert("Export blocked (CORS). Use proxied images or uploads.");
    }
  }

  function applyStudioSizePreset() {
    if (!studioStage || !studioLayer || !studioSizePreset) return;
    const [w, h] = (studioSizePreset.value || "").split("x").map(Number);
    if (!w || !h) return;
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
    if (!studioStage) return alert("Open Design Studio first, then save.");
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
    if (!stored) return alert("No saved design found yet.");
    if (!window.Konva) return alert("Design Studio is not available (Konva missing).");
    const container = $("konvaStageContainer");
    if (!container) return alert("Design Studio area not found.");

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
    const container = $("konvaStageContainer");
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

    STORE.creativePhotos.forEach((u) => u && urls.add(u));
    STORE.socialReadyPhotos.forEach((p) => p?.url && urls.add(p.url));
    dealerPhotos.forEach((p) => p?.src && urls.add(p.src));

    return Array.from(urls).slice(0, MAX_PHOTOS);
  }

  function renderStudioPhotoTray() {
    if (!studioPhotoTray) return;
    studioPhotoTray.innerHTML = "";

    if (!studioAvailablePhotos?.length) {
      const msg = document.createElement("p");
      msg.className = "small-note";
      msg.textContent = "No photos yet. Boost a listing or add photos in Creative Lab.";
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

    const konvaContainer = $("konvaStageContainer");
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

    studioAvailablePhotos =
      Array.isArray(forceSources) && forceSources.length
        ? forceSources.slice(0, MAX_PHOTOS)
        : gatherImageUrlsForStudios();

    renderStudioPhotoTray();
  }

  function closeDesignStudio() {
    designStudioOverlay?.classList.add("hidden");
  }

  if (designLauncher && designLauncher.dataset.wired !== "true") {
    designLauncher.dataset.wired = "true";
    designLauncher.addEventListener("click", (e) => {
      e.preventDefault();
      openDesignStudio();
    });
  }

  if (designCloseBtn && designStudioOverlay && designCloseBtn.dataset.wired !== "true") {
    designCloseBtn.dataset.wired = "true";
    designCloseBtn.addEventListener("click", closeDesignStudio);

    if (designStudioOverlay.dataset.backdropWired !== "true") {
      designStudioOverlay.dataset.backdropWired = "true";
      designStudioOverlay.addEventListener("click", (e) => {
        if (e.target === designStudioOverlay) closeDesignStudio();
      });
    }
  }

  function pushUrlsIntoDesignStudio(urls) {
    const list = capMax(uniqueUrls((urls || []).filter(Boolean)), MAX_PHOTOS);
    if (!list.length) return alert("No photos available. Boost a listing or add photos first.");

    openDesignStudio(list);
    if (list[0]) addStudioImageFromUrl(list[0], true);
  }

  // Step 3 → send selected photos into Design Studio
  sendToDesignStudioBtn?.addEventListener("click", () => {
    let urls = [];

    const selectedThumbs = creativeThumbGrid?.querySelectorAll(".creative-thumb.selected") || [];
    if (selectedThumbs.length) selectedThumbs.forEach((img) => img?.src && urls.push(img.src));

    if (!urls.length) urls = STORE.creativePhotos.slice(0, MAX_PHOTOS);
    if (!urls.length) urls = dealerPhotos.map((p) => p.src).slice(0, MAX_PHOTOS);

    if (!urls.length) return alert("Load or select a photo first before sending to Design Studio.");
    pushUrlsIntoDesignStudio(urls);
  });

  // Social strip → open Design Studio
  openDesignFromCarouselBtn?.addEventListener("click", () => {
    normalizeSocialReady();
    if (!STORE.socialReadyPhotos.length) return alert("No social-ready photos yet.");

    const selected = STORE.socialReadyPhotos.filter((p) => p.selected).map((p) => p.url);
    const chosen = (selected.length ? selected : STORE.socialReadyPhotos.map((p) => p.url)).slice(0, MAX_PHOTOS);
    pushUrlsIntoDesignStudio(chosen);
  });

  // Social strip → open Canvas Studio (Fabric)
  openCanvasFromCarouselBtn?.addEventListener("click", () => {
    normalizeSocialReady();
    if (!STORE.socialReadyPhotos.length) return alert("No social-ready photos yet.");

    const selected = STORE.socialReadyPhotos.filter((p) => p.selected).map((p) => p.url);
    const urls = (selected.length ? selected : STORE.socialReadyPhotos.map((p) => p.url)).slice(0, MAX_PHOTOS);

    openCreativeStudio();
    urls.forEach((u) => addImageFromUrl(u));
  });

  // Design Studio → Send to Social Strip
  sendDesignToStripBtn?.addEventListener("click", async () => {
    if (!studioStage) return;

    let dataUrl;
    try {
      dataUrl = studioStage.toDataURL({ pixelRatio: 2 });
    } catch (e) {
      console.error("❌ Konva toDataURL failed:", e);
      alert("Design export failed (CORS). Try using proxied images or uploads.");
      return;
    }

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    addToSocialReady(objectUrl, true);

    STORE.creativePhotos = capMax(uniqueUrls([...STORE.creativePhotos, objectUrl]), MAX_PHOTOS);
    renderCreativeThumbs();
  });

  // ==================================================
  // FINAL INIT
  // ==================================================
  renderDealerPhotos();
  renderCreativeThumbs();
  renderSocialStrip();
});
