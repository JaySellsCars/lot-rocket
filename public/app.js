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

  // 🔒 FORCE source of truth
  STORE.activeHoldingPhoto = url;

  img.onload = () => console.log("✅ Photo Tuner loaded");
  img.onerror = () => console.warn("❌ Photo Tuner failed to load:", url);

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

// ==================================================
// SOCIAL-READY STRIP (THUMBS + BIG PREVIEW) — SINGLE SOURCE
// Targets HTML:
//  - thumbs: #socialCarousel
//  - preview: #socialCarouselPreviewImg
//  - nav: #socialPrevBtn / #socialNextBtn
//  - status: #socialCarouselStatus
// STORE.socialReadyPhotos: [{ url, selected, locked? }]
// ==================================================

function normalizeSocialReady() {
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];

  // force object format + cleanup
  STORE.socialReadyPhotos = STORE.socialReadyPhotos
    .map((p) => {
      if (!p) return null;
      if (typeof p === "string") return { url: p, selected: false, locked: false };
      return {
        url: p.url || "",
        selected: !!p.selected,
        locked: !!p.locked,
      };
    })
    .filter((p) => p && p.url);

  // unique by url + cap to MAX_PHOTOS
  const seen = new Set();
  STORE.socialReadyPhotos = STORE.socialReadyPhotos.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  }).slice(0, MAX_PHOTOS);

  // ensure one selected
  if (STORE.socialReadyPhotos.length) {
    const anySelected = STORE.socialReadyPhotos.some((p) => p.selected);
    if (!anySelected) STORE.socialReadyPhotos[0].selected = true;
  }
}

function getSelectedIndex() {
  normalizeSocialReady();
  return Math.max(0, STORE.socialReadyPhotos.findIndex((p) => p.selected));
}

function setSelectedIndex(nextIdx) {
  normalizeSocialReady();
  if (!STORE.socialReadyPhotos.length) return;

  const clamped = Math.max(0, Math.min(STORE.socialReadyPhotos.length - 1, nextIdx));
  STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p, i) => ({ ...p, selected: i === clamped }));
}

function addToSocialReady(url, makeSelected = true) {
  if (!url) return false;
  normalizeSocialReady();

  // If already exists, just select it
  const idx = STORE.socialReadyPhotos.findIndex((p) => p.url === url);
  if (idx >= 0) {
    if (makeSelected) setSelectedIndex(idx);
    return true;
  }

  // Add new
  const next = [{ url, selected: !!makeSelected, locked: false }, ...STORE.socialReadyPhotos]
    .filter((v, i, a) => a.findIndex((x) => x.url === v.url) === i)
    .slice(0, MAX_PHOTOS);

  // enforce one selected
  if (makeSelected) {
    const selIdx = next.findIndex((p) => p.url === url);
    next.forEach((p, i) => (p.selected = i === selIdx));
  } else if (!next.some((p) => p.selected) && next.length) {
    next[0].selected = true;
  }

  STORE.socialReadyPhotos = next;
  return true;
}

function renderSocialStrip() {
  // ✅ THESE MUST MATCH YOUR HTML
  const thumbsEl = $("socialCarousel");
  const previewImg = $("socialCarouselPreviewImg");
  const statusEl = $("socialCarouselStatus");
  if (!thumbsEl || !previewImg) return;

  normalizeSocialReady();

  const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
  thumbsEl.innerHTML = "";

  if (!list.length) {
    previewImg.removeAttribute("src");
    if (statusEl) statusEl.textContent = "No social-ready photos yet.";
    return;
  }

  // Ensure 1 selected exists
  let selIdx = getSelectedIndex();
  if (selIdx < 0 || selIdx >= list.length) selIdx = 0;

  // force selection state
  STORE.socialReadyPhotos = list.map((p, i) => ({ ...p, selected: i === selIdx }));
  const selected = STORE.socialReadyPhotos[selIdx];

  // big preview
  previewImg.src = getProxiedImageUrl(selected.url);

  // status
  const selectedCount = STORE.socialReadyPhotos.filter((p) => p.selected).length;
  if (statusEl) {
    statusEl.textContent = `Social-ready: ${STORE.socialReadyPhotos.length} • Selected: ${selectedCount}`;
  }

  // thumbs (up to MAX_PHOTOS)
  STORE.socialReadyPhotos.slice(0, MAX_PHOTOS).forEach((item, idx) => {
    const img = DOC.createElement("img");
    img.src = getProxiedImageUrl(item.url);
    img.className = "social-ready-thumb" + (item.selected ? " selected" : "");
    img.alt = "Social-ready thumb";

    img.addEventListener("click", () => {
      setSelectedIndex(idx);
      renderSocialStrip();
    });

    thumbsEl.appendChild(img);
  });
}

function wireSocialStripNav() {
  const prevBtn = $("socialPrevBtn");
  const nextBtn = $("socialNextBtn");

  if (prevBtn && prevBtn.dataset.wired !== "true") {
    prevBtn.dataset.wired = "true";
    prevBtn.addEventListener("click", () => {
      const idx = getSelectedIndex();
      setSelectedIndex(idx - 1);
      renderSocialStrip();
    });
  }

  if (nextBtn && nextBtn.dataset.wired !== "true") {
nextBtn.dataset.wired = "true";
    nextBtn.addEventListener("click", () => {
      const idx = getSelectedIndex();
      setSelectedIndex(idx + 1);
      renderSocialStrip();
    });
  }
}

// ===============================

  // STEP 1 — GRID
  // ===============================
function renderStep1Photos(urls) {
  if (!photosGridEl) return;

  setStep1FromUrls(urls);

  // FORCE: 4-column thumbnail grid
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

  // click delegation
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
