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



const res = await fetch(`/api/boost?url=${encodeURIComponent(url)}`);
const data = await res.json();

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

// Optional: cap to 24 for UI sanity
const MAX_UI = 24;

images.slice(0, MAX_UI).forEach((src) => {
  const img = document.createElement("img");
  img.src = src;
  img.loading = "lazy";
  img.decoding = "async";
  img.style.width = "100%";
  img.style.borderRadius = "12px";
  grid.appendChild(img);
});




  console.log("✅ APP READY");
})();
