// /public/app.js  — SINGLE SAFE BOOT FILE
(async () => {
  const V = "10001";
  console.log("🚀 APP BOOT OK —", V);

  const DOC = document;
  const $ = (id) => DOC.getElementById(id);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // --------------------------------------------------
  // SAFE GLOBAL STORE
  // --------------------------------------------------
  window.STORE = window.STORE || {};
  const STORE = window.STORE;

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
    const grid = document.getElementById("step1Photos");
    if (!grid) return;

    grid.innerHTML = "";

    if (!images.length) {
      grid.innerHTML =
        `<div style="opacity:.75;padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:12px;">
          No images found.
        </div>`;
      return;
    }

// ===== Selection state (inside onclick, before rendering) =====
const selected = new Set();


const sendBtn =
  document.getElementById("sendToHolding") ||
  document.getElementById("sendToCreativeStudio") ||
  document.getElementById("sendSelectedToStep3");

// ===== Render Step 1 images as selectable tiles =====
const MAX_UI = 24;
images.slice(0, MAX_UI).forEach((src) => {
  const tile = document.createElement("div");
  tile.style.position = "relative";
  tile.style.cursor = "pointer";
  tile.style.borderRadius = "12px";
  tile.style.overflow = "hidden";
  tile.style.border = "1px solid rgba(255,255,255,.12)";

  const img = document.createElement("img");
  img.src = src;
  img.loading = "lazy";
  img.decoding = "async";
  img.style.width = "100%";
  img.style.display = "block";

  const badge = document.createElement("div");
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
  badge.style.opacity = "0"; // hidden until selected
  badge.style.transition = "opacity .12s ease";

  function syncUI() {
    const on = selected.has(src);
    badge.style.opacity = on ? "1" : "0";
    tile.style.outline = on ? "2px solid rgba(255,255,255,.35)" : "none";
  }

  tile.addEventListener("click", () => {
    if (selected.has(src)) selected.delete(src);
    else selected.add(src);
    syncUI();

   
    const countEl = document.getElementById("selectedCount");
    if (countEl) countEl.textContent = String(selected.size);
  });

  tile.appendChild(img);
  tile.appendChild(badge);
  grid.appendChild(tile);
});

// ===== Confirm send to Step 3 =====
if (sendBtn) {
  sendBtn.onclick = () => {
    const picked = Array.from(selected);

    if (!picked.length) {
      alert("Select at least 1 photo first.");
      return;
    }

    
    window.STORE = window.STORE || {};
    STORE.holdingZonePhotos = picked.slice(0, 24);
    STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

    // If your Step 3 renderer exists, call it
    if (typeof renderHoldingZone === "function") {
      renderHoldingZone();
    } else {
      // fallback: render into #holdingZone if present
      const hz = document.getElementById("holdingZone");
      if (hz) {
        hz.innerHTML = "";
        STORE.holdingZonePhotos.forEach((u) => {
          const im = document.createElement("img");
          im.src = u;
          im.style.width = "120px";
          im.style.borderRadius = "10px";
          im.style.margin = "6px";
          hz.appendChild(im);
        });
      }
    }

  console.log("✅ SENT TO STEP 3:", picked.length);
};

console.log("✅ APP READY");
})();

