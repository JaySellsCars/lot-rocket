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

  // --------------------------------------------------
  // STEP 3: HOLDING ZONE RENDER (horizontal, up to 24)
  // --------------------------------------------------
  function renderHoldingZone() {
    const hz = DOC.getElementById("holdingZone");
    if (!hz) return;

    const photos = Array.isArray(STORE.holdingZonePhotos)
      ? STORE.holdingZonePhotos.slice(0, 24)
      : [];

    hz.innerHTML = "";

    if (!photos.length) {
      hz.innerHTML =
        `<div class="small-note" style="opacity:.7;padding:.5rem 0;">
          No photos in holding zone yet.
        </div>`;
      return;
    }

    // horizontal filmstrip
    hz.style.display = "flex";
    hz.style.flexDirection = "row";
    hz.style.flexWrap = "nowrap";
    hz.style.gap = "10px";
    hz.style.overflowX = "auto";
    hz.style.overflowY = "hidden";
    hz.style.padding = "10px 0";
    hz.style.alignItems = "center";

    photos.forEach((src) => {
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
      hz.appendChild(img);
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

    btn.addEventListener("click", () => {
      const picked = Array.isArray(STORE._step1Selected)
        ? STORE._step1Selected.slice(0, 24)
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

      const images = Array.isArray(data.images) ? data.images : [];
      const grid = DOC.getElementById("step1Photos");
      if (!grid) return;

      grid.innerHTML = "";

      if (!images.length) {
        grid.innerHTML =
          `<div style="opacity:.75;padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:12px;">
            No images found.
          </div>`;
        return;
      }

      // reset selection for this boost
      STORE._step1Selected = [];

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
 STORE.step1Selected = [];

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
});

syncUI();
tile.appendChild(img);
tile.appendChild(badge);
grid.appendChild(tile);


  console.log("✅ APP READY");
})();
