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

      // Demo fallback (replace later with real API)
      const demoImages = [
        "https://picsum.photos/600/400?1",
        "https://picsum.photos/600/400?2",
        "https://picsum.photos/600/400?3"
      ];

      const grid = document.getElementById("step1Photos");
      if (grid) {
        grid.innerHTML = "";
        demoImages.forEach(src => {
          const img = document.createElement("img");
          img.src = src;
          img.style.width = "100%";
          img.style.borderRadius = "12px";
          grid.appendChild(img);
        });
      }
    };
  }

  console.log("✅ APP READY");
})();
