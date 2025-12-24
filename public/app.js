// ==================================================
// HARD KILL: prevent older cached app.js from running
// (PUT THIS AT VERY TOP OF public/app.js)
// ==================================================
(function () {
  // Only allow the newest build to execute.
  // If an older cached file loads, it will see the flag and exit instantly.
  if (window.__LOTROCKET_APPJS_VERSION__ && window.__LOTROCKET_APPJS_VERSION__ !== "999") {
    return;
  }
  window.__LOTROCKET_APPJS_VERSION__ = "999";
})();

// public/app.js — Lot Rocket (CLEAN SINGLE-PASS)
// One boot. One store. One wiring pass. No duplicate blocks.

document.addEventListener("DOMContentLoaded", () => {
  // ==================================================
  // BOOT GUARD + INSPECT
  // ==================================================
  if (window.__LOTROCKET_BOOTED__) {
    console.warn("🚫 Lot Rocket boot blocked (double init) — version:", window.__LOTROCKET_APPJS_VERSION__);
    return;
  }
  window.__LOTROCKET_BOOTED__ = true;
  console.log("✅ APP BOOT — version:", window.__LOTROCKET_APPJS_VERSION__);

  const DOC = document;
  const $ = (id) => DOC.getElementById(id);

  // ===============================
  // SAFE LOGGING (prevents crashes)
  // ===============================
  const log = (...a) => console.log(...a);
  const warn = (...a) => console.warn(...a);

  // ==================================================

// ==================================================
// SIDE TOOLS (FLOATING MODALS)
// ==================================================

function openSideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // show modal
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");

  // mark launcher active
  const launcher = document.querySelector(
    `.floating-tools [data-modal-target="${modalId}"]`
  );
  launcher?.classList.add("active");

  console.log("✅ OPEN MODAL:", modalId);
}

function closeSideModal(modalEl) {
  if (!modalEl) return;

  // ✅ MOVE FOCUS OUT BEFORE HIDING (fixes aria-hidden warning)
  if (modalEl.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  // hide modal
  modalEl.classList.add("hidden");
  modalEl.setAttribute("aria-hidden", "true");
  modalEl.classList.remove("open");

  // remove launcher active state
  const launcher = document.querySelector(
    `.floating-tools [data-modal-target="${modalEl.id}"]`
  );
  launcher?.classList.remove("active");

  console.log("✅ CLOSE MODAL:", modalEl.id);
}

function wireSideTools() {
  // ===============================
  // OPEN buttons (floating tools)
  // ===============================
  document
    .querySelectorAll(".floating-tools [data-modal-target]")
    .forEach((btn) => {
      if (btn.dataset.wired === "true") return;
      btn.dataset.wired = "true";

      const targetId = btn.getAttribute("data-modal-target");
      if (!targetId) return;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSideModal(targetId);
      });
    });

  // ===============================
  // CLOSE buttons (inside modals)
  // ===============================
  document
    .querySelectorAll(".side-modal [data-close], .side-modal .side-modal-close")
    .forEach((btn) => {
      if (btn.dataset.wired === "true") return;
      btn.dataset.wired = "true";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const modal = btn.closest(".side-modal");
        closeSideModal(modal);
      });
    });

  console.log("🧰 Side tools wired");
}
// ==================================================

// OBJECTION COACH — REAL HANDLER (frontend)
// ==================================================
window.handleObjectionCoach = async function (text) {
  const out = document.querySelector("#objectionOutput");
  if (out) out.textContent = "Thinking…";

  const res = await fetch("/api/objection-coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objection: text, history: "" }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message || data?.error || `Objection coach failed (HTTP ${res.status})`;
    if (out) out.textContent = "❌ " + msg;
    return;
  }

  // ✅ BACKEND RETURNS: { answer }
  const reply = (data?.answer || "").trim();
  if (out) out.textContent = reply || "✅ Coach response received (empty).";
  return reply;
};


function wireCalculatorPad() {
  const display = $("calcDisplay");
  const buttons = DOC.querySelectorAll("[data-calc]");
  if (!display || !buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.calc;

      if (v === "C") {
        display.value = "";
        return;
      }

      if (v === "=") {
        try {
          if (!/^[0-9+\-*/.() ]+$/.test(display.value)) throw new Error();
          display.value = Function(`"use strict";return (${display.value})`)();
        } catch {
          display.value = "Error";
        }
        return;
      }

      display.value += v;
    });
  });
}



  // ==================================================
  // CONSTANTS + SINGLE STORE
  // ==================================================
  const MAX_PHOTOS = 24;
  const apiBase = ""; // keep blank unless you need a different origin

  window.LOTROCKET = window.LOTROCKET || {};
  const STORE = window.LOTROCKET;

  STORE.step1Photos = Array.isArray(STORE.step1Photos) ? STORE.step1Photos : []; // [{url, selected}]
  STORE.lastBoostPhotos = Array.isArray(STORE.lastBoostPhotos) ? STORE.lastBoostPhotos : []; // [url]
  STORE.holdingZonePhotos = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : []; // [url]
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : []; // objects normalized
  STORE.creativePhotos = Array.isArray(STORE.creativePhotos) ? STORE.creativePhotos : []; // [url]
  STORE.activeHoldingPhoto = typeof STORE.activeHoldingPhoto === "string" ? STORE.activeHoldingPhoto : "";
  STORE.lastTitle = typeof STORE.lastTitle === "string" ? STORE.lastTitle : "";
  STORE.lastPrice = typeof STORE.lastPrice === "string" ? STORE.lastPrice : "";

  // ==================================================
  // ELEMENTS (READ ONCE)
  // ==================================================
  // Step 1 inputs
  const dealerUrlInput = $("dealerUrl") || $("vehicleUrl");
  const vehicleLabelInput = $("vehicleLabel");
  const priceInfoInput = $("priceInfo");

  // Step 1 summary
  const summaryLabel = $("summaryLabel") || $("vehicleTitle") || $("vehicleName");
  const summaryPrice = $("summaryPrice") || $("vehiclePrice");

// ===============================
// STEP 1 — BUTTONS / GRID (CLEAN)
// ===============================
const boostBtn =
  $("boostListingBtn") ||
  $("boostThisListingBtn") ||
  $("boostThisListing") ||
  $("boostButton");

const statusText = $("statusText");
const photosGridEl = $("photosGrid");

// Step 1 → Send Top Photos → Step 3
const sendTopBtn =
  $("sendTopPhotosToCreative") ||
  $("sendTopPhotosBtn");


  // Step 3 holding zone / tuner
const holdingZoneEl = $("creativeThumbGrid"); // ✅ HOLDING RENDERS IN LOWER BOX

  const tunerPreviewImg = $("tunerPreviewImg");
  const tunerBrightness = $("tunerBrightness");
  const tunerContrast = $("tunerContrast");
  const tunerSaturation = $("tunerSaturation");
  const autoEnhanceBtn = $("autoEnhanceBtn");
  const sendToSocialStripBtn = $("sendToSocialStripBtn");

// Creative thumbs (RED BOX GRID)
const creativeThumbGrid = $("creativeThumbGrid");

// Social strip (SINGLE SOURCE)
const socialReadyStrip = $("socialCarousel");

// Preview / status
const socialPreviewImg = $("socialCarouselPreviewImg");
const socialStatus = $("socialCarouselStatus");


  // ==================================================
  // UTILITIES (ONE SOURCE)
  // ==================================================
  function setBtnLoading(btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.dataset.originalText ||= btn.textContent;
      btn.textContent = label || "Working…";
      btn.disabled = true;
      btn.classList.add("btn-loading");
    } else {
      btn.disabled = false;
      btn.classList.remove("btn-loading");
      btn.textContent = btn.dataset.originalText || btn.textContent;
    }
  }

  function capMax(arr, max = MAX_PHOTOS) {
    return Array.isArray(arr) ? arr.slice(0, max) : [];
  }

  function uniqueUrls(urls) {
    const out = [];
    const seen = new Set();
    (urls || []).forEach((u) => {
      const s = String(u || "").trim();
      if (!s || seen.has(s)) return;
      seen.add(s);
      out.push(s);
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
  }

  function getProxiedImageUrl(rawUrl) {
    if (!rawUrl) return rawUrl;
    try {
      const u = new URL(rawUrl, window.location.origin);
      if (u.origin === window.location.origin) return rawUrl;
      if (u.protocol === "blob:" || u.protocol === "data:") return rawUrl;
      if (u.pathname.startsWith("/api/proxy-image")) return rawUrl;
      return `/api/proxy-image?url=${encodeURIComponent(u.toString())}`;
    } catch {
      return rawUrl;
    }
  }

  function setTA(el, v) {
    if (!el) return;
    el.value = v || "";
    // optional auto-resize if your CSS expects it
    try {
      el.style.height = "auto";
      el.style.height = (el.scrollHeight + 4) + "px";
    } catch {}
  }

  // ==================================================
  // STEP 1 — PHOTO GRID (SINGLE SOURCE)
  // ==================================================
  function setStep1FromUrls(urls) {
    const clean = capMax(uniqueUrls(urls || []), MAX_PHOTOS);
    STORE.step1Photos = clean.map((u) => ({ url: u, selected: false, dead: false }));
  }

  function renderStep1Photos(urls) {
    if (!photosGridEl) return;

    setStep1FromUrls(urls);

    photosGridEl.style.display = "grid";
    photosGridEl.style.gridTemplateColumns = "repeat(4, 1fr)";
    photosGridEl.style.gap = "8px";
    photosGridEl.style.marginTop = "10px";
    photosGridEl.innerHTML = "";

    (STORE.step1Photos || []).forEach((item, idx) => {
      const src = getProxiedImageUrl(item.url);

      const btn = DOC.createElement("button");
      btn.type = "button";
      btn.className = "photo-thumb-btn";
      btn.setAttribute("data-i", String(idx));
      btn.style.position = "relative";
      btn.style.height = "72px";
      btn.style.borderRadius = "12px";
      btn.style.overflow = "hidden";
      btn.style.border = "1px solid rgba(148,163,184,.55)";
      btn.style.background = "#0b1120";
      btn.style.padding = "0";
      btn.style.cursor = "pointer";
      btn.style.opacity = item.selected ? "1" : "0.45";

      const img = DOC.createElement("img");
      img.className = "photo-thumb-img";
      img.src = src;
      img.alt = "photo";
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.display = "block";
      img.style.objectFit = "cover";

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

    photosGridEl.onclick = (e) => {
      const btnEl = e.target?.closest?.("[data-i]");
      if (!btnEl) return;

      const idx = Number(btnEl.getAttribute("data-i"));
      const item = STORE.step1Photos[idx];
      if (!item || item.dead) return;

      item.selected = !item.selected;

      btnEl.style.opacity = item.selected ? "1" : "0.45";
      const check = btnEl.querySelector(".photo-check");
      if (check) check.style.display = item.selected ? "block" : "none";
      btnEl.classList.toggle("photo-thumb-selected", item.selected);
    };
  }

// ==================================================
// HOLDING ZONE (STEP 3 — TUNER SOURCE + SOCIAL SEND)
// ==================================================
function renderHoldingZone() {
  if (!holdingZoneEl) return;

  // ✅ Holding Zone is ONLY for tuner input
  // ❌ It must never visually act as Social-Ready strip
  holdingZoneEl.innerHTML = "";

  (STORE.holdingZonePhotos || []).forEach((url) => {
    const img = DOC.createElement("img");
    img.src = getProxiedImageUrl(url);
    img.className = "holding-thumb";
    img.loading = "lazy";
    img.title = "Click = preview • Double-click = send to Social-ready";

    // SINGLE CLICK = preview in tuner
    img.onclick = () => {
      STORE.activeHoldingPhoto = url;
      loadPhotoTuner(url);
    };

    // DOUBLE CLICK = send to Social-ready
    img.ondblclick = () => {
      addToSocialReady(url, true);
      // (renderSocialStrip is already called inside addToSocialReady in your current build,
      // but calling it again is safe)
      renderSocialStrip();
    };

    holdingZoneEl.appendChild(img);
  });
}
// ==================================================



// PHOTO TUNER
// ==================================================
function loadPhotoTuner(url) {
  if (!tunerPreviewImg || !url) return;
  STORE.activeHoldingPhoto = url;

  tunerPreviewImg.onload = () => log("✅ Photo Tuner loaded");
  tunerPreviewImg.onerror = () => warn("❌ Photo Tuner failed:", url);

  tunerPreviewImg.src = getProxiedImageUrl(url);
}

function applyTunerFilters() {
  if (!tunerPreviewImg) return;

  const b = Number(tunerBrightness?.value || 100) / 100;
  const c = Number(tunerContrast?.value || 100) / 100;
  const s = Number(tunerSaturation?.value || 100) / 100;

  tunerPreviewImg.style.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
}

function getActivePhotoUrl() {
  if (typeof STORE.activeHoldingPhoto === "string" && STORE.activeHoldingPhoto.trim()) {
    return STORE.activeHoldingPhoto;
  }
  if (tunerPreviewImg?.src) return tunerPreviewImg.src;
  return "";
}

// ==================================================
// AUTO ENHANCE
// ==================================================
if (autoEnhanceBtn && autoEnhanceBtn.dataset.wired !== "true") {
  autoEnhanceBtn.dataset.wired = "true";
  autoEnhanceBtn.onclick = () => {
    setBtnLoading(autoEnhanceBtn, true, "Enhancing…");
    if (tunerBrightness) tunerBrightness.value = 112;
    if (tunerContrast) tunerContrast.value = 112;
    if (tunerSaturation) tunerSaturation.value = 118;
    applyTunerFilters();
    setTimeout(() => setBtnLoading(autoEnhanceBtn, false), 200);
  };
}

tunerBrightness?.addEventListener("input", applyTunerFilters);
tunerContrast?.addEventListener("input", applyTunerFilters);
tunerSaturation?.addEventListener("input", applyTunerFilters);

// ==================================================

// SOCIAL READY STRIP (SINGLE SOURCE) — MAIN HTML TARGETS
// MUST RENDER ONLY INTO: #socialCarousel
// PREVIEW IMG: #socialCarouselPreviewImg
// ==================================================
function renderSocialStrip() {
  normalizeSocialReady();

  const stripEl = $("socialCarousel");
  const previewEl = $("socialCarouselPreviewImg");
  const statusEl = $("socialCarouselStatus");

  if (!stripEl) return;

  stripEl.innerHTML = "";

  const list = Array.isArray(STORE.socialReadyPhotos)
    ? STORE.socialReadyPhotos
    : [];

  list.forEach((item, idx) => {
    if (!item?.url) return;

    // wrapper button
    const btn = DOC.createElement("button");
    btn.type = "button";
    btn.className = "social-thumb-btn";

    // image
    const img = DOC.createElement("img");
    img.src = getProxiedImageUrl(item.url);
    img.className = "social-ready-thumb";
    img.loading = "lazy";
    img.style.opacity = item.selected ? "1" : "0.55";

    // lock badge
    const lock = DOC.createElement("div");
    lock.className = "social-lock";
    lock.textContent = item.locked ? "🔒" : "🔓";
    lock.title = item.locked
      ? "Locked (will download)"
      : "Unlocked (won’t download)";

    // click thumb = select preview
    btn.addEventListener("click", () => {
      STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p, i) => ({
        ...p,
        selected: i === idx,
      }));
      renderSocialStrip();
    });
// ==================================================
// DOWNLOAD SOCIAL-READY (LOCKED PHOTOS ONLY) ✅ CLEAN + SAFE
// (Put this in public/app.js AFTER: const DOC / const $ / STORE exists
// and BEFORE your FINAL INIT block.)
// ==================================================
const downloadSocialReadyBtn = $("downloadSocialReadyBtn");

if (downloadSocialReadyBtn && downloadSocialReadyBtn.dataset.wired !== "true") {
  downloadSocialReadyBtn.dataset.wired = "true";

  downloadSocialReadyBtn.addEventListener("click", async () => {
    normalizeSocialReady();

    const locked = (STORE.socialReadyPhotos || []).filter((p) => p && p.locked);

    if (!locked.length) {
      alert("Lock at least one photo to download.");
      return;
    }

    if (typeof window.JSZip !== "function") {
      alert("Download engine not ready (JSZip missing).");
      return;
    }

    const zip = new window.JSZip();
    const folder = zip.folder("LotRocket_SocialReady");

    for (let i = 0; i < locked.length; i++) {
      const url = locked[i].originalUrl || locked[i].url;
      if (!url) continue;

      try {
        // ✅ always fetch the proxied URL so CORS won't kill the zip
        const fetchUrl = getProxiedImageUrl(url);
        const res = await fetch(fetchUrl);
        const blob = await res.blob();

        // ✅ preserve file type if possible
        const ext = (blob.type && blob.type.includes("png")) ? "png" : "jpg";
        folder.file(`social_${String(i + 1).padStart(2, "0")}.${ext}`, blob);
      } catch (e) {
        console.warn("❌ Failed to fetch:", url, e);
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = "LotRocket_SocialReady.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
}
// ==================================================



// ==================================================
// SOCIAL READY STRIP (SINGLE SOURCE) — LOCK + PREVIEW + STATUS ✅ CLEAN
// NOTE: This block belongs INSIDE renderSocialStrip() where you build thumbs.
// ==================================================

// click lock = toggle lock
lock.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  normalizeSocialReady();

  const item = STORE.socialReadyPhotos[idx];
  if (!item) return;

  item.locked = !item.locked;

  renderSocialStrip();
});

btn.appendChild(img);
btn.appendChild(lock);
stripEl.appendChild(btn);

// ==================================================
// PREVIEW IMAGE + STATUS ✅ KEEP ONLY ONE SET (NO DUPLICATES)
// Put these INSIDE renderSocialStrip() AFTER the thumbs loop.
// ==================================================

// preview image (use selected or first)
const active = list.find((p) => p && p.selected) || list[0];
if (previewEl) {
  previewEl.src = active?.url ? getProxiedImageUrl(active.originalUrl || active.url) : "";
}

// status text
if (statusEl) {
  const lockedCount = list.filter((p) => p && p.locked).length;
  statusEl.textContent = list.length
    ? `Social-ready: ${list.length} • Locked: ${lockedCount}`
    : "No social-ready photos yet.";
}

// ==================================================
// ❌ DELETE THESE DUPLICATE BLOCKS IF THEY EXIST OUTSIDE renderSocialStrip()
// (They cause confusion + can overwrite correct preview/status)
// ==================================================

// preview logic (safe)  ❌ DELETE
// if (previewEl) {
//   const active = STORE.socialReadyPhotos.find((p) => p && p.selected);
//   previewEl.src = active?.url || "";
// }

// status (optional) ❌ DELETE
// if (statusEl) {
//   const total = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos.length : 0;
//   const selectedCount = Array.isArray(STORE.socialReadyPhotos)
//     ? STORE.socialReadyPhotos.filter((p) => p && p.selected).length
//     : 0;
//   statusEl.textContent = total
//     ? `Social-ready: ${total} • Selected: ${selectedCount}`
//     : "No social-ready photos yet.";
// }



// ==================================================
// SOCIAL READY HELPERS ✅ CLEAN (KEEP ONE COPY ONLY)
// ==================================================
function addToSocialReady(url, selected = true) {
  if (!url) return false;
  normalizeSocialReady();

  const existing = STORE.socialReadyPhotos.findIndex((p) => p && p.url === url);
  if (existing !== -1) {
    STORE.socialReadyPhotos[existing].selected = true;
    renderSocialStrip();
    return true;
  }

  STORE.socialReadyPhotos.unshift({
    url,
    originalUrl: url,
    selected: !!selected,
    locked: false,
  });

  STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(0, MAX_PHOTOS);

  renderSocialStrip();
  return true;
}

function pushToSocialReady(url) {
  if (!url) return false;
  normalizeSocialReady();

  const next = [{ url, originalUrl: url, selected: true, locked: false }]
    .concat((STORE.socialReadyPhotos || []).map((p) => ({ ...p, selected: false })))
    .filter((v, i, a) => a.findIndex((x) => x.url === v.url) === i)
    .slice(0, MAX_PHOTOS);

  STORE.socialReadyPhotos = next;
  renderSocialStrip();
  return true;
}

// Button: Send to Social-ready Strip ✅ CLEAN
if (sendToSocialStripBtn && sendToSocialStripBtn.dataset.wired !== "true") {
  sendToSocialStripBtn.dataset.wired = "true";
  sendToSocialStripBtn.onclick = () => {
    log("🚀 SEND TO STRIP CLICK");
    setBtnLoading(sendToSocialStripBtn, true, "Sending…");
    const ok = pushToSocialReady(getActivePhotoUrl());
    if (!ok) alert("No active photo selected.");
    setTimeout(() => setBtnLoading(sendToSocialStripBtn, false), 200);
  };
}
// ==================================================

// CREATIVE THUMBS (MINIMAL, STABLE)
// ==================================================
function renderCreativeThumbs() {
  // NOTE:
  // This function renders ONLY when STORE.creativePhotos has items.
  // Holding Zone is separate and should be populated by "Send Top Photos".
  // Creative Thumbs appear ONLY after user explicitly moves photos forward.

  if (!creativeThumbGrid) return;

  // 🚫 If nothing has been moved into Creative yet, keep this area empty
  if (!STORE.creativePhotos || !STORE.creativePhotos.length) {
    creativeThumbGrid.innerHTML = "";
    return;
  }

  creativeThumbGrid.innerHTML = "";

  STORE.creativePhotos = capMax(
    uniqueUrls(STORE.creativePhotos || []),
    MAX_PHOTOS
  );

  STORE.creativePhotos.forEach((url) => {
    const img = DOC.createElement("img");
    img.src = getProxiedImageUrl(url); // proxy prevents giant/CORS issues
    img.alt = "Creative photo";
    img.loading = "lazy";
    img.className = "creative-thumb";
    img.title = "Click = select • Double-click = send to Social Strip";

    img.addEventListener("click", () => {
      img.classList.toggle("selected");
      if (tunerPreviewImg) {
        loadPhotoTuner(url);   // keeps tuner-loaded message
        applyTunerFilters();
      }
    });

    img.addEventListener("dblclick", () => {
      addToSocialReady(url, true);
    });

    creativeThumbGrid.appendChild(img);
  });

  if (tunerPreviewImg && !tunerPreviewImg.src && STORE.creativePhotos.length) {
    loadPhotoTuner(STORE.creativePhotos[0]);
    applyTunerFilters();
  }
}
// ==================================================


// ==================================================
// STEP 1 → SEND TOP PHOTOS → STEP 3
// ==================================================
if (sendTopBtn && sendTopBtn.dataset.wired !== "true") {
  sendTopBtn.dataset.wired = "true";
  sendTopBtn.onclick = () => {
    const selected = (STORE.step1Photos || []).filter((p) => p.selected).map((p) => p.url);
    if (!selected.length) return alert("Select photos first.");

    // ✅ HOLDING ONLY
    STORE.holdingZonePhotos = selected.slice(0, MAX_PHOTOS);
    STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

    // ✅ CLEAR CREATIVE so you do NOT see a second row
    STORE.creativePhotos = [];
    renderCreativeThumbs();

    renderHoldingZone();
    if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);

    log("✅ Sent to Step 3 HOLDING ONLY:", STORE.holdingZonePhotos.length);
  };
}

// ==================================================
// BOOST (SINGLE IMPLEMENTATION) — CLEAN (NO CONSOLE 404 NOISE)
// ==================================================
if (boostBtn && boostBtn.dataset.wired !== "true") {
  boostBtn.dataset.wired = "true";

  // 🔒 helper lives OUTSIDE click, defined once
  async function postBoost(payload) {
    let res;

    // try modern backend FIRST
    try {
      res = await fetch(apiBase + "/api/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) return res;
    } catch (e) {}

    // fallback to legacy backend
    try {
      res = await fetch(apiBase + "/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) return res;
    } catch (e) {}

    throw new Error("Boost failed: backend route not found or unreachable.");
  }

  boostBtn.onclick = async () => {
    console.log("🚀 BOOST CLICK");

    const url = dealerUrlInput?.value?.trim?.() || "";
    if (!url) return alert("Enter vehicle URL");

    setBtnLoading(boostBtn, true, "Boosting…");
    if (statusText) statusText.textContent = "Boosting…";

    try {
      const res = await postBoost({
        url,
        labelOverride: vehicleLabelInput?.value?.trim?.() || "",
        priceOverride: priceInfoInput?.value?.trim?.() || "",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `Boost failed (HTTP ${res.status})`);
      }

      // Update summary fields
      const vLabel = data.vehicleLabel || data.title || "";
      const vPrice = data.priceInfo || data.price || "";

      if (summaryLabel) summaryLabel.textContent = vLabel || "—";
      if (summaryPrice) summaryPrice.textContent = vPrice || "—";

      if (vehicleLabelInput && !vehicleLabelInput.value) vehicleLabelInput.value = vLabel || "";
      if (priceInfoInput && !priceInfoInput.value) priceInfoInput.value = vPrice || "";

      // Photos (dedupe + cap)
      const rawPhotos = Array.isArray(data.photos) ? data.photos : [];

      const seen = new Set();
      const cleaned = [];

      for (const u of rawPhotos) {
        if (!u) continue;

        // normalize to kill CDN duplicates
        const base = u.split("?")[0].replace(/\/+$/, "");
        if (seen.has(base)) continue;

        seen.add(base);
        cleaned.push(u);

        if (cleaned.length >= MAX_PHOTOS) break;
      }

      STORE.lastBoostPhotos = cleaned;

      renderStep1Photos(STORE.lastBoostPhotos);

      if (statusText) {
        statusText.textContent = `Boost complete • Photos: ${STORE.lastBoostPhotos.length}`;
      }
    } catch (e) {
      console.error("✘ BOOST FAILED", e);
      if (statusText) statusText.textContent = "Boost failed.";
      alert(e?.message || "Boost failed.");
    } finally {
      setBtnLoading(boostBtn, false);
    }
  };
}
// ==================================================

// ROCKET-FB — AI MODALS UNIVERSAL WIRE (SAFE)
// - Stops form submit from closing modal
// - Stops inside clicks from bubbling to close handlers
// - Wires any button with [data-ai-action]
// ==================================================
function wireAiModals() {
  const modals = Array.from(DOC.querySelectorAll(".side-modal"));
  if (!modals.length) {
    console.warn("🟣 AI-WIRE: no .side-modal found");
    return;
  }

  modals.forEach((modal) => {
    if (modal.dataset.aiWired === "true") return;
    modal.dataset.aiWired = "true";

    // 1) Stop inside click bubbling (prevents accidental close)
    const inner =
      modal.querySelector(".side-modal-content") ||
      modal.querySelector(".modal-content") ||
      modal.firstElementChild;

    if (inner && inner.dataset.aiInnerWired !== "true") {
      inner.dataset.aiInnerWired = "true";
      inner.addEventListener("click", (e) => e.stopPropagation());
      inner.addEventListener("pointerdown", (e) => e.stopPropagation());
    }

    // 2) Block submit (prevents reload/close)
    const form = modal.querySelector("form");
    if (form && form.dataset.aiFormWired !== "true") {
      form.dataset.aiFormWired = "true";
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("🟣 AI-WIRE: submit blocked", modal.id || "(no id)");
      });
    }

    // 3) Wire action buttons
    const actionBtns = Array.from(modal.querySelectorAll("[data-ai-action]"));
    actionBtns.forEach((btn) => {
      if (btn.dataset.aiBtnWired === "true") return;
      btn.dataset.aiBtnWired = "true";
      btn.type = "button";

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const action = (btn.getAttribute("data-ai-action") || "").trim();
        const modalName = modal.id || modal.getAttribute("data-modal") || "side-modal";

        console.log("🟣 AI-WIRE: action click", { modal: modalName, action });

        // Find nearest input + output targets inside this modal
        const input =
          modal.querySelector("[data-ai-input]") ||
          modal.querySelector("textarea") ||
          modal.querySelector("input[type='text']");

        const output =
          modal.querySelector("[data-ai-output]") ||
          modal.querySelector(".ai-output") ||
          modal.querySelector(".tool-output") ||
          modal.querySelector("pre");

        const text = (input?.value || "").trim();

        // Optional: show loading state without CSS edits
        btn.dataset.originalText ||= btn.textContent;
        btn.textContent = "Working…";
        btn.disabled = true;
        if (output) output.textContent = "Thinking…";

        try {
          // ROUTER: call existing handlers if present (no refactor)
          // You can add more names here safely as your codebase evolves.
          const handlers = {
            objection_coach: window.coachMe || window.handleObjectionCoach,
            ask_ai: window.askAi || window.handleAskAi,
            drill_master: window.runDrillMaster || window.handleDrillMaster,
            message_builder: window.buildMessage || window.handleMessageBuilder,
            workflow_builder: window.buildWorkflow || window.handleWorkflowBuilder,
            car_expert: window.askCarExpert || window.handleCarExpert,
          };

          const fn = handlers[action];

          if (!text) {
            alert("Type your question/objection first.");
            return;
          }

          // ✅ If local handler exists, use it
          if (typeof fn === "function") {
            // If your handler returns text, we render it. If it handles UI itself, fine.
            const res = await fn(text, { modal, input, output, btn });
            if (typeof res === "string" && output) output.textContent = res;
          } else {
            // ✅ CONNECTED FALLBACK (CALL BACKEND)
            if (btn) {
              btn.dataset.originalText ||= btn.textContent;
              btn.textContent = "Thinking…";
              btn.disabled = true;
            }
            if (output) output.textContent = "Thinking…";

// route map (matches your backend paths)
const routeMap = {
              const cfg = routeMap[action];

            if (!cfg) {
              if (output) {
                output.textContent =
                  `✅ Received (${action}). No route mapped yet.\n` +
                  `Input: ${text}`;
              } else {
                alert(`Received (${action}). No route mapped yet.`);
              }
              throw new Error(`No backend route mapped for action: ${action}`);
            }

            const r = await fetch(cfg.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cfg.body),
            });

            const data = await r.json().catch(() => ({}));

            if (!r.ok) {
              const msg = data?.message || data?.error || `HTTP ${r.status}`;
              throw new Error(msg);
            }

            const reply =
              data?.answer ||
              data?.text ||
              data?.result ||
              data?.script ||
              data?.reply ||
              "";

            if (output) output.textContent = reply || "✅ Done (empty response).";

  // ✅ Objection Coach — dedicated endpoint + prompt
  objection_coach: {
    url: "/api/objection-coach",
    body: { objection: text, history: "" },
    pick: (data) => data?.answer
  },

  // ✅ Ask AI
  ask_ai: {
    url: "/api/message-helper",
    body: { mode: "ask", prompt: text },
    pick: (data) => data?.text
  },

  // ✅ Message Builder
  message_builder: {
    url: "/api/message-helper",
    body: { mode: "message", prompt: text },
    pick: (data) => data?.text
  },

  // ✅ Workflow Builder
  workflow_builder: {
    url: "/ai/workflow",
    body: {
      goal: "Set the Appointment",
      tone: "Persuasive, Low-Pressure, High-Value",
      channel: "Multi-Channel",
      days: 10,
      touches: 6
    },
    pick: (data) => data?.text
  },

  // ✅ Drill Master (temporary mapping)
  drill_master: {
    url: "/api/message-helper",
    body: { mode: "workflow", prompt: text },
    pick: (data) => data?.text
  },

  // ✅ Car Expert
  car_expert: {
    url: "/api/message-helper",
    body: { mode: "car", prompt: text },
    pick: (data) => data?.text
  },

  // ✅ Image AI
  image_ai: {
    url: "/api/message-helper",
    body: { mode: "image-brief", prompt: text },
    pick: (data) => data?.text
  },

  // ✅ Video AI
  video_ai: {
    url: "/api/message-helper",
    body: { mode: "video-brief", prompt: text },
    pick: (data) =>
      data?.script || data?.text || ""
  },

  // ⛔ Leave disabled until UI inputs exist
  payment_calc: null,
  income_calc: null,
};


            const cfg = routeMap[action];

            if (!cfg) {
              if (output) {
                output.textContent =
                  `✅ Received (${action}). No route mapped yet.\n` +
                  `Input: ${text}`;
              } else {
                alert(`Received (${action}). No route mapped yet.`);
              }
              throw new Error(`No backend route mapped for action: ${action}`);
            }

            const r = await fetch(cfg.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cfg.body),
            });

            const data = await r.json().catch(() => ({}));

            if (!r.ok) {
              const msg = data?.message || data?.error || `HTTP ${r.status}`;
              throw new Error(msg);
            }

            // normalize response -> text
            const reply =
              data?.answer ||
              data?.text ||
              data?.result ||
              data?.script ||
              data?.reply ||
              "";

            if (output) output.textContent = reply || "✅ Done (empty response).";
          }
        } catch (err) {
          console.error("🟣 AI-WIRE: action failed", err);
          if (output) output.textContent = `❌ Error: ${err?.message || err}`;
          else alert(err?.message || "Action failed");
        } finally {
          btn.disabled = false;
          btn.textContent = btn.dataset.originalText || "Run";
        }
      });
    });
  });

  console.log("🟣 AI-WIRE: complete (buttons require data-ai-action)");
}


// ==================================================
// FINAL INIT (SAFE) ✅ MUST BE LAST
// ==================================================
try {
  // restore Step 1 photos if present
  if (STORE.lastBoostPhotos?.length) {
    renderStep1Photos(STORE.lastBoostPhotos);
  }

  // restore Step 3 holding zone if present
  if (STORE.holdingZonePhotos?.length) {
    STORE.activeHoldingPhoto = STORE.activeHoldingPhoto || STORE.holdingZonePhotos[0] || "";
    renderHoldingZone();
    if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);
  }

  // render Step 3 thumbs + social strip
  renderCreativeThumbs();
  renderSocialStrip();

  // AI tools wiring (must run before side tools)
  if (typeof wireAiModals === "function") {
    wireAiModals();
  } else {
    console.warn("🟣 wireAiModals() not found");
  }

  // side tools wiring must be last
  if (typeof wireSideTools === "function") {
    wireSideTools();
  } else {
    console.warn("🧰 wireSideTools() not found");
  }

  console.log("✅ FINAL INIT COMPLETE");
} catch (e) {
  console.error("❌ FINAL INIT FAILED", e);
}

// ✅ CLOSES document.addEventListener("DOMContentLoaded", ... )
});



