// public/app.js – Lot Rocket frontend logic v2.6 (CLEAN SINGLE-PASS)
// Goal: one boot, one store, one wiring pass, zero duplicate blocks, zero syntax landmines.

window.document.addEventListener("DOMContentLoaded", () => {
  // ===============================
  // BOOT + DEBUG HOOKS
  // ===============================
  const DOC = window.document;
  const $ = (id) => DOC.getElementById(id);

  if (window.__LOTROCKET_BOOTED__) {
    console.warn("🚫 Lot Rocket boot blocked (double init)");
    return;
  }
  window.__LOTROCKET_BOOTED__ = true;

  console.log("🚀 Lot Rocket frontend loaded (v2.6 clean)");

  DOC.addEventListener(
    "click",
    (e) => {
      const el = e.target;
      console.log("🖱️ CLICK:", el?.tagName, el?.id ? "#" + el.id : "", el?.className || "");
    },
    true
  );

  window.addEventListener("error", (e) =>
    console.error("💥 WINDOW ERROR:", e.message, e.filename, e.lineno)
  );
  window.addEventListener("unhandledrejection", (e) =>
    console.error("💥 PROMISE REJECTION:", e.reason)
  );

  const MAX_PHOTOS = 24;

  // ===============================
  // SINGLE STORE (LOCKED)
  // ===============================
  window.LOTROCKET = window.LOTROCKET || {};
  const STORE = window.LOTROCKET;

  STORE.step1Photos ||= [];
  STORE.lastBoostPhotos ||= [];
  STORE.holdingZonePhotos ||= [];
  STORE.socialReadyPhotos ||= [];
  STORE.activeHoldingPhoto ||= null;
  STORE.lastTitle ||= "";
  STORE.lastPrice ||= "";

  // ===============================
  // ELEMENT REFERENCES (SINGLE COPY)
  // ===============================
  const boostBtn =
    $("boostListingBtn") ||
    $("boostThisListingBtn") ||
    $("boostThisListing") ||
    $("boostButton");

  const dealerUrlInput = $("dealerUrl");
  const vehicleTitleEl = $("vehicleTitle") || $("vehicleName");
  const vehiclePriceEl = $("vehiclePrice");
  const photosGridEl = $("photosGrid");
  const sendTopBtn = $("sendTopPhotosToCreative");
  const autoEnhanceBtn = $("autoEnhanceBtn");
  const sendToSocialStripBtn = $("sendToSocialStripBtn");

  // ===============================
  // UTILITIES
  // ===============================
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

  function uniqCap(arr, cap = MAX_PHOTOS) {
    const seen = new Set();
    const out = [];
    for (const u of arr) {
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push(u);
      if (out.length >= cap) break;
    }
    return out;
  }

  function getProxiedImageUrl(url) {
    if (!url) return url;
    try {
      const u = new URL(url, location.origin);
      if (u.origin === location.origin) return url;
      return "/api/proxy-image?url=" + encodeURIComponent(u.href);
    } catch {
      return url;
    }
  }

  // ===============================
  // STEP 3 — HOLDING ZONE
  // ===============================
  function renderHoldingZone() {
    const zone = $("holdingZone");
    if (!zone) return;
    zone.innerHTML = "";

    STORE.holdingZonePhotos.forEach((url) => {
      const img = DOC.createElement("img");
      img.src = url;
      img.className = "holding-thumb" + (url === STORE.activeHoldingPhoto ? " active" : "");
      img.onclick = () => {
        STORE.activeHoldingPhoto = url;
        renderHoldingZone();
        loadPhotoTuner(url);
      };
      zone.appendChild(img);
    });
  }

  function loadPhotoTuner(url) {
    const img = $("tunerPreviewImg");
    if (!img || !url) return;
    img.src = getProxiedImageUrl(url);
  }

  function applyTunerFilters() {
    const img = $("tunerPreviewImg");
    if (!img) return;

    const b = Number($("tunerBrightness")?.value || 100) / 100;
    const c = Number($("tunerContrast")?.value || 100) / 100;
    const s = Number($("tunerSaturation")?.value || 100) / 100;

    img.style.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
  }

  // ===============================
  // AUTO ENHANCE (SINGLE WIRE)
  // ===============================
  if (autoEnhanceBtn && autoEnhanceBtn.dataset.wired !== "true") {
    autoEnhanceBtn.dataset.wired = "true";
    autoEnhanceBtn.onclick = () => {
      setBtnLoading(autoEnhanceBtn, true, "Enhancing…");
      $("tunerBrightness").value = 112;
      $("tunerContrast").value = 112;
      $("tunerSaturation").value = 118;
      applyTunerFilters();
      setTimeout(() => setBtnLoading(autoEnhanceBtn, false), 200);
    };
  }

  // ===============================
  // SEND TO SOCIAL-READY STRIP (ONE SOURCE)
  // ===============================
  // ===============================
// SOCIAL-READY STRIP — RENDER (SINGLE SOURCE)
// ===============================
function renderSocialStrip() {
  const strip = $("socialReadyStrip");
  if (!strip) return;

  strip.innerHTML = "";

  (STORE.socialReadyPhotos || []).forEach((item, idx) => {
    if (!item || !item.url) return;

    const img = DOC.createElement("img");
    img.src = item.url;
    img.className = "social-ready-thumb";
    img.style.opacity = item.selected ? "1" : "0.5";

    img.onclick = () => {
      STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p, i) => ({
        ...p,
        selected: i === idx
      }));
      renderSocialStrip();
    };

    strip.appendChild(img);
  });
}

  
  function getActivePhotoUrl() {
    return STORE.activeHoldingPhoto || "";
  }

  function pushToSocialReady(url) {
    if (!url) return false;

    STORE.socialReadyPhotos = [
      { url, selected: true, locked: false },
      ...STORE.socialReadyPhotos.map((p) => ({ ...p, selected: false })),
    ].filter((v, i, a) => a.findIndex((x) => x.url === v.url) === i)
     .slice(0, MAX_PHOTOS);

    if (typeof renderSocialStrip === "function") renderSocialStrip();
    return true;
  }

  if (sendToSocialStripBtn && sendToSocialStripBtn.dataset.wired !== "true") {
    sendToSocialStripBtn.dataset.wired = "true";
    sendToSocialStripBtn.onclick = () => {
      setBtnLoading(sendToSocialStripBtn, true, "Sending…");
      const ok = pushToSocialReady(getActivePhotoUrl());
      if (!ok) alert("No active photo selected.");
      setTimeout(() => setBtnLoading(sendToSocialStripBtn, false), 200);
    };
  }

  // ===============================
  // STEP 1 — GRID
  // ===============================
  function renderStep1Photos(urls) {
    if (!photosGridEl) return;
    STORE.step1Photos = uniqCap(urls).map((u) => ({ url: u, selected: false }));
    photosGridEl.innerHTML = "";

    STORE.step1Photos.forEach((item, i) => {
      const btn = DOC.createElement("button");
      btn.dataset.i = i;
      btn.className = "photo-thumb-btn";
      btn.style.opacity = item.selected ? "1" : "0.45";

      const img = DOC.createElement("img");
      img.src = getProxiedImageUrl(item.url);
      img.className = "photo-thumb-img";

      btn.onclick = () => {
        item.selected = !item.selected;
        btn.style.opacity = item.selected ? "1" : "0.45";
      };

      btn.appendChild(img);
      photosGridEl.appendChild(btn);
    });
  }

  // ===============================
  // SEND TOP PHOTOS → STEP 3
  // ===============================
  if (sendTopBtn && sendTopBtn.dataset.wired !== "true") {
    sendTopBtn.dataset.wired = "true";
    sendTopBtn.onclick = () => {
      const selected = STORE.step1Photos.filter((p) => p.selected).map((p) => p.url);
      if (!selected.length) return alert("Select photos first.");
      STORE.holdingZonePhotos = selected.slice(0, MAX_PHOTOS);
      STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0];
      renderHoldingZone();
      loadPhotoTuner(STORE.activeHoldingPhoto);
    };
  }

  // ===============================
  // BOOST — SINGLE IMPLEMENTATION
  // ===============================
  if (boostBtn) {
    boostBtn.onclick = async () => {
      if (!dealerUrlInput?.value.trim()) return alert("Enter vehicle URL");
      setBtnLoading(boostBtn, true, "Boosting…");

      try {
        const res = await fetch("/boost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: dealerUrlInput.value.trim() }),
        });

        const data = await res.json();
        STORE.lastBoostPhotos = uniqCap(data.photos || []);
        STORE.lastTitle = data.title || "";
        STORE.lastPrice = data.price || "";

        vehicleTitleEl && (vehicleTitleEl.textContent = STORE.lastTitle);
        vehiclePriceEl && (vehiclePriceEl.textContent = STORE.lastPrice);

        renderStep1Photos(STORE.lastBoostPhotos);
      } catch (e) {
        console.error("❌ BOOST FAILED", e);
        alert("Boost failed.");
      } finally {
        setBtnLoading(boostBtn, false);
      }
    };
  }

  // ===============================
  // FINAL INIT (SAFE)
  // ===============================
  try {
    if (STORE.lastBoostPhotos.length) renderStep1Photos(STORE.lastBoostPhotos);
    if (STORE.holdingZonePhotos.length) {
      STORE.activeHoldingPhoto ||= STORE.holdingZonePhotos[0];
      renderHoldingZone();
      loadPhotoTuner(STORE.activeHoldingPhoto);
    }

    ["tunerBrightness", "tunerContrast", "tunerSaturation"].forEach((id) =>
      $(id)?.addEventListener("input", applyTunerFilters)
    );

    console.log("✅ FINAL INIT COMPLETE");
  } catch (e) {
    console.error("❌ FINAL INIT FAILED", e);
  }
});
