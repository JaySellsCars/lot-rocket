// /public/app.js  (REPLACE ENTIRE FILE WITH THIS — SINGLE COPY, NO DUPES)
(() => {
  const V = "10001";
  console.log("🧨 APPJS BOOT OK — v" + V, Date.now());

  const DOC = document;
  const $ = (id) => DOC.getElementById(id);
  const q = (sel, root = DOC) => root.querySelector(sel);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  window.__LAUNCH_MODE__ = "MVP";

  const STORE = (window.STORE = window.STORE || {});
  const asArr = (v) => (Array.isArray(v) ? v : []);
  STORE.lastBoostPhotos = asArr(STORE.lastBoostPhotos);
  STORE.holdingZonePhotos = asArr(STORE.holdingZonePhotos);
  STORE.socialReadyPhotos = asArr(STORE.socialReadyPhotos);

  const safe = (name, fn, ...args) => {
    try { if (typeof fn === "function") return fn(...args); }
    catch (e) { console.error("❌ " + name, e); }
  };

  const copyText = async (txt) => {
    const text = (txt || "").toString();
    try {
      await navigator.clipboard.writeText(text);
      console.log("✅ COPIED");
      return true;
    } catch {
      const ta = DOC.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      DOC.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = DOC.execCommand("copy");
      ta.remove();
      console.log(ok ? "✅ COPIED" : "❌ COPY FAIL");
      return ok;
    }
  };

  function setOut(id, val) {
    const el = $(id);
    if (el) el.value = val;
  }

  function appendThumb(gridEl, url) {
    const wrap = DOC.createElement("div");
    wrap.className = "thumb";
    wrap.innerHTML = `<img src="${url}" style="max-width:100%;border-radius:12px;display:block" />`;
    gridEl.appendChild(wrap);
  }

  function renderStep1Photos(urls) {
    const grid = $("step1Photos");
    if (!grid) return;
    grid.innerHTML = "";
    (urls || []).forEach((u) => {
      const d = DOC.createElement("div");
      d.className = "photo";
      d.innerHTML = `<img src="${u}" style="width:100%;border-radius:12px;display:block" />`;
      grid.appendChild(d);
    });
  }

  async function handleBoost() {
    const input = $("dealerUrlInput");
    const url = ((input && input.value) || "").trim();
    if (!url) return console.warn("🟡 Paste a URL first");

    console.log("🚀 BOOST:", url);

    const demo = [
      "https://picsum.photos/seed/lotrocket1/600/400",
      "https://picsum.photos/seed/lotrocket2/600/400",
      "https://picsum.photos/seed/lotrocket3/600/400",
      "https://picsum.photos/seed/lotrocket4/600/400",
      "https://picsum.photos/seed/lotrocket5/600/400",
      "https://picsum.photos/seed/lotrocket6/600/400",
    ];

    STORE.lastBoostPhotos = demo.slice();
    renderStep1Photos(STORE.lastBoostPhotos);

    const grid = $("creativeThumbGrid");
    if (grid) {
      grid.innerHTML = "";
      demo.forEach((u) => appendThumb(grid, u));
    }

    setOut("marketplaceOutput", `🚗 FOR SALE!\n\nCheck it out here:\n${url}\n\nDM me “INFO” for details.`);
    setOut("hashtagOutput", `#LotRocket #CarGuy #DetroitCars #UsedCars #AutoSales #CarDeals`);
  }

  function newPost() {
    const url = (($("dealerUrlInput") && $("dealerUrlInput").value) || "").trim();
    const post =
`🚗🔥 JUST IN! This one won’t last long.

✅ Clean
✅ Ready to drive
✅ Easy buying process

Link: ${url || "[paste vehicle URL in Step 1]"}
DM me “INFO” and I’ll send numbers + availability.`;
    setOut("marketplaceOutput", post);
    console.log("🟢 New Post");
  }

  function newText() {
    const url = (($("dealerUrlInput") && $("dealerUrlInput").value) || "").trim();
    const txt = `Hey! Still looking for a vehicle? I can help. ${url ? "Here’s one option: " + url : ""} Want payments or total price?`;
    setOut("hashtagOutput", txt);
    console.log("🟢 New Text");
  }

  function copyPost() { copyText((($("marketplaceOutput") && $("marketplaceOutput").value) || "")); }
  function copyTextOut() { copyText((($("hashtagOutput") && $("hashtagOutput").value) || "")); }

  function wireDropZone() {
    const dz = $("photoDropZone");
    const inp = $("photoFileInput");
    const grid = $("creativeThumbGrid");
    if (!dz || !inp || !grid) return;

    const handleFiles = (files) => {
      const arr = Array.from(files || []).filter(Boolean);
      if (!arr.length) return;
      arr.forEach((f) => {
        const u = URL.createObjectURL(f);
        STORE.holdingZonePhotos.push(u);
        appendThumb(grid, u);
      });
      console.log("🟢 Uploaded:", arr.length);
    };

    on(dz, "click", () => inp.click());
    on(inp, "change", () => handleFiles(inp.files));
    on(dz, "dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
    on(dz, "dragleave", () => dz.classList.remove("drag"));
    on(dz, "drop", (e) => { e.preventDefault(); dz.classList.remove("drag"); handleFiles(e.dataTransfer && e.dataTransfer.files); });
  }

  function wireCloseButtons() {
    DOC.querySelectorAll("[data-close]").forEach((btn) => {
      on(btn, "click", () => {
        const modal = btn.closest(".side-modal,.modal,[role='dialog']");
        if (modal) { modal.classList.add("hidden"); modal.setAttribute("aria-hidden", "true"); }
      });
    });
  }

  function wireToolWire() {
    const show = (id) => {
      const m = $(id);
      if (!m) return;
      m.classList.remove("hidden");
      m.setAttribute("aria-hidden", "false");
    };
    on($("toolIncomeBtn"), "click", () => show("incomeModal"));
    on($("toolPaymentBtn"), "click", () => show("paymentModal"));
    on($("toolAiBtn"), "click", () => show("aiToolsModal"));
  }

  function wireMVP() {
    on($("boostBtn"), "click", handleBoost);

    on($("newPostBtn"), "click", newPost);
    on($("newTextBtn"), "click", newText);

    on($("copyPostBtn"), "click", copyPost);
    on($("copyTextBtn"), "click", copyTextOut);

    on($("sendToDesignStudio"), "click", () => console.log("🟢 Send to Design Studio (stub)"));
    on($("sendToSocialReady"), "click", () => console.log("🟢 Send to Social Ready (stub)"));
    on($("autoEnhanceBtn"), "click", () => console.log("🟢 Auto Enhance (stub)"));
    on($("resetEditsBtn"), "click", () => console.log("🟢 Reset (stub)"));
  }

  DOC.addEventListener("DOMContentLoaded", () => {
    console.log("✅ DOM READY");
    wireCloseButtons();
    wireDropZone();
    wireToolWire();
    wireMVP();

    safe("wireAiModals", window.wireAiModals);
    safe("wireSideTools", window.wireSideTools);
    safe("wireCalculatorPad", window.wireCalculatorPad);
    safe("wireIncomeCalcDirect", window.wireIncomeCalcDirect);

    console.log("✅ MVP WIRED");
  });
})();
