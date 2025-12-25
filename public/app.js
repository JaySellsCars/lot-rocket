// ==================================================
// HARD KILL: prevent older cached app.js from running
// (PUT THIS AT VERY TOP OF public/app.js)
// ==================================================
(function () {
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
  // SIDE TOOLS (FLOATING MODALS)
  // ==================================================

  function openSideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");

    const launcher = document.querySelector(`.floating-tools [data-modal-target="${modalId}"]`);
    launcher?.classList.add("active");

    console.log("✅ OPEN MODAL:", modalId);
  }

  function closeSideModal(modalEl) {
    if (!modalEl) return;

    // ✅ MOVE FOCUS OUT BEFORE HIDING (fixes aria-hidden warning)
    if (modalEl.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    modalEl.classList.add("hidden");
    modalEl.setAttribute("aria-hidden", "true");
    modalEl.classList.remove("open");

    const launcher = document.querySelector(`.floating-tools [data-modal-target="${modalEl.id}"]`);
    launcher?.classList.remove("active");

    console.log("✅ CLOSE MODAL:", modalEl.id);
  }

  function wireSideTools() {
    // OPEN buttons (floating tools)
    document.querySelectorAll(".floating-tools [data-modal-target]").forEach((btn) => {
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

    // CLOSE buttons (inside modals)
    document.querySelectorAll(".side-modal [data-close], .side-modal .side-modal-close").forEach((btn) => {
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
console.log("🧪 BOOST RESPONSE KEYS:", Object.keys(data || {}));
console.log("🧪 desc length:", (data?.description || data?.vehicleDescription || "").length);
console.log("🧪 posts count:", (Array.isArray(data?.posts) ? data.posts.length : 0));

    if (!res.ok) {
      const msg = data?.message || data?.error || `Objection coach failed (HTTP ${res.status})`;
      if (out) out.textContent = "❌ " + msg;
      return;
    }

    const reply = (data?.answer || "").trim();
    if (out) out.textContent = reply || "✅ Coach response received (empty).";
    return reply;
  };

  function wireCalculatorPad() {
    const display = $("calcDisplay");
    const buttons = DOC.querySelectorAll("[data-calc]");
    if (!display || !buttons.length) return;

    buttons.forEach((btn) => {
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
  const apiBase = "";

  window.LOTROCKET = window.LOTROCKET || {};
  const STORE = window.LOTROCKET;

  STORE.step1Photos = Array.isArray(STORE.step1Photos) ? STORE.step1Photos : [];
  STORE.lastBoostPhotos = Array.isArray(STORE.lastBoostPhotos) ? STORE.lastBoostPhotos : [];
  STORE.holdingZonePhotos = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
  STORE.creativePhotos = Array.isArray(STORE.creativePhotos) ? STORE.creativePhotos : [];
  STORE.activeHoldingPhoto = typeof STORE.activeHoldingPhoto === "string" ? STORE.activeHoldingPhoto : "";
  STORE.lastTitle = typeof STORE.lastTitle === "string" ? STORE.lastTitle : "";
  STORE.lastPrice = typeof STORE.lastPrice === "string" ? STORE.lastPrice : "";

  // ==================================================
  // ELEMENTS (READ ONCE)
  // ==================================================
  const dealerUrlInput = $("dealerUrl") || $("vehicleUrl");
  const vehicleLabelInput = $("vehicleLabel");
  const priceInfoInput = $("priceInfo");

  const summaryLabel = $("summaryLabel") || $("vehicleTitle") || $("vehicleName");
  const summaryPrice = $("summaryPrice") || $("vehiclePrice");

  const boostBtn = $("boostListingBtn") || $("boostThisListingBtn") || $("boostThisListing") || $("boostButton");
  console.log("🧪 boostBtn found:", !!boostBtn, boostBtn?.id || boostBtn);

  const statusText = $("statusText");
  const photosGridEl = $("photosGrid");

  const sendTopBtn = $("sendTopPhotosToCreative") || $("sendTopPhotosBtn");

  // Step 3 holding zone / tuner
  const holdingZoneEl = $("creativeThumbGrid"); // holding renders here in your current layout
  const tunerPreviewImg = $("tunerPreviewImg");
  const tunerBrightness = $("tunerBrightness");
  const tunerContrast = $("tunerContrast");
  const tunerSaturation = $("tunerSaturation");
  const autoEnhanceBtn = $("autoEnhanceBtn");
  const sendToSocialStripBtn = $("sendToSocialStripBtn");

  // Creative thumbs (same grid id used in your layout)
  const creativeThumbGrid = $("creativeThumbGrid");

  // Social strip
  const socialReadyStrip = $("socialCarousel");
  const socialPreviewImg = $("socialCarouselPreviewImg");
  const socialStatus = $("socialCarouselStatus");

  // Download
  const downloadSocialReadyBtn = $("downloadSocialReadyBtn");

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
          : { ...p }
      )
      .filter((p) => p && p.url);

    if (STORE.socialReadyPhotos.length > MAX_PHOTOS) {
      STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(-MAX_PHOTOS);
    }

    // ensure selected exists
    if (STORE.socialReadyPhotos.length && !STORE.socialReadyPhotos.some((p) => p.selected)) {
      STORE.socialReadyPhotos[0].selected = true;
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

    holdingZoneEl.innerHTML = "";

    (STORE.holdingZonePhotos || []).forEach((url) => {
      const img = DOC.createElement("img");
      img.src = getProxiedImageUrl(url);
      img.className = "holding-thumb";
      img.loading = "lazy";
      img.title = "Click = preview • Double-click = send to Social-ready";

      img.onclick = () => {
        STORE.activeHoldingPhoto = url;
        loadPhotoTuner(url);
      };

      img.ondblclick = () => {
        addToSocialReady(url, true);
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
  // SOCIAL READY HELPERS ✅ KEEP ONE COPY ONLY
  // ==================================================
  function setSocialSelectedIndex(nextIdx) {
    normalizeSocialReady();
    const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
    if (!list.length) return;

    const idx = ((nextIdx % list.length) + list.length) % list.length; // wrap
    STORE.socialReadyPhotos = list.map((p, i) => ({ ...p, selected: i === idx }));
  }

  function addToSocialReady(url, selected = true) {
    if (!url) return false;
    normalizeSocialReady();

    // deselect all
    STORE.socialReadyPhotos = (STORE.socialReadyPhotos || []).map((p) => ({ ...p, selected: false }));

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

  // ==================================================
  // SOCIAL READY STRIP (SINGLE SOURCE) — LOCK + PREVIEW + STATUS
  // MUST RENDER ONLY INTO: #socialCarousel
  // PREVIEW IMG: #socialCarouselPreviewImg
  // ==================================================
  function renderSocialStrip() {
    normalizeSocialReady();

    const stripEl = $("socialCarousel");
    const previewEl = $("socialCarouselPreviewImg");
    const statusEl = $("socialCarouselStatus");

    const prevBtn =
      $("socialCarouselPrev") ||
      $("socialPrevBtn") ||
      DOC.querySelector("[data-social-prev]") ||
      DOC.querySelector(".social-carousel-prev");

    const nextBtn =
      $("socialCarouselNext") ||
      $("socialNextBtn") ||
      DOC.querySelector("[data-social-next]") ||
      DOC.querySelector(".social-carousel-next");

    if (!stripEl) return;

    const listNow = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
    const curIdx = Math.max(0, listNow.findIndex((p) => p && p.selected));

    if (prevBtn && prevBtn.dataset.wired !== "true") {
      prevBtn.dataset.wired = "true";
      prevBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
        if (!list.length) return;

        const cur = Math.max(0, list.findIndex((p) => p && p.selected));
        setSocialSelectedIndex(cur - 1);

        renderSocialStrip();
      });
    }

    if (nextBtn && nextBtn.dataset.wired !== "true") {
      nextBtn.dataset.wired = "true";
      nextBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
        if (!list.length) return;

        const cur = Math.max(0, list.findIndex((p) => p && p.selected));
        setSocialSelectedIndex(cur + 1);

        renderSocialStrip();
      });
    }

    stripEl.innerHTML = "";

    const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];

    list.forEach((item, idx) => {
      if (!item?.url) return;

      const btn = DOC.createElement("button");
      btn.type = "button";
      btn.className = "social-thumb-btn";

      const img = DOC.createElement("img");
      img.src = getProxiedImageUrl(item.originalUrl || item.url);
      img.className = "social-ready-thumb";
      img.loading = "lazy";
      img.style.opacity = item.selected ? "1" : "0.55";

      const lock = DOC.createElement("div");
      lock.className = "social-lock";
      lock.textContent = item.locked ? "🔒" : "🔓";
      lock.title = item.locked ? "Locked (will download)" : "Unlocked (won’t download)";

      btn.addEventListener("click", () => {
        STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p, i) => ({
          ...p,
          selected: i === idx,
        }));
        renderSocialStrip();
      });

      lock.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        normalizeSocialReady();
        const it = STORE.socialReadyPhotos[idx];
        if (!it) return;
        it.locked = !it.locked;
        renderSocialStrip();
      });

      btn.appendChild(img);
      btn.appendChild(lock);
      stripEl.appendChild(btn);
    });

    const active = list.find((p) => p && p.selected) || list[0];
    if (previewEl) {
      previewEl.src = active?.url ? getProxiedImageUrl(active.originalUrl || active.url) : "";
    }

    if (statusEl) {
      const lockedCount = list.filter((p) => p && p.locked).length;
      statusEl.textContent = list.length
        ? `Social-ready: ${list.length} • Locked: ${lockedCount}`
        : "No social-ready photos yet.";
    }
  }

  // ==================================================
  // DOWNLOAD SOCIAL-READY (LOCKED PHOTOS ONLY) ✅ CLEAN + SAFE
  // ==================================================
  if (downloadSocialReadyBtn && downloadSocialReadyBtn.dataset.wired !== "true") {
    downloadSocialReadyBtn.dataset.wired = "true";

    downloadSocialReadyBtn.addEventListener("click", async () => {
      normalizeSocialReady();

      const locked = (STORE.socialReadyPhotos || []).filter((p) => p && p.locked && (p.originalUrl || p.url));

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
          const fetchUrl = getProxiedImageUrl(url);
          const res = await fetch(fetchUrl);
          const blob = await res.blob();

          const ext = blob.type && blob.type.includes("png") ? "png" : "jpg";
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
    if (!creativeThumbGrid) return;

    if (!STORE.creativePhotos || !STORE.creativePhotos.length) {
      creativeThumbGrid.innerHTML = "";
      return;
    }

    creativeThumbGrid.innerHTML = "";

    STORE.creativePhotos = capMax(uniqueUrls(STORE.creativePhotos || []), MAX_PHOTOS);

    STORE.creativePhotos.forEach((url) => {
      const img = DOC.createElement("img");
      img.src = getProxiedImageUrl(url);
      img.alt = "Creative photo";
      img.loading = "lazy";
      img.className = "creative-thumb";
      img.title = "Click = select • Double-click = send to Social Strip";

      img.addEventListener("click", () => {
        img.classList.toggle("selected");
        if (tunerPreviewImg) {
          loadPhotoTuner(url);
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
// STEP 1 → SEND TOP PHOTOS → STEP 3
// ==================================================
if (sendTopBtn && sendTopBtn.dataset.wired !== "true") {
  sendTopBtn.dataset.wired = "true";
  sendTopBtn.onclick = () => {
    const selected = (STORE.step1Photos || []).filter((p) => p.selected).map((p) => p.url);
    if (!selected.length) return alert("Select photos first.");

    STORE.holdingZonePhotos = selected.slice(0, MAX_PHOTOS);
    STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

    STORE.creativePhotos = [];
    renderCreativeThumbs();

    renderHoldingZone();
    if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);

    log("✅ Sent to Step 3 HOLDING ONLY:", STORE.holdingZonePhotos.length);
  };
}

// ==================================================
// BOOST (SINGLE IMPLEMENTATION) — CLEAN
// ==================================================
if (boostBtn && boostBtn.dataset.wired !== "true") {
  boostBtn.dataset.wired = "true";
console.log("🧪 postBoost apiBase:", apiBase);
console.log("🧪 trying:", apiBase + "/api/boost");

  async function postBoost(payload) {
    let res;

    try {
      res = await fetch(apiBase + "/api/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) return res;
    } catch {}

    try {
      res = await fetch(apiBase + "/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) return res;
    } catch {}

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

      console.log("🧪 BOOST RESPONSE KEYS:", Object.keys(data || {}));
      console.log("🧪 desc length:", (data?.description || data?.vehicleDescription || "").length);
      console.log("🧪 posts count:", Array.isArray(data?.posts) ? data.posts.length : 0);

      if (!res.ok) throw new Error(data?.message || `Boost failed (HTTP ${res.status})`);

      const vLabel = data.vehicleLabel || data.title || "";
      const vPrice = data.priceInfo || data.price || "";

      if (summaryLabel) summaryLabel.textContent = vLabel || "—";
      if (summaryPrice) summaryPrice.textContent = vPrice || "—";

      if (vehicleLabelInput && !vehicleLabelInput.value) vehicleLabelInput.value = vLabel || "";
      if (priceInfoInput && !priceInfoInput.value) priceInfoInput.value = vPrice || "";

      const rawPhotos = Array.isArray(data.photos) ? data.photos : [];
      const seen = new Set();
      const cleaned = [];

      for (const u of rawPhotos) {
        if (!u) continue;
        const base = u.split("?")[0].replace(/\/+$/, "");
        if (seen.has(base)) continue;
        seen.add(base);
        cleaned.push(u);
        if (cleaned.length >= MAX_PHOTOS) break;
      }

      STORE.lastBoostPhotos = cleaned;
      renderStep1Photos(STORE.lastBoostPhotos);

      const desc = data.description || data.vehicleDescription || data.desc || "";
      const posts = data.posts || data.socialPosts || data.captions || [];

      STORE.lastBoostDescription = String(desc || "");
      STORE.lastBoostPosts = Array.isArray(posts) ? posts : [];

      renderBoostTextAndPosts(STORE.lastBoostDescription, STORE.lastBoostPosts);

      if (statusText) statusText.textContent = `Boost complete • Photos: ${STORE.lastBoostPhotos.length}`;
    } catch (e) {
      console.error("✘ BOOST FAILED", e);
      if (statusText) statusText.textContent = "Boost failed.";
      alert(e?.message || "Boost failed.");
    } finally {
      setBtnLoading(boostBtn, false);
    }
  };
}

// BOOST OUTPUT RENDER (description + generated posts)
// Safe: renders only if containers exist
// ==================================================
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePosts(posts) {
  if (!Array.isArray(posts)) return [];
  return posts
    .map((p) => (typeof p === "string" ? p : (p && typeof p.text === "string" ? p.text : "")))
    .map((t) => String(t || "").trim())
    .filter(Boolean);
}

function renderBoostTextAndPosts(description, posts) {
  const desc =
    DOC.getElementById("boostDescription") ||
    DOC.getElementById("vehicleDescription") ||
    DOC.getElementById("descriptionOutput") ||
    DOC.querySelector("[data-boost-description]");

  const postsWrap =
    DOC.getElementById("boostPosts") ||
    DOC.getElementById("boostOutput") ||
    DOC.getElementById("socialPostsOutput") ||
    DOC.querySelector("[data-boost-posts]");

  // Description (optional)
  if (desc) {
    const d = String(description || "").trim();
    desc.innerHTML = d ? `<pre class="boost-desc">${escapeHtml(d)}</pre>` : `<div class="muted">No description found.</div>`;
  }

  // Posts (optional)
  if (postsWrap) {
    const list = normalizePosts(posts);

    if (!list.length) {
      postsWrap.innerHTML = `<div class="muted">No social posts generated.</div>`;
      return;
    }

    postsWrap.innerHTML = list
      .map((text, i) => {
        const encoded = encodeURIComponent(text);
        return `
          <div class="boost-post-card">
            <div class="boost-post-header">Post ${i + 1}</div>
            <pre class="boost-post-text">${escapeHtml(text)}</pre>
            <button type="button" class="secondary-btn copy-post-btn" data-copy="${encoded}">Copy</button>
          </div>
        `;
      })
      .join("");

    postsWrap.querySelectorAll(".copy-post-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const txt = decodeURIComponent(btn.dataset.copy || "");
        try {
          await navigator.clipboard.writeText(txt);
          const old = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(() => (btn.textContent = old), 900);
        } catch {
          alert("Copy failed");
        }
      });
    });
  }
}

  // ==================================================
  // ROCKET-FB — AI MODALS UNIVERSAL WIRE (SAFE)
  // ==================================================
  function wireAiModals() {
    const modals = Array.from(DOC.querySelectorAll(".side-modal"));
    if (!modals.length) {
      console.warn("🟣 AI-WIRE: no .side-modal found");
      return;
    }

    const num = (v) => {
      if (v == null) return 0;
      const s = String(v).replace(/[^\d.-]/g, "");
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    const pick = (root, selectors) => {
      for (const sel of selectors) {
        const el = root.querySelector(sel);
        if (el) return el;
      }
      return null;
    };


const collectPaymentBody = (modal) => {
  // local pick helper (scoped)
  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = modal.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  const num = (v) => {
    if (v == null) return 0;
    const s = String(v).replace(/[^\d.-]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const priceEl  = pick(["#payPrice",  "input[name='price']",  "#price"]);
  const downEl   = pick(["#payDown",   "input[name='down']",   "#down"]);
  const tradeEl  = pick(["#payTrade",  "input[name='trade']",  "#trade"]);
  const payoffEl = pick(["#payPayoff", "input[name='payoff']", "#payoff"]);

  const aprEl = pick(["#payApr", "input[name='apr']", "input[name='rate']", "#apr", "#rate"]);
  const termEl = pick(["#payTerm", "input[name='term']", "#term"]);
  const taxEl  = pick(["#payTax",  "input[name='tax']",  "#tax"]);

  const feesEl = pick(["#payFees", "#dealerFees", "input[name='fees']", "input[name='dealerFees']", "#fees"]);

  // ✅ NEW: State + Rebate
  const stateEl = pick(["#payState", "select[name='state']", "input[name='state']"]);
  const rebateEl = pick(["#payRebate", "input[name='rebate']", "#rebate"]);

  return {
    price: num(priceEl?.value),
    down: num(downEl?.value),
    trade: num(tradeEl?.value),
    payoff: num(payoffEl?.value),

    rate: num(aprEl?.value),   // APR %
    term: num(termEl?.value),  // months
    tax: num(taxEl?.value),    // tax %

    fees: num(feesEl?.value),      // dealer fees / add-ons
    state: (stateEl?.value || "").trim().toUpperCase(), // "MI", "OH", etc
    rebate: num(rebateEl?.value),  // optional
  };
};
// ==================================================
// INCOME CALC — HARD WIRE (GUARANTEED CLICK)
// Put inside DOMContentLoaded (public/app.js)
// ==================================================
(function wireIncomeCalcDirect() {
  const modal = document.getElementById("incomeModal");
  if (!modal) return;

  const btn =
    modal.querySelector("#incomeCalcBtn") ||
    modal.querySelector("[data-ai-action='income_calc']");

  const out =
    modal.querySelector("#incomeOutput") ||
    modal.querySelector("[data-ai-output]");

  if (!btn) {
    console.warn("🟠 income calc: button not found");
    return;
  }

  if (btn.dataset.wiredDirect === "true") return;
  btn.dataset.wiredDirect = "true";

  const num = (v) => {
    if (v == null) return 0;
    const s = String(v).replace(/[^\d.-]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("🟢 INCOME DIRECT CLICK");

    const mtdEl = modal.querySelector("#incomeMtd");
    const dateEl = modal.querySelector("#incomeLastPayDate");

    const body = {
      mtd: num(mtdEl?.value),
      lastPayDate: (dateEl?.value || "").trim(),
    };

    if (out) out.textContent = "Thinking…";

    try {
      const r = await fetch("/api/income-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        const msg = data?.message || data?.error || `HTTP ${r.status}`;
        throw new Error(msg);
      }

      const reply = data?.result || data?.text || data?.answer || "✅ Done (empty response).";
      if (out) out.textContent = reply;

      console.log("🟢 INCOME DIRECT OK", data);
    } catch (err) {
      console.error("🔴 INCOME DIRECT FAIL", err);
      if (out) out.textContent = `❌ Error: ${err?.message || err}`;
      else alert(err?.message || "Income calc failed");
    }
  });

  console.log("✅ income calc: direct wire complete");
})();





    const collectIncomeBody = (modal) => {
      const mtdEl = pick(modal, ["#incomeMtd", "input[name='mtd']", "#mtd"]);
      const dateEl = pick(modal, ["#incomeLastPayDate", "input[name='lastPayDate']", "#lastPayDate", "input[type='date']"]);

      return {
        mtd: num(mtdEl?.value),
        lastPayDate: (dateEl?.value || "").trim(),
      };
    };

    modals.forEach((modal) => {
      if (modal.dataset.aiWired === "true") return;
      modal.dataset.aiWired = "true";

      const inner =
        modal.querySelector(".side-modal-content") ||
        modal.querySelector(".modal-content") ||
        modal.firstElementChild;

      if (inner && inner.dataset.aiInnerWired !== "true") {
        inner.dataset.aiInnerWired = "true";
        inner.addEventListener("click", (e) => e.stopPropagation());
        inner.addEventListener("pointerdown", (e) => e.stopPropagation());
      }

      const form = modal.querySelector("form");
      if (form && form.dataset.aiFormWired !== "true") {
        form.dataset.aiFormWired = "true";
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("🟣 AI-WIRE: submit blocked", modal.id || "(no id)");
        });
      }

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

          const input =
            modal.querySelector("[data-ai-input]") ||
            modal.querySelector("textarea") ||
            modal.querySelector("input[type='text']");

          const output =
            modal.querySelector("[data-ai-output]") ||
            modal.querySelector(".ai-output") ||
            modal.querySelector(".tool-output") ||
            modal.querySelector("pre") ||
            modal.querySelector("div[id$='Output']");

          const text = (input?.value || "").trim();

          btn.dataset.originalText ||= btn.textContent;
          btn.textContent = "Working…";
          btn.disabled = true;
          if (output) output.textContent = "Thinking…";

          try {
            const handlers = {
              objection_coach: window.coachMe || window.handleObjectionCoach,
              ask_ai: window.askAi || window.handleAskAi,
              drill_master: window.runDrillMaster || window.handleDrillMaster,
              message_builder: window.buildMessage || window.handleMessageBuilder,
              workflow_builder: window.buildWorkflow || window.handleWorkflowBuilder,
              car_expert: window.askCarExpert || window.handleCarExpert,
            };

            const fn = handlers[action];

            const noTextRequired = new Set(["payment_calc", "income_calc"]);
            if (!noTextRequired.has(action) && !text) {
              alert("Type your question/objection first.");
              return;
            }

            if (typeof fn === "function") {
              const res = await fn(text, { modal, input, output, btn });
              if (typeof res === "string" && output) output.textContent = res;
            } else {
 const routeMap = {
                objection_coach: {
                  url: "/api/objection-coach",
                  body: { objection: text, history: "" },
                  pick: (data) => data?.answer || data?.text || "",
                },
                ask_ai: {
                  url: "/api/message-helper",
                  body: { mode: "ask", prompt: text },
                  pick: (data) => data?.text || data?.answer || "",
                },
                message_builder: {
                  url: "/api/message-helper",
                  body: { mode: "message", prompt: text },
                  pick: (data) => data?.text || data?.answer || "",
                },
                workflow_builder: {
                  url: "/ai/workflow",
                  body: {
                    goal: "Set the Appointment",
                    tone: "Persuasive, Low-Pressure, High-Value",
                    channel: "Multi-Channel",
                    days: 10,
                    touches: 6,
                  },
                  pick: (data) => data?.text || "",
                },
                drill_master: {
                  url: "/api/message-helper",
                  body: { mode: "workflow", prompt: text },
                  pick: (data) => data?.text || "",
                },
                car_expert: {
                  url: "/api/message-helper",
                  body: { mode: "car", prompt: text },
                  pick: (data) => data?.text || "",
                },
                image_ai: {
                  url: "/api/message-helper",
                  body: { mode: "image-brief", prompt: text },
                  pick: (data) => data?.text || "",
                },
                video_ai: {
                  url: "/api/message-helper",
                  body: { mode: "video-brief", prompt: text },
                  pick: (data) => data?.text || "",
                },

                // ✅ CALCULATORS (no text required)
payment_calc: {
  url: "/api/payment-helper",

  // collectPaymentBody(modal) MUST return:
  // { price, down, trade, payoff, rate, term, tax, fees, state, rebate }
  body: collectPaymentBody(modal),

  pick: (data) => {
    // ✅ Preferred: backend already formatted everything
    if (data?.breakdownText) return data.breakdownText;

    // ✅ Fallback: structured breakdown
    const b = data?.breakdown;
    if (!b) return data?.result || data?.text || data?.answer || "";

    const money = (n) =>
      `$${Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    const pct = (n) => `${Number(n || 0).toFixed(2)}%`;

    const equityLine =
      b.tradeEquity >= 0
        ? `+${money(b.tradeEquity)} (positive equity)`
        : `${money(b.tradeEquity)} (negative equity)`;

    return [
      `~${money(b.amountFinanced * 0 + 0)}`, // payment already in breakdownText normally
      "",
      "Breakdown:",
      `• State: ${b.state || "N/A"}`,
      `• Price: ${money(b.price)}`,
      `• Dealer Fees/Add-ons: ${money(b.fees)}`,
      `• Taxable Base: ${money(b.taxableBase)}`,
      `• Tax (${pct(b.taxRate)}): ${money(b.taxAmount)}`,
      `• Rebate: ${money(b.rebate)}`,
      `• Down: ${money(b.down)}`,
      `• Trade: ${money(b.trade)} | Payoff: ${money(b.payoff)}`,
      `• Trade Equity: ${equityLine}`,
      `• Amount Financed: ${money(b.amountFinanced)}`,
      `• APR: ${pct(b.aprPct)} | Term: ${b.term} months`,
    ].join("\n");
  },
},


income_calc: {
  url: "/api/income-helper",
  body: collectIncomeBody(modal),
  pick: (data) => data?.result || data?.text || data?.answer || "",
},
};

const cfg = routeMap[action];

if (!cfg) {
  if (output) {
    output.textContent =
      `✅ Received (${action}). No route mapped yet.\n` + `Input: ${text}`;
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

const reply = (cfg.pick ? cfg.pick(data) : "") || "";
if (output) output.textContent = reply || "✅ Done (empty response).";
} // ✅ closes: else { ... routeMap ... }
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
} // ✅ closes wireAiModals()

// ==================================================

  // FINAL INIT (SAFE) ✅ MUST BE LAST
  // ==================================================
  try {
    if (STORE.lastBoostPhotos?.length) {
      renderStep1Photos(STORE.lastBoostPhotos);
    }

    if (STORE.holdingZonePhotos?.length) {
      STORE.activeHoldingPhoto = STORE.activeHoldingPhoto || STORE.holdingZonePhotos[0] || "";
      renderHoldingZone();
      if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);
    }

    renderCreativeThumbs();
    renderSocialStrip();

    wireCalculatorPad();

    if (typeof wireAiModals === "function") {
      wireAiModals();
    } else {
      console.warn("🟣 wireAiModals() not found");
    }

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
