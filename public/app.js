// public/app.js – Lot Rocket frontend logic v2.6 (CLEAN SINGLE-PASS)
// Goal: one boot, one store, one wiring pass, zero duplicate blocks, zero syntax landmines.

window.document.addEventListener("DOMContentLoaded", () => {
 console.log("🚀 JS FILE LOADED");
 console.log("STEP-2 REACHED");

  const DOC = window.document;
  const $ = (id) => DOC.getElementById(id);

  // ✅ BOOT GUARD
  if (window.__LOTROCKET_BOOTED__) {
    console.warn("🚫 Lot Rocket boot blocked (double init)");
    return;
  }
  window.__LOTROCKET_BOOTED__ = true;

  console.log("✅ Lot Rocket frontend loaded (v2.6 clean) BRANCH: test/clean-rewrite");
  const apiBase = "";

  // ==================================================
  // CORE CONSTANTS + SINGLE GLOBAL STORE
  // ==================================================
  const MAX_PHOTOS = 24;

  window.LOTROCKET = window.LOTROCKET || {};
  let STORE = window.LOTROCKET; // IMPORTANT: let (not const)

  // Normalize store buckets once
  STORE.creativePhotos = Array.isArray(STORE.creativePhotos) ? STORE.creativePhotos : []; // urls
  STORE.designStudioPhotos = Array.isArray(STORE.designStudioPhotos) ? STORE.designStudioPhotos : []; // urls
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : []; // objects

  // Stable summary fields (global reads must use STORE / DOM, never raw vars)
  STORE.lastTitle = STORE.lastTitle || "";
  STORE.lastPrice = STORE.lastPrice || "";

  // Social carousel index (must exist before normalizeSocialReady)
  let socialIndex = 0;

  // ==================================================
  // UTIL
  // ==================================================
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

  // ================================
  // POST JSON helper (REQUIRED)
  // ================================
  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error || data?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data;
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

      if (
        u.origin === window.location.origin ||
        u.protocol === "blob:" ||
        u.protocol === "data:"
      ) {
        return rawUrl;
      }

      // If already proxied, keep it
      if (u.pathname.startsWith("/api/proxy-image")) return rawUrl;

      return `/api/proxy-image?url=${encodeURIComponent(u.href)}`;
    } catch (e) {
      return rawUrl;
    }
  }

  function triggerDownload(url, filename) {
    if (!url) return;
    const a = DOC.createElement("a");
    a.href = url;
    a.download = filename || "lot-rocket.jpg";
    a.rel = "noopener";
    DOC.body.appendChild(a);
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

// ================================
// THEME TOGGLE (SINGLE SOURCE)
// ================================
const themeToggleInput = $("themeToggle");

function applyTheme(isDark) {
  DOC.body.classList.toggle("dark-theme", isDark);
  if (themeToggleInput) {
    themeToggleInput.checked = isDark; // ✅ correct direction
  }
}

// Start in dark mode by default
applyTheme(true);

// Wire toggle if it exists
if (themeToggleInput) {
  themeToggleInput.addEventListener("change", () => {
    applyTheme(themeToggleInput.checked);
  });
}







// Auto-grow ALL textareas (one-time)
DOC.querySelectorAll("textarea").forEach((ta) => {
  autoResizeTextarea(ta);
  ta.addEventListener("input", () => autoResizeTextarea(ta));
});

  // ==================================================
  // UNIVERSAL SIDE-MODAL SYSTEM (single source of truth)
  // ==================================================
  function openSideModalById(modalId) {
    if (!modalId) return;
    const modal = DOC.getElementById(modalId);
    if (!modal) return console.warn("⚠️ Modal not found:", modalId);

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    modal.dispatchEvent(new CustomEvent("lr:open", { detail: { modalId } }));
  }

  function closeSideModal(modal) {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    modal.dispatchEvent(new CustomEvent("lr:close", { detail: { modalId: modal.id } }));
  }

  // Click delegation for open + close
  DOC.addEventListener("click", (e) => {
    // OPEN
    const openBtn = e.target.closest("[data-modal-target]");
    if (openBtn) {
      const targetId = openBtn.getAttribute("data-modal-target");
      openSideModalById(targetId);
      return;
    }

    // CLOSE (button)
    const closeBtn = e.target.closest("[data-close]");
    if (closeBtn) {
      const modal = closeBtn.closest(".side-modal");
      closeSideModal(modal);
      return;
    }

    // CLOSE (backdrop click)
    const backdrop = e.target.classList.contains("side-modal") ? e.target : null;
    if (backdrop && !backdrop.classList.contains("hidden")) {
      closeSideModal(backdrop);
    }
  });

  // ESC closes topmost open modal
  DOC.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    const openModals = Array.from(DOC.querySelectorAll(".side-modal")).filter(
      (m) => !m.classList.contains("hidden")
    );

    const top = openModals[openModals.length - 1];
    if (top) closeSideModal(top);
  });

  // ==================================================
  // OBJECTION COACH (bind once, runs on submit)
  // ==================================================
  function wireObjectionCoach() {
    const modal = $("objectionModal");
    if (!modal || modal.dataset.wired === "true") return;
    modal.dataset.wired = "true";

    const form = $("objectionForm");
    const input = $("objectionInput");
    const output = $("objectionOutput");

    if (!form || !input || !output) {
      console.warn("[LotRocket] Objection Coach elements missing.");
      return;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const objection = (input.value || "").trim();
      if (!objection) return;

      output.textContent = "Thinking…";

      try {
        const res = await fetch(apiBase + "/api/objection-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objection }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Request failed");
        output.textContent = data.reply || "No response.";
      } catch (err) {
        console.error(err);
        output.textContent = "Error generating response.";
      }
    });

    modal.addEventListener("lr:open", () => setTimeout(() => input.focus?.(), 0));
  }

// ==================================================
// STEP 1 — BOOST + PHOTO GRID (SINGLE SOURCE, CLEAN v2.6)
// Fixes: duplicates + blanks, button feedback, stable selection state
// ==================================================
const dealerUrlInput = $("dealerUrl");
const vehicleLabelInput = $("vehicleLabel");
const priceOfferInput = $("priceOffer");

const boostBtn = $("boostListingBtn") || $("boostThisListing") || $("boostButton");

const sendTopBtn =
  $("sendTopPhotosBtn") ||
  $("sendPhotosToCreative") ||
  $("sendTopPhotosToCreative") ||
  $("sendTopPhotosToCreativeLab") ||
  $("sendPhotosToCreativeLab") ||
  $("sendTopPhotosToDesignStudio") ||
  $("sendPhotosToStudio") ||
  $("sendPhotosToDesignStudio");

const vehicleTitleEl = $("vehicleTitle") || $("vehicleName") || $("summaryVehicle");
const vehiclePriceEl = $("vehiclePrice") || $("summaryPrice");
const photosGridEl = $("photosGrid");

// Ensure canonical store fields exist once
STORE.step1Photos = Array.isArray(STORE.step1Photos) ? STORE.step1Photos : [];       // [{url, selected, dead}]
STORE.lastBoostPhotos = Array.isArray(STORE.lastBoostPhotos) ? STORE.lastBoostPhotos : []; // [url]

// ------- helpers -------
function normalizeUrl(u) {
  u = (typeof u === "string" ? u.trim() : "");
  if (!u) return "";

  // protocol-relative
  if (u.startsWith("//")) u = location.protocol + u;

  // drop obvious placeholders
  const bad = ["placeholder", "spacer", "blank", "1x1", "pixel", "transparent"];
  if (bad.some((k) => u.toLowerCase().includes(k))) return "";

  try {
    const url = new URL(u);

    // remove params that create duplicates (same image, different sizing/cache)
    ["w","width","h","height","q","quality","dpr","fit","crop","cb","cache","v","ver","version","sig"].forEach((p) =>
      url.searchParams.delete(p)
    );

    url.hash = "";
    return url.toString();
  } catch {
    return u;
  }
}

function dedupeKey(u) {
  u = normalizeUrl(u);
  if (!u) return "";

  // Less aggressive: key = origin + pathname (NO filename size stripping)
  // This stops collapsing different legitimate images into one.
  try {
    const url = new URL(u);
    return (url.origin + url.pathname).toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}


function uniqCleanCap(urls, cap) {
  const list = Array.isArray(urls) ? urls : [];
  const out = [];
  const seen = new Set();
  const lim = Number.isFinite(cap) ? cap : MAX_PHOTOS;

  for (const raw of list) {
    const u = normalizeUrl(raw);
    if (!u || u.length < 8) continue;

    const key = dedupeKey(u);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(u);
    if (out.length >= lim) break;
  }
  return out;
}


// ✅ BUTTON LOADING HELPER (single copy)
function setBtnLoading(btn, isLoading, label) {
  if (!btn) return;

  if (isLoading) {
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
    btn.textContent = label || "Working…";
    btn.classList.add("btn-loading");
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent;
    btn.classList.remove("btn-loading");
    btn.disabled = false;
  }
}

function setStep1FromUrls(urls) {
  const clean = uniqCleanCap(urls, MAX_PHOTOS);
  // preserve selection state when possible
  const prev = Array.isArray(STORE.step1Photos) ? STORE.step1Photos : [];
  const prevMap = new Map(prev.map((p) => [p?.url, !!p?.selected]));
  STORE.step1Photos = clean.map((u) => ({ url: u, selected: prevMap.get(u) || false, dead: false }));
}

function getSelectedStep1Urls(max) {
  const lim = Number.isFinite(max) ? max : MAX_PHOTOS;
  return (STORE.step1Photos || [])
    .filter((p) => p && !p.dead && p.selected && p.url)
    .map((p) => p.url)
    .slice(0, lim);
}

// Compatibility (other parts call this)
function getSelectedGridUrls() {
  return getSelectedStep1Urls(MAX_PHOTOS);
}

// -------- render --------
function renderStep1Photos(urls) {
  if (!photosGridEl) return;

  // Update store from urls
  setStep1FromUrls(urls);

  // Grid layout (prefer CSS; minimal inline only)
  photosGridEl.style.display = "grid";
  photosGridEl.style.gridTemplateColumns = "repeat(4, 1fr)";
  photosGridEl.style.gap = "8px";
  photosGridEl.innerHTML = "";

  (STORE.step1Photos || []).forEach((item, idx) => {
    const src = (typeof getProxiedImageUrl === "function") ? getProxiedImageUrl(item.url) : item.url;

    const btn = DOC.createElement("button");
    btn.type = "button";
    btn.className = "photo-thumb"; // keep your class for existing CSS
    btn.setAttribute("data-i", String(idx));
    btn.style.position = "relative";
    btn.style.height = "64px";
    btn.style.borderRadius = "12px";
    btn.style.overflow = "hidden";
    btn.style.border = "1px solid rgba(148,163,184,.55)";
    btn.style.background = "#0b1120";
    btn.style.padding = "0";
    btn.style.cursor = "pointer";
btn.style.opacity = "1";

    const img = DOC.createElement("img");
    img.src = src;
    img.alt = "photo";
    img.loading = "lazy";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.display = "block";
    img.style.objectFit = "cover";

    // kill blanks: mark dead + remove tile
img.onload = () => {
  // some dealer URLs return a tiny/blank image that still "loads"
  if (img.naturalWidth < 80 || img.naturalHeight < 80) {
    if (STORE.step1Photos[idx]) {
      STORE.step1Photos[idx].dead = true;
      STORE.step1Photos[idx].selected = false;
    }
    btn.remove();
  }
};


    // ✅ checkmark element MUST have class photo-check
    const check = DOC.createElement("span");
    check.className = "photo-check";
    check.textContent = "✓";
    check.style.position = "absolute";
    check.style.top = "6px";
    check.style.right = "6px";
    check.style.width = "18px";
    check.style.height = "18px";
    check.style.borderRadius = "999px";
    check.style.background = "rgba(0,0,0,.55)";
    check.style.color = "#fff";
    check.style.fontSize = "12px";
    check.style.lineHeight = "18px";
    check.style.textAlign = "center";
    check.style.display = item.selected ? "block" : "none";

    btn.appendChild(img);
    btn.appendChild(check);
    photosGridEl.appendChild(btn);
  });

  // ONE click handler, toggles store + visuals (bind once per render)
  photosGridEl.onclick = (e) => {
    const btnEl = e?.target?.closest ? e.target.closest("[data-i]") : null;
    if (!btnEl) return;

    const idx = Number(btnEl.getAttribute("data-i"));
    const item = STORE.step1Photos[idx];
    if (!item || item.dead) return;

    item.selected = !item.selected;

    // visuals
    btnEl.style.opacity = item.selected ? "1" : "0.45";
    const check = btnEl.querySelector(".photo-check");
    if (check) check.style.display = item.selected ? "block" : "none";
  };
}

// ------------------------------------
// Boost handler (canonical, single copy)
// ------------------------------------
async function boostListing() {
  const url = (dealerUrlInput?.value || "").trim();
  if (!url) return alert("Paste a dealer URL first.");

  setBtnLoading(boostBtn, true, "Boosting…");

  try {
    const payload = {
      url,
      labelOverride: (vehicleLabelInput?.value || "").trim(),
      priceOverride: (priceOfferInput?.value || "").trim(),
      maxPhotos: MAX_PHOTOS,
    };

    const data = await postJSON(`${apiBase}/api/boost`, payload);

    const title = data?.title || data?.vehicle || "";
    const price = data?.price || "";
    const photos = Array.isArray(data?.photos) ? data.photos : [];

    STORE.lastTitle = title;
    STORE.lastPrice = price;

    if (vehicleTitleEl) vehicleTitleEl.textContent = title || "—";
    if (vehiclePriceEl) vehiclePriceEl.textContent = price || "—";

    // ✅ Keep raw boosted photos in its own bucket (deduped + capped)
    STORE.lastBoostPhotos = uniqCleanCap(photos, MAX_PHOTOS);

    // ✅ Render Step 1 from raw boosted photos (selection starts off)
    renderStep1Photos(STORE.lastBoostPhotos);

    console.log("✅ Boost complete", { title, price, photos: STORE.lastBoostPhotos.length });
  } catch (e) {
    console.error("❌ Boost failed:", e);
    alert(e?.message || "Boost failed.");
  } finally {
    setBtnLoading(boostBtn, false);
  }
}

// Wire Boost click (bind once)
if (boostBtn && boostBtn.dataset.wired !== "true") {
  boostBtn.dataset.wired = "true";
  boostBtn.addEventListener("click", (e) => {
    e.preventDefault();
    boostListing();
  });
}

// ------------------------------------
// Send selected Step 1 → Creative + Social + Design (single copy)
// ------------------------------------
function sendSelectedToCreative() {
  setBtnLoading(sendTopBtn, true, "Sending…");

  try {
    const selected = getSelectedStep1Urls(MAX_PHOTOS);
    if (!selected.length) {
      alert("Select at least 1 photo first.");
      return;
    }

    // Prefer your global helpers if they exist; fallback to uniqCleanCap
    const capped = (typeof capMax === "function") ? capMax(selected, MAX_PHOTOS) : selected.slice(0, MAX_PHOTOS);
    const deduped = (typeof uniqueUrls === "function") ? uniqueUrls(capped) : uniqCleanCap(capped, MAX_PHOTOS);

    STORE.creativePhotos = deduped;
    STORE.socialReadyPhotos = deduped.map((u) => ({
      url: u,
      originalUrl: u,
      selected: true,
      locked: false,
    }));
    STORE.designStudioPhotos = deduped;

    if (typeof normalizeSocialReady === "function") normalizeSocialReady();
    if (typeof renderCreativeThumbs === "function") renderCreativeThumbs();
    if (typeof renderSocialStrip === "function") renderSocialStrip();
    if (typeof refreshDesignStudioStrip === "function") refreshDesignStudioStrip();

    console.log("✅ Sent to Step 3", { count: deduped.length });
  } catch (e) {
    console.error("❌ Send to Step 3 failed:", e);
    alert(e?.message || "Send failed.");
  } finally {
    setTimeout(() => setBtnLoading(sendTopBtn, false), 250);
  }
}

// Wire Send Top (bind once)
if (sendTopBtn && sendTopBtn.dataset.wired !== "true") {
  sendTopBtn.dataset.wired = "true";
  sendTopBtn.addEventListener("click", (e) => {
    e.preventDefault();
    sendSelectedToCreative();
  });
}


 // ===========================================

  // DRILL MODE – Q&A + GRADING (prefers /api/drill-grade)
  // ==================================================
  (() => {
    const drillLauncher = $("drillLauncher");
    const drillModal = $("drillModeModal");
    const closeDrillModeBtn = $("closeDrillMode");

    const drillObjectionText = $("drillObjectionText");
    const getDrillObjectionBtn = $("getDrillObjection");

    const drillReplyInput = $("drillReplyInput");
    const gradeDrillReplyBtn = $("gradeDrillReply");

    const drillResult = $("drillResult");
    const drillTimerDisplay = $("drillTimer");

    if (!drillModal) return;

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

    if (drillLauncher && drillLauncher.dataset.wired !== "true") {
      drillLauncher.dataset.wired = "true";
      drillLauncher.addEventListener("click", (e) => {
        e.preventDefault();
        resetDrillState();
      });
    }

    if (closeDrillModeBtn && closeDrillModeBtn.dataset.wired !== "true") {
      closeDrillModeBtn.dataset.wired = "true";
      closeDrillModeBtn.addEventListener("click", () => {
        stopDrillTimer();
        resetDrillState();
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
          rubric: {
            tone: "confident, friendly, professional",
            target: "set appointment or move to numbers",
          },
        };

        try {
          let res = await fetch(apiBase + "/api/drill-grade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            // fallback
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
  })();

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
    if (!full || typeof full !== "string")
      return { script: "", shots: "", aiPrompt: "", thumbPrompt: "" };

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
  const step1SendTopBtn = $("sendTopPhotosBtn");
  const photoDropZone = $("photoDropZone");
  const photoFileInput = $("photoFileInput");
  const creativeThumbGrid = $("creativeThumbGrid");
  const sendToDesignStudioBtn = $("sendToDesignStudio");

  const tunerPreviewImg = $("tunerPreviewImg");
  const tunerBrightness = $("tunerBrightness");
  const tunerContrast = $("tunerContrast");
  const tunerSaturation = $("tunerSaturation");
  const autoEnhanceBtn = $("autoEnhanceBtn");

  const hiddenTunerCanvas = DOC.createElement("canvas");
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

  // Step 1 -> Send Top Photos into Creative + Social Strip
  if (step1SendTopBtn && step1SendTopBtn.dataset.wired !== "true") {
    step1SendTopBtn.dataset.wired = "true";

    step1SendTopBtn.addEventListener("click", () => {
const selected = getSelectedStep1Urls(MAX_PHOTOS);
      if (!selected.length) {
        alert("Select at least 1 photo in the grid first.");
        return;
      }

      STORE.creativePhotos = capMax(uniqueUrls(selected), MAX_PHOTOS);
      STORE.designStudioPhotos = capMax(uniqueUrls(selected), MAX_PHOTOS);

      STORE.socialReadyPhotos = STORE.creativePhotos.map((u) => ({
        url: u,
        originalUrl: u,
        selected: true,
        locked: false,
      }));

      normalizeSocialReady();
      renderCreativeThumbs();
      renderSocialStrip();
      refreshDesignStudioStrip();

      step1SendTopBtn.classList.add("success");
      setTimeout(() => step1SendTopBtn.classList.remove("success"), 700);
    });
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

  function renderSocialStrip() {
    normalizeSocialReady();
    if (!socialCarousel) return;

    socialCarousel.innerHTML = "";

    STORE.socialReadyPhotos.forEach((photo, index) => {
      const item = DOC.createElement("button");
      item.type = "button";
      item.className =
        "social-carousel-item" +
        (index === socialIndex ? " selected" : "") +
        (photo.selected ? " picked" : "") +
        (photo.locked ? " locked" : "");
      item.title = "Click: select for actions • Double-click: remove";

      const img = DOC.createElement("img");
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
        socialStatus.textContent =
          "No social-ready photos yet. Double-click a Creative photo to add it.";
      } else {
        const selectedCount = STORE.socialReadyPhotos.filter((p) => p.selected).length;
        socialStatus.textContent =
          `Photo ${socialIndex + 1}/${STORE.socialReadyPhotos.length} • Selected: ${selectedCount}`;
      }
    }
  }

  socialPrevBtn?.addEventListener("click", () => {
    normalizeSocialReady();
    if (!STORE.socialReadyPhotos.length) return;
    socialIndex =
      (socialIndex - 1 + STORE.socialReadyPhotos.length) % STORE.socialReadyPhotos.length;
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
  // CREATIVE THUMB GRID (depends on social: addToSocialReady)
  // ==================================================
  function renderCreativeThumbs() {
    if (!creativeThumbGrid) return;
    creativeThumbGrid.innerHTML = "";

    STORE.creativePhotos = capMax(uniqueUrls(STORE.creativePhotos), MAX_PHOTOS);

    STORE.creativePhotos.forEach((url) => {
      const img = DOC.createElement("img");
      img.src = url;
      img.alt = "Creative photo";
      img.loading = "lazy";
      img.className = "creative-thumb";
      img.title = "Click: select • Double-click: send edited copy to Social Strip";

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

  // ==================================================
  // CANVAS STUDIO (Fabric)
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

  // Tool buttons (one-time)
  const creativeToolButtons = DOC.querySelectorAll(".tool-btn");
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
  // DESIGN STUDIO 3.5 (Konva)
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

      const li = DOC.createElement("li");
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
      const fitRatio =
        Math.min(studioStage.width() / img.width, studioStage.height() / img.height) || 1;
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
    (STORE.creativePhotos || []).forEach((u) => u && urls.add(u));
    (STORE.socialReadyPhotos || []).forEach((p) => p?.url && urls.add(p.url));
    return Array.from(urls).slice(0, MAX_PHOTOS);
  }

  function renderStudioPhotoTray() {
    if (!studioPhotoTray) return;
    studioPhotoTray.innerHTML = "";

    if (!Array.isArray(studioAvailablePhotos) || !studioAvailablePhotos.length) {
      const msg = DOC.createElement("p");
      msg.className = "small-note";
      msg.textContent = "No photos yet. Boost a listing or add photos in Creative Lab.";
      studioPhotoTray.appendChild(msg);
      return;
    }

    studioAvailablePhotos.forEach((url) => {
      const img = DOC.createElement("img");
      img.src = url;
      img.alt = "Design photo";
      img.loading = "lazy";
      img.className = "studio-photo-thumb";
      img.draggable = true;

      img.addEventListener("click", (e) => addStudioImageFromUrl(url, !!e.shiftKey));
      img.addEventListener("dblclick", () => addStudioImageFromUrl(url, true));

      img.addEventListener("dragstart", (e) => {
        try {
          e.dataTransfer.setData("text/plain", url);
        } catch {}
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
        try {
          url = e.dataTransfer.getData("text/plain");
        } catch {}
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

  // "Refresh" hook (used by other parts safely)
  function refreshDesignStudioStrip() {
    // This project uses the tray in Design Studio itself.
    // If you later add a Step-3 mini strip for Design Studio, wire it here.
    return;
  }

  // Step 3 → send selected photos into Design Studio
  if (sendToDesignStudioBtn && sendToDesignStudioBtn.dataset.wired !== "true") {
    sendToDesignStudioBtn.dataset.wired = "true";
    sendToDesignStudioBtn.addEventListener("click", () => {
      let urls = [];

      const selectedThumbs = creativeThumbGrid?.querySelectorAll(".creative-thumb.selected") || [];
      if (selectedThumbs.length) selectedThumbs.forEach((img) => img?.src && urls.push(img.src));

      if (!urls.length) urls = (STORE.creativePhotos || []).slice(0, MAX_PHOTOS);

      if (!urls.length) {
        alert("Load or select a photo first before sending to Design Studio.");
        return;
      }

      pushUrlsIntoDesignStudio(urls);
    });
  }

  // ==================================================
  // SOCIAL STRIP ↔ STUDIOS (Design / Fabric)
  // ==================================================
  if (openDesignFromCarouselBtn && openDesignFromCarouselBtn.dataset.wired !== "true") {
    openDesignFromCarouselBtn.dataset.wired = "true";
    openDesignFromCarouselBtn.addEventListener("click", () => {
      normalizeSocialReady();
      if (!STORE?.socialReadyPhotos?.length) return alert("No social-ready photos yet.");

      const selected = STORE.socialReadyPhotos
        .filter((p) => p?.selected)
        .map((p) => p?.url)
        .filter(Boolean);

      const chosen = (selected.length ? selected : STORE.socialReadyPhotos.map((p) => p?.url).filter(Boolean)).slice(
        0,
        MAX_PHOTOS
      );

      pushUrlsIntoDesignStudio(chosen);
    });
  }

  if (openCanvasFromCarouselBtn && openCanvasFromCarouselBtn.dataset.wired !== "true") {
    openCanvasFromCarouselBtn.dataset.wired = "true";
    openCanvasFromCarouselBtn.addEventListener("click", () => {
      normalizeSocialReady();
      if (!STORE?.socialReadyPhotos?.length) return alert("No social-ready photos yet.");

      const selected = STORE.socialReadyPhotos
        .filter((p) => p?.selected)
        .map((p) => p?.url)
        .filter(Boolean);

      const urls = (selected.length ? selected : STORE.socialReadyPhotos.map((p) => p?.url).filter(Boolean)).slice(
        0,
        MAX_PHOTOS
      );

      openCreativeStudio();
      urls.forEach((u) => addImageFromUrl(u));
    });
  }

  // Design Studio → Send to Social Strip
  if (sendDesignToStripBtn && sendDesignToStripBtn.dataset.wired !== "true") {
    sendDesignToStripBtn.dataset.wired = "true";
    sendDesignToStripBtn.addEventListener("click", async () => {
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

      STORE.creativePhotos = capMax(uniqueUrls([...(STORE.creativePhotos || []), objectUrl]), MAX_PHOTOS);
      renderCreativeThumbs();
      renderSocialStrip();
    });
  }
  // ==================================================
  // FINAL INIT (Safe boot) — SINGLE COPY ONLY
  // STRUCTURE ONLY: do not change logic here
  // ==================================================
  try {
    // If these functions exist in your file, they will run.
    // If not, remove only the missing call(s) AFTER syntax is stable.
    normalizeSocialReady();

    renderStep1Photos(STORE && STORE.creativePhotos ? STORE.creativePhotos : []);
    renderCreativeThumbs();
    renderSocialStrip();
    wireObjectionCoach();

    console.log("FINAL INIT REACHED");
  } catch (e) {
    console.log("Final init failed:", e);
  }

}); // closes DOMContentLoaded

