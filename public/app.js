// public/app.js — Lot Rocket (CLEAN SINGLE-PASS)
// One boot. One store. One wiring pass. No duplicate blocks.

document.addEventListener("DOMContentLoaded", () => {
  // ==================================================
  // BOOT GUARD + INSPECT
  // ==================================================
  if (window.__LOTROCKET_BOOTED__) {
    console.warn("🚫 Lot Rocket boot blocked (double init)");
    return;
  }
  window.__LOTROCKET_BOOTED__ = true;

  const DOC = document;
  const $ = (id) => DOC.getElementById(id);

  const INSPECT = true;
  const log = (...a) => INSPECT && console.log(...a);
  const warn = (...a) => INSPECT && console.warn(...a);
  const err = (...a) => console.error(...a);

  window.addEventListener("error", (e) => err("💥 WINDOW ERROR:", e.message, e.filename, e.lineno));
  window.addEventListener("unhandledrejection", (e) => err("💥 PROMISE REJECTION:", e.reason));

  DOC.addEventListener(
    "click",
    (e) => {
      const el = e.target;
      log("🖱️ CLICK:", el?.tagName, el?.id ? "#" + el.id : "", el?.className || "");
    },
    true
  );

  log("✅ Lot Rocket boot OK");

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

  // Step 1 buttons/grid
  const boostBtn =
    $("boostListingBtn") ||
    $("boostThisListingBtn") ||
    $("boostThisListing") ||
    $("boostButton");
  const statusText = $("statusText");
  const photosGridEl = $("photosGrid");
  const sendTopBtn = $("sendTopPhotosToCreative") || $("sendTopPhotosBtn");

  // Step 3 holding zone / tuner
  const holdingZoneEl = $("holdingZone");
  const tunerPreviewImg = $("tunerPreviewImg");
  const tunerBrightness = $("tunerBrightness");
  const tunerContrast = $("tunerContrast");
  const tunerSaturation = $("tunerSaturation");
  const autoEnhanceBtn = $("autoEnhanceBtn");
  const sendToSocialStripBtn = $("sendToSocialStripBtn");

  // Creative thumbs
  const creativeThumbGrid = $("creativeThumbGrid");

  // Social strip
  const socialReadyStrip = $("socialReadyStrip") || $("socialCarousel"); // supports either container id
  const socialPreviewImg = $("socialCarouselPreviewImg"); // optional
  const socialStatus = $("socialCarouselStatus"); // optional

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
  // STEP 3 — HOLDING ZONE + TUNER (SINGLE SOURCE)
  // ==================================================
  function renderHoldingZone() {
    if (!holdingZoneEl) return;
    holdingZoneEl.innerHTML = "";

    (STORE.holdingZonePhotos || []).forEach((url) => {
      const img = DOC.createElement("img");
      img.src = getProxiedImageUrl(url);
      img.className = "holding-thumb" + (url === STORE.activeHoldingPhoto ? " active" : "");
      img.onclick = () => {
        STORE.activeHoldingPhoto = url;
        renderHoldingZone();
        loadPhotoTuner(url);
      };
      holdingZoneEl.appendChild(img);
    });
  }

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

  // Auto Enhance
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
  // SOCIAL READY STRIP (SINGLE SOURCE)
  // ==================================================
  function renderSocialStrip() {
    normalizeSocialReady();
    if (!socialReadyStrip) return;

    socialReadyStrip.innerHTML = "";

    STORE.socialReadyPhotos.forEach((item, idx) => {
      if (!item?.url) return;

      // supports both "div of imgs" AND "carousel button items"
      const node = DOC.createElement("img");
      node.src = item.url;
      node.className = "social-ready-thumb";
      node.style.opacity = item.selected ? "1" : "0.5";

      node.onclick = () => {
        STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p, i) => ({
          ...p,
          selected: i === idx ? !p.selected : p.selected,
        }));
        renderSocialStrip();
      };

      socialReadyStrip.appendChild(node);
    });

    if (socialPreviewImg) {
      const active = STORE.socialReadyPhotos.find((p) => p.selected) || STORE.socialReadyPhotos[0];
      socialPreviewImg.src = active?.url || "";
    }

    if (socialStatus) {
      const selectedCount = STORE.socialReadyPhotos.filter((p) => p.selected).length;
      socialStatus.textContent = STORE.socialReadyPhotos.length
        ? `Social-ready: ${STORE.socialReadyPhotos.length} • Selected: ${selectedCount}`
        : "No social-ready photos yet.";
    }
  }

  function addToSocialReady(url, selected = true) {
    if (!url) return false;
    normalizeSocialReady();

    const existing = STORE.socialReadyPhotos.findIndex((p) => p.url === url);
    if (existing !== -1) {
      STORE.socialReadyPhotos[existing].selected = true;
      renderSocialStrip();
      return true;
    }

    STORE.socialReadyPhotos.push({
      url,
      originalUrl: url,
      selected: !!selected,
      locked: false,
    });

    normalizeSocialReady();
    renderSocialStrip();
    return true;
  }

  function pushToSocialReady(url) {
    if (!url) return false;

    // newest first, dedupe, cap
    normalizeSocialReady();
    const next = [{ url, originalUrl: url, selected: true, locked: false }]
      .concat(STORE.socialReadyPhotos.map((p) => ({ ...p, selected: false })))
      .filter((v, i, a) => a.findIndex((x) => x.url === v.url) === i)
      .slice(0, MAX_PHOTOS);

    STORE.socialReadyPhotos = next;
    renderSocialStrip();
    return true;
  }

  // Button: Send to Social-ready Strip
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
    creativeThumbGrid.innerHTML = "";

    STORE.creativePhotos = capMax(uniqueUrls(STORE.creativePhotos), MAX_PHOTOS);

    STORE.creativePhotos.forEach((url) => {
      const img = DOC.createElement("img");
      img.src = url;
      img.alt = "Creative photo";
      img.loading = "lazy";
      img.className = "creative-thumb";
      img.title = "Click = select • Double-click = send to Social Strip";

      img.addEventListener("click", () => {
        img.classList.toggle("selected");
        if (tunerPreviewImg) {
          tunerPreviewImg.src = url;
          applyTunerFilters();
        }
      });

      img.addEventListener("dblclick", () => {
        addToSocialReady(url, true);
      });

      creativeThumbGrid.appendChild(img);
    });

    if (tunerPreviewImg && !tunerPreviewImg.src && STORE.creativePhotos.length) {
      tunerPreviewImg.src = STORE.creativePhotos[0];
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
      renderHoldingZone();
      if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);

      // also push into creative pool
      STORE.creativePhotos = capMax(uniqueUrls([...(STORE.creativePhotos || []), ...STORE.holdingZonePhotos]), MAX_PHOTOS);
      renderCreativeThumbs();

      log("✅ Sent to Step 3:", STORE.holdingZonePhotos.length);
    };
  }

  // ==================================================
  // BOOST (SINGLE IMPLEMENTATION)
  // ==================================================
  if (boostBtn && boostBtn.dataset.wired !== "true") {
    boostBtn.dataset.wired = "true";

    boostBtn.onclick = async () => {
      log("🚀 BOOST CLICK");
      const url = dealerUrlInput?.value?.trim?.() || "";
      if (!url) return alert("Enter vehicle URL");

      setBtnLoading(boostBtn, true, "Boosting…");
      if (statusText) statusText.textContent = "Boosting…";
async function postBoost(payload) {
  // PRIMARY (your old version)
  let res = await fetch(apiBase + "/api/boost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // fallback for legacy backend
  if (res.status === 404) {
    res = await fetch(apiBase + "/boost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  return res;
}


// ✅ Boost endpoint fallback: tries /api/boost, then /boost
async function postBoost(payload) {
  // try modern path first
  let res = await fetch(apiBase + "/api/boost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // if that route doesn't exist on this backend, try legacy
  if (res.status === 404) {
    res = await fetch(apiBase + "/boost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  return res;
}


        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `Boost failed (HTTP ${res.status})`);

        log("✅ BOOST RESPONSE keys:", Object.keys(data || {}));
        log("📥 BOOST photos:", Array.isArray(data?.photos) ? data.photos.length : "no photos array");

        // Update summary fields
        const vLabel = data.vehicleLabel || data.title || "";
        const vPrice = data.priceInfo || data.price || "";

        if (summaryLabel) summaryLabel.textContent = vLabel || "—";
        if (summaryPrice) summaryPrice.textContent = vPrice || "—";

        if (vehicleLabelInput && !vehicleLabelInput.value) vehicleLabelInput.value = vLabel || "";
        if (priceInfoInput && !priceInfoInput.value) priceInfoInput.value = vPrice || "";

        // Photos
        const rawPhotos = Array.isArray(data.photos) ? data.photos : [];
        STORE.lastBoostPhotos = capMax(uniqueUrls(rawPhotos), MAX_PHOTOS);

        renderStep1Photos(STORE.lastBoostPhotos);

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

  // ==================================================
  // FINAL INIT (SAFE)
  // ==================================================
  try {
    // restore existing state if any
    if (STORE.lastBoostPhotos.length) renderStep1Photos(STORE.lastBoostPhotos);

    if (STORE.holdingZonePhotos.length) {
      STORE.activeHoldingPhoto ||= STORE.holdingZonePhotos[0] || "";
      renderHoldingZone();
      if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);
    }

    renderCreativeThumbs();
    renderSocialStrip();

    log("✅ FINAL INIT COMPLETE");
  } catch (e) {
    err("❌ FINAL INIT FAILED", e);
  }
});
