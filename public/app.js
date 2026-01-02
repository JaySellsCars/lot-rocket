// /public/app.js  — SINGLE SAFE BOOT FILE (CLEAN / STABLE)
(async () => {
  const V = "10001";
  console.log("🚀 APP BOOT OK —", V);

  const DOC = document;
  const $ = (id) => DOC.getElementById(id);

  // --------------------------------------------------
  // SAFE GLOBAL STORE
  // --------------------------------------------------
  window.STORE = window.STORE || {};
  const STORE = window.STORE;

  // ==================================================
  // STEP 1 SELECTION — ENFORCE SINGLE SOURCE OF TRUTH
  // ==================================================
  if (!Array.isArray(STORE.step1Selected)) STORE.step1Selected = [];

  // hard fail if old state exists (debug visibility)
  if ("_step1Selected" in STORE) {
    console.warn("🧨 Removing legacy STORE._step1Selected");
    try {
      delete STORE._step1Selected;
    } catch (e) {
      STORE._step1Selected = undefined;
    }
  }

  function syncSendBtn() {
    const btn = DOC.getElementById("sendToDesignStudio");
    if (!btn) return;
    const n = Array.isArray(STORE.step1Selected) ? STORE.step1Selected.length : 0;
    btn.disabled = n === 0;
    btn.style.opacity = n === 0 ? "0.55" : "1";
    btn.style.pointerEvents = n === 0 ? "none" : "auto";
  }

  // ✅ ensure arrays exist (prevents “undefined includes/indexOf” crashes)
  STORE.step1Selected = Array.isArray(STORE.step1Selected) ? STORE.step1Selected : [];
  STORE.holdingZonePhotos = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];

  // --------------------------------------------------
  // SOCIAL READY — MINIMAL STORE + RENDER (if UI exists)
  // --------------------------------------------------
  const getSocialStripEl = () =>
    $("socialCarousel") ||
    $("socialReadyZone") ||
    DOC.querySelector("[data-social-strip]") ||
    DOC.querySelector(".social-carousel") ||
    DOC.querySelector(".social-ready-strip");

  function renderSocialReady() {
    const strip = getSocialStripEl();
    if (!strip) return; // UI may exist in your full build; this stays safe if not.

    const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos.slice(0, 24) : [];
    strip.innerHTML = "";

    if (!list.length) {
      strip.innerHTML = `<div style="opacity:.65;padding:.5rem 0;">No photos in Social Ready yet.</div>`;
      return;
    }

    // stack in plain sight (wrap)
    strip.style.display = "flex";
    strip.style.flexWrap = "wrap";
    strip.style.gap = "10px";
    strip.style.alignItems = "flex-start";
    strip.style.justifyContent = "flex-start";
    strip.style.overflow = "visible";
    strip.style.padding = "10px 0";

    list.forEach((src) => {
      const img = DOC.createElement("img");
      img.src = src;
      img.loading = "lazy";
      img.decoding = "async";
      img.style.width = "120px";
      img.style.height = "80px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "10px";
      img.style.border = "1px solid rgba(255,255,255,.15)";
      img.style.flex = "0 0 auto";
      img.style.margin = "0";
      strip.appendChild(img);
    });
  }

  function addToSocialReady(src) {
    if (!src) return false;
    const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
    // remove if already exists then unshift to front
    const next = [src, ...list.filter((u) => u !== src)].slice(0, 24);
    STORE.socialReadyPhotos = next;
    renderSocialReady();
    console.log("✅ MOVED TO SOCIAL READY:", src);
    return true;
  }

  // --------------------------------------------------
  // STEP 3: HOLDING ZONE RENDER (STACK / NO SCROLL, up to 24)
  // Double-click thumbnail => move to Social Ready
  // --------------------------------------------------
  function renderHoldingZone() {
    const hz = DOC.getElementById("holdingZone");
    if (!hz) return;

    const photos = Array.isArray(STORE.holdingZonePhotos)
      ? STORE.holdingZonePhotos.slice(0, 24)
      : [];

    hz.innerHTML = "";
    hz.removeAttribute("style"); // prevents style drift

    if (!photos.length) {
      hz.innerHTML = `
        <div class="small-note" style="opacity:.7;padding:.5rem 0;">
          No photos in holding zone yet.
        </div>`;
      return;
    }

    // ✅ STACK IN PLAIN SIGHT (wrap grid-ish)
    hz.style.display = "flex";
    hz.style.flexDirection = "row";
    hz.style.flexWrap = "wrap";
    hz.style.gap = "10px";
    hz.style.overflow = "visible";
    hz.style.padding = "10px 0";
    hz.style.alignItems = "flex-start";
    hz.style.justifyContent = "flex-start";

    photos.forEach((src) => {
      const wrap = DOC.createElement("div");
      wrap.style.position = "relative";
      wrap.style.flex = "0 0 auto";
      wrap.style.cursor = "default";

      const img = DOC.createElement("img");
      img.src = src;
      img.loading = "lazy";
      img.decoding = "async";
      img.title = "Double-click to move to Social Ready";
      img.style.width = "120px";
      img.style.height = "80px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "10px";
      img.style.border = "1px solid rgba(255,255,255,.15)";
      img.style.margin = "0";
      img.style.cursor = "pointer";

      // ✅ DOUBLE CLICK => move to social ready zone
      img.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        addToSocialReady(src);

        // quick flash feedback
        img.style.outline = "2px solid rgba(255,255,255,.45)";
        setTimeout(() => (img.style.outline = "none"), 220);
      });

      wrap.appendChild(img);
      hz.appendChild(wrap);
    });
  }

  // --------------------------------------------------
  // STEP 1: SEND SELECTED → STEP 3 (bind ONCE)
  // Uses your real ID: #sendToDesignStudio
  // --------------------------------------------------
  (() => {
    const btn = DOC.getElementById("sendToDesignStudio");
    if (!btn || btn.__LR_BOUND__) return;
    btn.__LR_BOUND__ = true;

    // keep visible
    btn.classList.remove("hidden");
    btn.style.display = "inline-flex";
    btn.style.visibility = "visible";
    btn.style.opacity = "1";

    syncSendBtn(); // enable/disable based on selection

    btn.addEventListener("click", () => {
      const picked = Array.isArray(STORE.step1Selected)
        ? STORE.step1Selected.slice(0, 24)
        : [];

      if (!picked.length) return alert("Select at least 1 photo first.");

      STORE.holdingZonePhotos = picked.slice(0, 24);
      STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

      renderHoldingZone();

      const step3 = DOC.getElementById("creativeHub");
      if (step3) step3.scrollIntoView({ behavior: "smooth" });

      console.log("✅ SENT TO STEP 3:", picked.length);
    });
  })();

  // --------------------------------------------------
  // HEALTH CHECK
  // --------------------------------------------------
  try {
    const res = await fetch("/api/health");
    const json = await res.json();
    console.log("✅ API HEALTH:", json);
  } catch (e) {
    console.warn("⚠️ API not available (ok in dev)");
  }

  // --------------------------------------------------
  // BASIC UI WIRES
  // --------------------------------------------------
  const boostBtn = $("boostBtn");
  const urlInput = $("dealerUrlInput");

  if (boostBtn) {
    boostBtn.onclick = async () => {
      const url = urlInput?.value?.trim();
      if (!url) return alert("Paste a vehicle URL first.");

      console.log("🚀 BOOST:", url);

      let res, data;
      try {
        res = await fetch(`/api/boost?url=${encodeURIComponent(url)}&debug=1`);
        data = await res.json();
      } catch (e) {
        console.error("❌ BOOST FETCH FAILED", e);
        alert("Boost request failed (network/json).");
        return;
      }

      console.log("📦 BOOST DATA:", data);

      if (!data || !data.ok) {
        alert(data?.error || "Boost failed");
        return;
      }

      const rawImages = Array.isArray(data.images) ? data.images : [];
      const images = [...new Set(rawImages)].filter(Boolean);

      const grid = DOC.getElementById("step1Photos");
      if (!grid) return;

      grid.innerHTML = "";

      if (!images.length) {
        grid.innerHTML = `
          <div style="opacity:.75;padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:12px;">
            No images found.
          </div>`;
        return;
      }

      // ✅ reset selection for this boost (SINGLE SOURCE OF TRUTH)
      STORE.step1Selected = [];
      syncSendBtn();

      const countEl = DOC.getElementById("selectedCount");
      if (countEl) countEl.textContent = "0";

      // render selectable tiles (up to 24)
      const MAX_UI = 24;

      images.slice(0, MAX_UI).forEach((src) => {
        const tile = DOC.createElement("div");
        tile.style.position = "relative";
        tile.style.cursor = "pointer";
        tile.style.borderRadius = "12px";
        tile.style.overflow = "hidden";
        tile.style.border = "1px solid rgba(255,255,255,.12)";

        const img = DOC.createElement("img");
        img.src = src;
        img.loading = "lazy";
        img.decoding = "async";
        img.style.width = "100%";
        img.style.display = "block";

        const badge = DOC.createElement("div");
        badge.textContent = "✓";
        badge.style.position = "absolute";
        badge.style.top = "10px";
        badge.style.right = "10px";
        badge.style.width = "28px";
        badge.style.height = "28px";
        badge.style.display = "grid";
        badge.style.placeItems = "center";
        badge.style.borderRadius = "999px";
        badge.style.background = "rgba(0,0,0,.55)";
        badge.style.border = "1px solid rgba(255,255,255,.25)";
        badge.style.opacity = "0";
        badge.style.transition = "opacity .12s ease";

        const syncUI = () => {
          const active = STORE.step1Selected.includes(src);
          badge.style.opacity = active ? "1" : "0";
          tile.style.outline = active ? "2px solid rgba(255,255,255,.35)" : "none";
        };

        tile.addEventListener("click", () => {
          const idx = STORE.step1Selected.indexOf(src);

          if (idx > -1) {
            STORE.step1Selected.splice(idx, 1);
          } else {
            if (STORE.step1Selected.length >= 24) return;
            STORE.step1Selected.push(src);
          }

          syncUI();
          if (countEl) countEl.textContent = String(STORE.step1Selected.length);
          syncSendBtn();
        });

        syncUI();
        tile.appendChild(img);
        tile.appendChild(badge);
        grid.appendChild(tile);
      });
    };
  }

  // initial renders (safe)
  renderHoldingZone();
  renderSocialReady();
  syncSendBtn();

  console.log("✅ APP READY");
})();
