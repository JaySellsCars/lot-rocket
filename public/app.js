// /public/app.js  (REPLACE ENTIRE FILE)
(() => {
  const V = "10001";
  console.log("🧨 APPJS BOOT OK — v" + V, Date.now());
  document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ DOM READY");
    const app = document.getElementById("app");
    if (app) {
      app.insertAdjacentHTML(
        "beforeend",
        "<p style='margin-top:12px;color:lime'>✅ app.js executed</p>"
      );
    }
  });
})();
(() => {
  const V = "10001";
  console.log("🧨 APPJS BOOT OK — v" + V);

  window.__LOTROCKET_APPJS_VERSION__ = V;

  document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ DOM READY");
  });
})();

