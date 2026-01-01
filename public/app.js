// CLEAN BOOTSTRAP — SAFE START
(() => {
  const V = "10001";
  console.log("🧨 APPJS BOOT OK — v" + V);

  window.__LOTROCKET_APPJS_VERSION__ = V;

  document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ DOM READY");
  });
})();

