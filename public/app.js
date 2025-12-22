// public/app.js – Lot Rocket frontend logic v2.6 (CLEAN SINGLE-PASS)

window.document.addEventListener("DOMContentLoaded", () => {
  const DOC = window.document;
  const $ = (id) => DOC.getElementById(id);

  if (window.__LOTROCKET_BOOTED__) return;
  window.__LOTROCKET_BOOTED__ = true;

  console.log("🚀 Lot Rocket frontend loaded (v2.6 clean)");

  const MAX_PHOTOS = 24;

  // ===============================
  // GLOBAL STORE (FIXED)
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
  // ELEMENT REFERENCES
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
  // UTILITIES (SINGLE SOURCE)
  // ===============================
  function setBtnLoading(btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.dataset.originalText ||= btn.textContent;
      btn.textContent = label || "Working…";
      btn.disabled = true;
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || btn.textContent;
    }
  }

  function uniqCap(arr, cap = MAX_PHOTOS) {
    const seen = new Set();
    const out = [];
    for (let raw of arr || []) {
      const u = typeof raw === "string" ? raw : raw?.url;
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
  // STEP 1 — GRID
  // ===============================
  function renderStep1Photos(urls) {
    if (!photosGridEl) return;

    STORE.step1Photos = uniqCap(urls).map((u) => ({
      url: u,
      selected: false,
    }));

    photosGridEl.innerHTML = "";
    photosGridEl.style.display = "grid";
    photosGridEl.style.gridTemplateColumns = "repeat(4,1fr)";
    photosGridEl.style.gap = "8px";

    STORE.step1Photos.forEach((item, idx) => {
      const btn = DOC.createElement("button");
      btn.dataset.i = idx;
      btn.style.height = "72px";
      btn.style.borderRadius = "12px";
      btn.style.overflow = "hidden";
      btn.style.opacity = item.selected ? "1" : "0.45";

      const img = DOC.createElement("img");
      img.src = getProxiedImageUrl(item.url);
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";

      btn.onclick = () => {
        item.selected = !item.selected;
        btn.style.opacity = item.selected ? "1" : "0.45";
      };

      btn.appendChild(img);
      photosGridEl.appendChild(btn);
    });
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
      img.onclick = () => {
        STORE.activeHoldingPhoto = url;
        loadPhotoTuner(url);
      };
      zone.appendChild(img);
    });
  }

  function loadPhotoTuner(url) {
    const img = $("tunerPreviewImg");
    if (!img || !url) return;
    STORE.activeHoldingPhoto = url;
    img.src = getProxiedImageUrl(url);
  }

  // ===============================
  // SEND TOP → CREATIVE
  // ===============================
  if (sendTopBtn) {
    sendTopBtn.onclick = () => {
      const selected = STORE.step1Photos.filter(p => p.selected).map(p => p.url);
      if (!selected.length) return alert("Select photos first.");
      STORE.holdingZonePhotos = selected.slice(0, MAX_PHOTOS);
      STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0];
      renderHoldingZone();
      loadPhotoTuner(STORE.activeHoldingPhoto);
    };
  }

  // ===============================
  // SEND TO SOCIAL STRIP
  // ===============================
  function renderSocialStrip() {
    const strip = $("socialReadyStrip");
    if (!strip) return;
    strip.innerHTML = "";
    STORE.socialReadyPhotos.forEach(p => {
      const img = DOC.createElement("img");
      img.src = p.url;
      img.style.width = "96px";
      img.style.height = "96px";
      img.style.objectFit = "cover";
      strip.appendChild(img);
    });
  }

  function pushToSocialReady(url) {
    if (!url) return false;
    STORE.socialReadyPhotos = uniqCap([
      url,
      ...STORE.socialReadyPhotos.map(p => p.url)
    ]).map(u => ({ url: u, selected: u === url }));
    renderSocialStrip();
    return true;
  }

  if (sendToSocialStripBtn) {
    sendToSocialStripBtn.onclick = () => {
      const ok = pushToSocialReady(STORE.activeHoldingPhoto);
      if (!ok) alert("No active photo.");
    };
  }

  // ===============================
  // BOOST — FIXED
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

  console.log("✅ FINAL INIT COMPLETE");
});
