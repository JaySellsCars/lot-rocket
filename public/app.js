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
function renderHoldingZone() {
  const hz = document.getElementById("holdingZone");
  if (!hz) return;

  const photos = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];

  hz.innerHTML = "";

  if (!photos.length) {
    hz.innerHTML = `<div class="small-note" style="opacity:.7;padding:.5rem 0;">No photos in holding zone yet.</div>`;
    return;
  }

  // simple horizontal strip
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "10px";
  wrap.style.flexWrap = "wrap";
  wrap.style.padding = "10px 0";

  photos.forEach((u) => {
    const im = document.createElement("img");
    im.src = u;
    im.style.width = "120px";
    im.style.height = "80px";
    im.style.objectFit = "cover";
    im.style.borderRadius = "10px";
    im.style.border = "1px solid rgba(255,255,255,.15)";
    wrap.appendChild(im);
  });

  hz.appendChild(wrap);
}

  
  // ✅ Bind Step 1 "Send Selected" button ONCE (uses your real ID)
(() => {
  const btn = document.getElementById("sendToDesignStudio");
  if (!btn || btn.__LR_BOUND__) return;
  btn.__LR_BOUND__ = true;

  // keep visible
  btn.classList.remove("hidden");
  btn.style.display = "inline-flex";
  btn.style.visibility = "visible";
  btn.style.opacity = "1";

  btn.addEventListener("click", () => {
    const picked = Array.isArray(STORE._step1Selected) ? STORE._step1Selected : [];
    if (!picked.length) return alert("Select at least 1 photo first.");

    STORE.holdingZonePhotos = picked.slice(0, 24);
    STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

    if (typeof renderHoldingZone === "function") renderHoldingZone();

    const step3 = document.getElementById("creativeHub");
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

      // ==============================
      // SELECTION STATE (per boost)
      // click = select/deselect
      // confirm button sends to Step 3
      // ==============================
      const selected = new Set();

      const sendSelectedBtn =
        DOC.getElementById("sendSelectedToCreativeLab") ||
        DOC.getElementById("sendSelectedToStep3") ||
        DOC.getElementById("sendToCreativeStudio") ||
        DOC.getElementById("sendToHolding") ||
        DOC.getElementById("sendToDesignStudio"); // fallback

      // Bind once (prevents stacking listeners across boosts)
      if (sendSelectedBtn && !sendSelectedBtn.__LR_BOUND__) {
        sendSelectedBtn.__LR_BOUND__ = true;

       sendSelectedBtn.addEventListener("click", () => {
  const picked = Array.from(selected);
  if (!picked.length) return alert("Select at least 1 photo first.");

  STORE.holdingZonePhotos = picked.slice(0, 24);
  STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

if (typeof renderHoldingZone === "function") {
  renderHoldingZone();
} else {
  const hz = DOC.getElementById("holdingZone");
  if (hz) {
    hz.innerHTML = "";
    STORE.holdingZonePhotos.forEach((u) => {
      const im = DOC.createElement("img");
      im.src = u;
      im.style.width = "120px";
      im.style.height = "80px";
      im.style.objectFit = "cover";
      im.style.borderRadius = "10px";
      im.style.margin = "6px";
      hz.appendChild(im);
    });
  }
}

console.log("✅ SENT TO STEP 3:", picked.length);
});


          const step3 = DOC.getElementById("creativeHub");
          if (step3) step3.scrollIntoView({ behavior: "smooth" });

          console.log("✅ SENT TO STEP 3:", picked.length);
        });
      }

      // ==============================
      // RENDER STEP 1 (selectable tiles)
      // ==============================
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

        function syncUI() {
          const on = selected.has(src);
          badge.style.opacity = on ? "1" : "0";
          tile.style.outline = on ? "2px solid rgba(255,255,255,.35)" : "none";
        }

tile.addEventListener("click", () => {
  if (selected.has(src)) selected.delete(src);
  else selected.add(src);

  syncUI();

  STORE._step1Selected = Array.from(selected); // ✅ ADD THIS

  const countEl = DOC.getElementById("selectedCount");
  if (countEl) countEl.textContent = String(selected.size);
});


        // initial state
        syncUI();

        tile.appendChild(img);
        tile.appendChild(badge);
        grid.appendChild(tile);
      });
    };
  }

  console.log("✅ APP READY");
})();
