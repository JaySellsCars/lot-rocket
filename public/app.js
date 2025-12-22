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

  console.log("🚀 JS FILE LOADED");
  console.log("✅ Lot Rocket frontend loaded (v2.6 clean) BRANCH: test/clean-rewrite");

  // TRUTH HOOK — prove clicks / errors
  console.log("🧪 TRUTH HOOK ACTIVE");
  DOC.addEventListener(
    "click",
    (e) => {
      const el = e.target;
      const tag = el && el.tagName ? el.tagName : "";
      const id = el && el.id ? "#" + el.id : "";
      const cls = el && el.className ? el.className : "";
      console.log("🖱️ CLICK:", tag, id, cls);
    },
    true
  );
  window.addEventListener("error", (e) => {
    console.error("💥 WINDOW ERROR:", e.message, e.filename, e.lineno);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("💥 PROMISE REJECTION:", e.reason);
  });

  const apiBase = "";
  const MAX_PHOTOS = 24;

  // ===============================
  // SINGLE STORE
  // ===============================
  window.LOTROCKET = window.LOTROCKET || {};
  const STORE = window.LOTROCKET;

  STORE.creativePhotos = Array.isArray(STORE.creativePhotos) ? STORE.creativePhotos : [];
  STORE.designStudioPhotos = Array.isArray(STORE.designStudioPhotos) ? STORE.designStudioPhotos : [];
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
  STORE.step1Photos = Array.isArray(STORE.step1Photos) ? STORE.step1Photos : [];
  STORE.lastBoostPhotos = Array.isArray(STORE.lastBoostPhotos) ? STORE.lastBoostPhotos : [];
  STORE.lastTitle = STORE.lastTitle || "";
  STORE.lastPrice = STORE.lastPrice || "";

  // ===============================
  // STEP 3 — HOLDING ZONE (SOURCE OF TRUTH)
  // ===============================
  STORE.holdingZonePhotos = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];
  STORE.activeHoldingPhoto = STORE.activeHoldingPhoto || null;

  let socialIndex = 0;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // ===============================
  // ELEMENT REFERENCES (SINGLE COPY)
  // ===============================
  const boostBtn =
  $("boostListingBtn") ||
  $("boostThisListingBtn") ||
  $("boostThisListing") ||
  $("boostButton") ||
  null;
console.log("🔎 BOOST BTN FOUND:", boostBtn ? ("#" + boostBtn.id) : "NONE");

  const dealerUrlInput = $("dealerUrl");
  const vehicleLabelInput = $("vehicleLabel");
  const priceOfferInput = $("priceOffer");

  const vehicleTitleEl = $("vehicleTitle") || $("vehicleName") || $("summaryVehicle");
  const vehiclePriceEl = $("vehiclePrice") || $("summaryPrice");
  const photosGridEl = $("photosGrid");

const sendTopBtn = $("sendTopPhotosToCreative");
if (!sendTopBtn) {
  console.warn("⚠️ Send Photos button not found");
}

function pulseBtn(btn) {
  if (!btn) return;
  btn.classList.add("is-fired");
  window.setTimeout(() => btn.classList.remove("is-fired"), 260);
}





  // ===============================
  // STEP 3 — HOLDING ZONE RENDER
  // ===============================
function renderHoldingZone() {
const zone = $("holdingZone") || $("photoDropZone");
if (!zone) return;



  // (prevents layout blowups if HTML placement is wrong)




    zone.innerHTML = "";

    STORE.holdingZonePhotos.forEach((url) => {
      const img = DOC.createElement("img");
      img.src = url;
      img.className = "holding-thumb";

      if (url === STORE.activeHoldingPhoto) {
        img.classList.add("active");
      }

      img.addEventListener("click", () => {
        STORE.activeHoldingPhoto = url;
        renderHoldingZone();
        loadPhotoTuner(url);
      });

      zone.appendChild(img);
    });
  }

function loadPhotoTuner(url) {
  const img = $("tunerPreviewImg");
  if (!img) {
    console.warn("⚠️ tunerPreviewImg not found");
    return;
  }
  if (!url) return;

  const safeUrl = getProxiedImageUrl(url);

  img.onload = () => console.log("✅ Photo Tuner loaded");
  img.onerror = () => console.warn("❌ Photo Tuner failed to load:", safeUrl);

  img.src = safeUrl;
}
function applyTunerFilters() {
  const img = $("tunerPreviewImg") || $("photoTunerPreview");
  if (!img) return;

  const bEl = $("tunerBrightness");
  const cEl = $("tunerContrast");
  const sEl = $("tunerSaturation");

  const b = bEl ? Number(bEl.value || 100) : 100;
  const c = cEl ? Number(cEl.value || 100) : 100;
  const s = sEl ? Number(sEl.value || 100) : 100;

  img.style.filter = "brightness(" + (b / 100) + ") contrast(" + (c / 100) + ") saturate(" + (s / 100) + ")";
}

function setTunerDefaults(brightness, contrast, saturation) {
  const bEl = $("tunerBrightness");
  const cEl = $("tunerContrast");
  const sEl = $("tunerSaturation");

  if (bEl) bEl.value = String(brightness);
  if (cEl) cEl.value = String(contrast);
  if (sEl) sEl.value = String(saturation);

  applyTunerFilters();
}



  // ===============================
  // UTIL
  // ===============================
  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 4 + "px";
  }

  function parseSrcset(srcset) {
    if (!srcset) return [];
    return String(srcset)
      .split(",")
      .map((s) => s.trim().split(/\s+/)[0])
      .filter(Boolean);
  }

  function setBtnLoading(btn, isLoading, label) {
    if (!btn) return;

    if (isLoading) {
      if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
      btn.textContent = label || "Working…";
      btn.disabled = true;
      btn.classList.add("btn-loading");
    } else {
      btn.disabled = false;
      btn.classList.remove("btn-loading");
      btn.textContent = btn.dataset.originalText || btn.textContent;
    }
  }

  function normalizeUrl(input) {
    if (!input) return "";
    let u = ("" + input).trim();
    if (!u) return "";

    if (u.startsWith("blob:") || u.startsWith("data:")) return u;

    if ((u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'"))) {
      u = u.slice(1, -1).trim();
    }

    if (u.startsWith("//")) u = "https:" + u;

    try {
      const url = new URL(u, window.location.href);
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((k) =>
        url.searchParams.delete(k)
      );
      return url.origin + url.pathname + (url.search ? url.search : "");
    } catch {
      return u;
    }
  }

  function uniqCleanCap(arr, cap) {
    const max = typeof cap === "number" && cap > 0 ? cap : MAX_PHOTOS;
    if (!Array.isArray(arr)) return [];

    const out = [];
    const seen = new Set();

    for (let i = 0; i < arr.length; i++) {
      let raw = arr[i];
      if (raw && typeof raw === "object" && raw.url) raw = raw.url;

      const u = normalizeUrl(raw);
      if (!u) continue;

      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
        if (out.length >= max) break;
      }
    }
    return out;
  }

  function getProxiedImageUrl(rawUrl) {
    if (!rawUrl) return rawUrl;
    try {
      const u = new URL(rawUrl, window.location.origin);
      if (u.origin === window.location.origin || u.protocol === "blob:" || u.protocol === "data:") return rawUrl;
      if (u.pathname.startsWith("/api/proxy-image")) return rawUrl;
      return "/api/proxy-image?url=" + encodeURIComponent(u.href);
    } catch {
      return rawUrl;
    }
  }
// ===============================
// SEND TO SOCIAL-READY STRIP (SINGLE SOURCE)
// ===============================
const sendToSocialStripBtn = $("sendToSocialStripBtn");

if (sendToSocialStripBtn && sendToSocialStripBtn.dataset.wired !== "true") {
  sendToSocialStripBtn.dataset.wired = "true";

  sendToSocialStripBtn.addEventListener("click", () => {
    // Visual feedback (instant)
    sendToSocialStripBtn.classList.add("is-loading");
    sendToSocialStripBtn.classList.add("btn-pressed");
    if (typeof pulseBtn === "function") pulseBtn(sendToSocialStripBtn);

    try {
      // Prefer current tuned preview <img>. These IDs exist in your HTML.
      const previewEl =
        $("tunerPreviewImg") || $("photoTunerPreview") || $("photoTunerPreviewImg");

      const srcFromPreview = previewEl?.src || "";

      // Prefer tracked "current tuned" photo if you store it, else fallback to preview src
      const url =
        STORE.activeHoldingPhoto ||
        STORE.activePhotoTunerUrl ||
        srcFromPreview ||
        "";

      if (!url) {
        alert("No tuned photo selected yet.");
        return;
      }

      // Normalize container (objects)
      STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];

      // Add or select
      const exists = STORE.socialReadyPhotos.some((p) => p?.url === url);
      if (!exists) {
        STORE.socialReadyPhotos.unshift({
          url,
          originalUrl: url,
          selected: true,
          locked: false
        });
      } else {
        STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p) => ({
          ...p,
          selected: p.url === url
        }));
      }

      // Cap length
      if (typeof MAX_PHOTOS === "number" && STORE.socialReadyPhotos.length > MAX_PHOTOS) {
        STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(0, MAX_PHOTOS);
      }

      // Render (call normalize first so downstream assumes correct shape)
      if (typeof normalizeSocialReady === "function") normalizeSocialReady();
      if (typeof renderSocialStrip === "function") renderSocialStrip();
      if (typeof renderSocialCarousel === "function") renderSocialCarousel();
      if (typeof renderSocialReady === "function") renderSocialReady();

    } catch (e) {
      console.error("❌ Send to Social-ready Strip failed:", e);
      alert("Send to Social-ready Strip failed. Check console.");
    } finally {
      // Remove loading feel
      window.setTimeout(() => {
        sendToSocialStripBtn.classList.remove("is-loading");
        sendToSocialStripBtn.classList.remove("btn-pressed");
      }, 220);
    }
  });
}



  // ===============================
  // STEP 1 GRID STATE + RENDER
  // ===============================
  function setStep1FromUrls(urls) {
    const clean = uniqCleanCap(urls || [], MAX_PHOTOS);
    STORE.step1Photos = clean.map((u) => ({ url: u, selected: false, dead: false }));
  }

  function renderStep1Photos(urls) {
    if (!photosGridEl) return;

    setStep1FromUrls(urls);

    photosGridEl.style.display = "grid";
    photosGridEl.style.gridTemplateColumns = "repeat(4, 1fr)";
    photosGridEl.style.gap = "8px";
    photosGridEl.innerHTML = "";

    (STORE.step1Photos || []).forEach((item, idx) => {
      const src = getProxiedImageUrl(item.url);

      const btn = DOC.createElement("button");
      btn.type = "button";
      btn.className = "photo-thumb-btn";
      btn.setAttribute("data-i", String(idx));
      btn.style.position = "relative";
      btn.style.height = "64px";
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
      if (!e || !e.target || !e.target.closest) return;
      const btnEl = e.target.closest("[data-i]");
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
// SEND TOP PHOTOS → STEP 3 HOLDING ZONE
// ===============================
if (sendTopBtn && sendTopBtn.dataset.wired !== "true") {
  sendTopBtn.dataset.wired = "true";

  sendTopBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // instant “pressed” feel
    sendTopBtn.classList.add("btn-pressed");
    setBtnLoading(sendTopBtn, true, "Sending...");

    try {
      const selected = (STORE.step1Photos || [])
        .filter((p) => p && p.selected && p.url)
        .map((p) => p.url);

      if (!selected.length) {
        alert("Select photos first.");
        return;
      }

      STORE.holdingZonePhotos = selected.slice(0, MAX_PHOTOS);
      STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || null;

      renderHoldingZone();
      if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);

      // success flash
      sendTopBtn.textContent = "✅ Sent";
      setTimeout(() => {
        sendTopBtn.textContent =
          sendTopBtn.dataset.originalText || "Send Photos to Creative Lab";
      }, 900);

      console.log("📦 STEP 3 LOADED", STORE.holdingZonePhotos.length);
    } catch (err) {
      console.error("❌ Send failed:", err);
      alert("Send failed.");
    } finally {
      setTimeout(() => {
        setBtnLoading(sendTopBtn, false);
        sendTopBtn.classList.remove("btn-pressed");
      }, 150);
    }
  });
}


// ===============================
// BOOST — SINGLE IMPLEMENTATION
// ===============================

  if (boostBtn) {
    boostBtn.addEventListener("click", async () => {
      console.log("🚀 BOOST CLICKED");

      if (!dealerUrlInput || !dealerUrlInput.value.trim()) {
        alert("Enter a vehicle URL first.");
        return;
      }

      setBtnLoading(boostBtn, true, "Boosting...");

      try {
        const res = await fetch("/boost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: dealerUrlInput.value.trim() }),
        });

        const data = await res.json();

        const photos = Array.isArray(data.photos) ? data.photos : [];
        STORE.lastBoostPhotos = uniqCleanCap(photos, MAX_PHOTOS);

        STORE.lastTitle = data.title || STORE.lastTitle || "";
        STORE.lastPrice = data.price || STORE.lastPrice || "";

        if (vehicleTitleEl) vehicleTitleEl.textContent = STORE.lastTitle || "—";
        if (vehiclePriceEl) vehiclePriceEl.textContent = STORE.lastPrice || "—";

        renderStep1Photos(STORE.lastBoostPhotos);

        console.log("✅ BOOST SUCCESS", STORE.lastBoostPhotos.length);
      } catch (e) {
        console.error("❌ BOOST FAILED", e);
        alert("Boost failed.");
      } finally {
        setBtnLoading(boostBtn, false);
      }
    });
  }

// ===============================
// FINAL INIT (SAFE BOOT — LOCKED)
// ===============================
try {
  console.log("✅ FINAL INIT REACHED");

  // Textarea autosize (one-time wiring)
  DOC.querySelectorAll("textarea").forEach((ta) => {
    autoResizeTextarea(ta);
    ta.addEventListener("input", () => autoResizeTextarea(ta));
  });

  // Restore Step 1 photos (after refresh / reload)
  if (Array.isArray(STORE.lastBoostPhotos) && STORE.lastBoostPhotos.length) {
    renderStep1Photos(STORE.lastBoostPhotos);
  }

  // Restore Step 3 holding zone + Photo Tuner preview
  if (Array.isArray(STORE.holdingZonePhotos) && STORE.holdingZonePhotos.length) {
    STORE.activeHoldingPhoto = STORE.activeHoldingPhoto || STORE.holdingZonePhotos[0];
    renderHoldingZone();
    loadPhotoTuner(STORE.activeHoldingPhoto);
  }
const bEl = $("tunerBrightness");
const cEl = $("tunerContrast");
const sEl = $("tunerSaturation");

if (bEl) bEl.addEventListener("input", applyTunerFilters);
if (cEl) cEl.addEventListener("input", applyTunerFilters);
if (sEl) sEl.addEventListener("input", applyTunerFilters);

} catch (e) {
  console.error("❌ Final init failed:", e);
}

}); // ✅ CLOSE DOMContentLoaded (DO NOT DELETE)

