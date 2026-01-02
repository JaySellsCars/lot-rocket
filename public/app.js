(async () => {

  const V = "10001";
  console.log("APPJS BOOT OK", V);

  // ✅ YOUR EXISTING CODE GOES BELOW
  // you can now safely use `await` anywhere in this file

  // example:
  // const data = await fetch("/api/test").then(r => r.json());

})();


/* /public/app.js (REPLACE ENTIRE FILE) — ROCKET-1 WIRED MVP (SAFE / DEDUPED) */
(() => {
  const V = "10001";
  // /public/app.js — ADD THIS NEAR THE TOP (after helpers $/q/on), ONCE
const API_BASE = ""; // same-origin when using Web Service (recommended)

// Replace your boost fetch with this exact line:
const r = await fetch(`${API_BASE}/api/boost?url=${encodeURIComponent(url)}`);

// Add this quick health probe (optional) — place inside DOMContentLoaded at start:
fetch(`${API_BASE}/api/health`)
  .then((res) => res.json())
  .then((j) => console.log("✅ API HEALTH", j))
  .catch((e) => console.warn("❌ API HEALTH FAIL", e));

  const DOC = document;

  // HARD BOOT GUARD (prevents double-loaded/cached copies)
  if (window.__LOTROCKET_APPJS_VERSION__ && window.__LOTROCKET_APPJS_VERSION__ !== V) return;
  window.__LOTROCKET_APPJS_VERSION__ = V;

  // prevent double init
  if (window.__LOTROCKET_BOOT_GUARD__) return;
  window.__LOTROCKET_BOOT_GUARD__ = true;

  const $ = (id) => DOC.getElementById(id);
  const q = (sel, root = DOC) => root.querySelector(sel);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  console.log("🧨 APPJS BOOT OK — v" + V, Date.now());

  // ---------- STORE ----------
  const STORE = (window.STORE = window.STORE || {});
  const asArr = (v) => (Array.isArray(v) ? v : []);
  STORE.lastBoostPhotos = asArr(STORE.lastBoostPhotos);
  STORE.holdingZonePhotos = asArr(STORE.holdingZonePhotos);
  STORE.socialReadyPhotos = asArr(STORE.socialReadyPhotos);

  // ---------- SAFE ----------
  const safe = (name, fn, ...args) => {
    try {
      if (typeof fn === "function") return fn(...args);
    } catch (e) {
      console.error("❌ " + name, e);
    }
  };

  // ---------- VISIBILITY / MODALS ----------
  const setHidden = (el, hidden) => {
    if (!el) return;
    el.classList.toggle("hidden", !!hidden);
    el.setAttribute("aria-hidden", hidden ? "true" : "false");
    // your modals also rely on display
    if (el.classList.contains("side-modal")) el.style.display = hidden ? "none" : "flex";
  };

  const showModal = (id) => setHidden($(id), false);
  const hideModal = (id) => setHidden($(id), true);

  // ---------- COPY ----------
  const copyText = async (txt) => {
    const text = (txt || "").toString();
    try {
      await navigator.clipboard.writeText(text);
      console.log("✅ COPIED");
      return true;
    } catch {
      try {
        const ta = DOC.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        DOC.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = DOC.execCommand("copy");
        ta.remove();
        console.log(ok ? "✅ COPIED" : "❌ COPY FAIL");
        return ok;
      } catch (e) {
        console.warn("❌ COPY FAIL", e);
        return false;
      }
    }
  };

  // ---------- OUTPUTS (textarea OR div) ----------
  function setOut(id, val) {
    const el = $(id);
    if (!el) return;
    const v = (val ?? "").toString();
    if ("value" in el) el.value = v;
    else el.textContent = v;
  }

  function getOut(id) {
    const el = $(id);
    if (!el) return "";
    return ("value" in el ? el.value : el.textContent) || "";
  }

  // ---------- STEP 1 PHOTO GRID (simple MVP render) ----------
  function renderStep1Photos(urls) {
    const grid =
      $("step1Photos") ||
      $("dealerPhotoGrid") ||
      $("photoGrid") ||
      q("#step1Photos, #dealerPhotoGrid, #photoGrid, .photo-grid");

    if (!grid) return;

    grid.innerHTML = "";
    (urls || []).forEach((u) => {
      const d = DOC.createElement("div");
      d.className = "photo";
      d.innerHTML = `<img src="${u}" alt="" style="width:100%;border-radius:12px;display:block" />`;
      grid.appendChild(d);
    });
  }

  // ---------- STEP 3 THUMBS (MVP) ----------
  function appendThumb(gridEl, url) {
    const wrap = DOC.createElement("div");
    wrap.className = "thumb";
    wrap.dataset.url = url;
    wrap.style.cursor = "pointer";
    wrap.style.position = "relative";
    wrap.innerHTML = `
      <img src="${url}" alt="" style="max-width:100%;border-radius:12px;display:block" />
      <div class="thumb-check" style="position:absolute;top:8px;right:8px;font-size:16px;display:none;">✅</div>
    `;
    on(wrap, "click", () => {
      const selected = wrap.classList.toggle("selected");
      const chk = q(".thumb-check", wrap);
      if (chk) chk.style.display = selected ? "block" : "none";
    });
    gridEl.appendChild(wrap);
  }

  function getSelectedThumbUrls() {
    const grid = $("creativeThumbGrid");
    if (!grid) return [];
    return Array.from(grid.querySelectorAll(".thumb.selected"))
      .map((d) => d.dataset.url)
      .filter(Boolean);
  }

  // ---------- SOCIAL READY STRIP (MVP) ----------
  function normalizeSocialReady() {
    STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
    STORE.socialReadyPhotos = STORE.socialReadyPhotos
      .map((p) => (typeof p === "string" ? { url: p, selected: false } : p))
      .filter((p) => p && p.url);
  }

  function renderSocialStrip() {
    normalizeSocialReady();
    const strip = $("socialCarousel");
    const preview = $("socialCarouselPreviewImg");
    const status = $("socialCarouselStatus");
    if (!strip) return;

    strip.innerHTML = "";
    const list = STORE.socialReadyPhotos;

    if (!list.length) {
      if (status) status.textContent = "No Social Ready photos yet.";
      if (preview) preview.removeAttribute("src");
      return;
    }

    let idx = list.findIndex((p) => p.selected);
    if (idx < 0) idx = 0;
    list.forEach((p, i) => (p.selected = i === idx));

    list.forEach((p, i) => {
      const t = DOC.createElement("button");
      t.type = "button";
      t.className = "social-thumb" + (p.selected ? " selected" : "");
      t.style.border = "none";
      t.style.background = "transparent";
      t.style.padding = "0";
      t.style.cursor = "pointer";
      t.innerHTML = `<img src="${p.url}" alt="" style="width:96px;height:64px;object-fit:cover;border-radius:10px;opacity:${
        p.selected ? 1 : 0.6
      }" />`;
      on(t, "click", () => {
        list.forEach((x) => (x.selected = false));
        list[i].selected = true;
        renderSocialStrip();
      });
      strip.appendChild(t);
    });

    const selected = list[idx];
    if (preview) preview.src = selected.url;
    if (status) status.textContent = `Showing ${idx + 1} of ${list.length}`;
  }

  function selectNext(delta) {
    normalizeSocialReady();
    const list = STORE.socialReadyPhotos;
    if (!list.length) return;
    let idx = list.findIndex((p) => p.selected);
    if (idx < 0) idx = 0;
    idx = (idx + delta + list.length) % list.length;
    list.forEach((p) => (p.selected = false));
    list[idx].selected = true;
    renderSocialStrip();
  }

  // ---------- ZIP DOWNLOAD (MVP using JSZip) ----------
  async function downloadZip() {
    normalizeSocialReady();
    const list = STORE.socialReadyPhotos;
    if (!list.length) return console.warn("🟡 No social-ready photos to zip");
    if (!window.JSZip) return console.warn("❌ JSZip not loaded");

    const zip = new window.JSZip();

    const toBlob = async (u) => {
      const res = await fetch(u);
      return await res.blob();
    };

    for (let i = 0; i < list.length; i++) {
      const u = list[i].url;
      try {
        const blob = await toBlob(u);
        const ext = (blob.type || "").includes("png") ? "png" : "jpg";
        zip.file(`social-ready-${String(i + 1).padStart(2, "0")}.${ext}`, blob);
      } catch (e) {
        console.warn("zip fetch fail:", u, e);
      }
    }

    const out = await zip.generateAsync({ type: "blob" });
    const a = DOC.createElement("a");
    a.href = URL.createObjectURL(out);
    a.download = "lotrocket-social-ready.zip";
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    console.log("✅ ZIP downloaded");
  }

  // ---------- BOOST (REAL if backend exists, fallback if not) ----------
  async function tryBackendBoost(url) {
    const endpoints = [
      `/api/boost?url=${encodeURIComponent(url)}`,
      `/api/scrape?url=${encodeURIComponent(url)}`,
      `/api/photos?url=${encodeURIComponent(url)}`,
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, { method: "GET" });
        if (!res.ok) continue;
        const data = await res.json().catch(() => null);
        if (!data) continue;

        const photos =
          data.photos ||
          data.images ||
          data.photoUrls ||
          (data.result && (data.result.photos || data.result.images)) ||
          [];

        const title =
          data.title ||
          (data.vehicle && (data.vehicle.title || data.vehicle.name)) ||
          (data.result && data.result.title) ||
          "";

        const price =
          data.price ||
          (data.vehicle && data.vehicle.price) ||
          (data.result && data.result.price) ||
          "";

        if (Array.isArray(photos) && photos.length) return { photos, title, price };
      } catch {}
    }
    return null;
  }

  async function handleBoost(urlOverride) {
    const url =
      (urlOverride ||
        ($("dealerUrlInput") && $("dealerUrlInput").value ? $("dealerUrlInput").value : "") ||
        ""
      ).trim();

    if (!url) return console.warn("🟡 Paste a URL first");

    console.log("🚀 BOOST:", url);

    const backend = await tryBackendBoost(url);

    let photos = [];
    let title = "";
    let price = "";

    if (backend && backend.photos?.length) {
      photos = backend.photos.slice(0, 24);
      title = backend.title || "";
      price = backend.price || "";
      console.log("✅ BACKEND BOOST OK — photos:", photos.length);
    } else {
      photos = [
        "https://picsum.photos/seed/lotrocket1/800/600",
        "https://picsum.photos/seed/lotrocket2/800/600",
        "https://picsum.photos/seed/lotrocket3/800/600",
        "https://picsum.photos/seed/lotrocket4/800/600",
        "https://picsum.photos/seed/lotrocket5/800/600",
        "https://picsum.photos/seed/lotrocket6/800/600",
      ];
      console.warn("🟠 BACKEND BOOST FAILED — using demo photos");
    }

    STORE.lastBoostPhotos = photos.slice();
    renderStep1Photos(STORE.lastBoostPhotos);

    // Seed creative thumbs
    const grid = $("creativeThumbGrid");
    if (grid) {
      grid.innerHTML = "";
      STORE.lastBoostPhotos.forEach((u) => appendThumb(grid, u));
    }

    // Seed outputs (safe if ids exist)
    const label = title || "Vehicle";
    const pr = price ? `\nPrice: ${price}\n` : "\n";
    setOut(
      "marketplaceOutput",
      `🚗 FOR SALE!\n\n${label}${pr}\nCheck it out here:\n${url}\n\nDM me “INFO” for details.`
    );
    setOut("hashtagOutput", `#LotRocket #CarGuy #DetroitCars #UsedCars #AutoSales #CarDeals`);
  }

  // ---------- POSTS ----------
  function newPost() {
    const url = ($("dealerUrlInput") && $("dealerUrlInput").value ? $("dealerUrlInput").value : "").trim();
    const post = `🚗🔥 JUST IN! This one won’t last long.

✅ Clean
✅ Ready to drive
✅ Easy buying process

Link: ${url || "[paste vehicle URL in Step 1]"}
DM me “INFO” and I’ll send numbers + availability.`;

    setOut("marketplaceOutput", post);
    console.log("🟢 New Post");
  }

  function newText() {
    const url = ($("dealerUrlInput") && $("dealerUrlInput").value ? $("dealerUrlInput").value : "").trim();
    const txt = `Hey! Still looking for a vehicle? I can help. ${
      url ? "Here’s one option: " + url : ""
    } Want payments or total price?`;
    setOut("hashtagOutput", txt);
    console.log("🟢 New Text");
  }

  // ---------- BUTTON WIRES (NON-ID FAILSAFE) ----------
  function wireCloseButtons() {
    DOC.querySelectorAll("[data-close]").forEach((btn) => {
      on(btn, "click", () => {
        const modal = btn.closest(".side-modal,.modal,[role='dialog']");
        if (!modal) return;
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        if (modal.classList.contains("side-modal")) modal.style.display = "none";
      });
    });

    on(DOC, "keydown", (e) => {
      if (e.key !== "Escape") return;
      DOC.querySelectorAll(".side-modal:not(.hidden)").forEach((m) => {
        m.classList.add("hidden");
        m.setAttribute("aria-hidden", "true");
        m.style.display = "none";
      });
    });
  }

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
    on(dz, "dragover", (e) => {
      e.preventDefault();
      dz.classList.add("drag");
    });
    on(dz, "dragleave", () => dz.classList.remove("drag"));
    on(dz, "drop", (e) => {
      e.preventDefault();
      dz.classList.remove("drag");
      handleFiles(e.dataTransfer && e.dataTransfer.files);
    });
  }

  function wireMVP() {
    // direct ids (if they exist)
    on($("boostBtn"), "click", () => handleBoost());
    on($("newPostBtn"), "click", newPost);
    on($("newTextBtn"), "click", newText);

    on($("copyPostBtn"), "click", () => copyText(getOut("marketplaceOutput")));
    on($("copyTextBtn"), "click", () => copyText(getOut("hashtagOutput")));

    on($("socialCarouselPrev"), "click", () => selectNext(-1));
    on($("socialCarouselNext"), "click", () => selectNext(1));

    on($("sendToSocialReady"), "click", () => {
      const selected = getSelectedThumbUrls();
      if (!selected.length) return console.warn("🟡 Select photos in Step 3 first");

      normalizeSocialReady();
      const existing = new Set(STORE.socialReadyPhotos.map((p) => p.url));

      selected.forEach((u) => {
        if (!existing.has(u)) STORE.socialReadyPhotos.push({ url: u, selected: false });
      });

      STORE.socialReadyPhotos.forEach((p) => (p.selected = false));
      const last = STORE.socialReadyPhotos[STORE.socialReadyPhotos.length - 1];
      if (last) last.selected = true;

      renderSocialStrip();
      console.log("✅ Added to Social Ready:", selected.length);
    });

    on($("downloadSocialReadyZip"), "click", downloadZip);

    // safe stubs (won’t crash if missing)
    on($("sendToDesignStudio"), "click", () => console.log("🟢 Send to Design Studio (stub)"));
    on($("autoEnhanceBtn"), "click", () => console.log("🟢 Auto Enhance (stub)"));
    on($("resetEditsBtn"), "click", () => console.log("🟢 Reset (stub)"));
  }

  // ==================================================
  // CLICK ROUTER (failsafe wiring) ✅
  // Works even if HTML changes later
  // ==================================================
  function armClickRouter() {
    if (window.__LR_CLICK_ROUTER__) return;
    window.__LR_CLICK_ROUTER__ = true;

    // Map right-side tool button labels -> modal ids
    const TOOL_MAP = {
      "objection coach": "objectionModal",
      "calculator": "calcModal",
      "payment calculator": "paymentModal",
      "income calculator": "incomeModal",
      "ai work flow expert": "workflowModal",
      "ai message builder": "messageModal",
      "ask a.i.": "askModal",
      "ask a.i": "askModal",
      "ask ai": "askModal",
      "ai car expert": "carModal",
      "ai image generation": "imageModal",
      "ai video generation": "videoModal",
    };

    DOC.addEventListener(
      "click",
      async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const id = btn.id || "";
        const label = (btn.textContent || "").trim().toLowerCase();

        // -------------------------
        // STEP 1 — BOOST
        // -------------------------
        if (id === "boostBtn" || label === "boost this listing" || label === "boost") {
          e.preventDefault();
          const urlEl = $("dealerUrlInput");
          const url = (urlEl?.value || "").trim();
          console.log("🚀 BOOST CLICK", { url });
          if (!url) return alert("Paste a vehicle URL first.");
          return handleBoost(url);
        }

        // -------------------------
        // RIGHT SIDE TOOLS (works for .floating-tools)
        // -------------------------
        if (btn.classList.contains("tool-button") || btn.closest(".floating-tools")) {
          const modalId = TOOL_MAP[label];
          if (modalId) {
            e.preventDefault();
            console.log("🧰 TOOL OPEN:", label, "->", modalId);
            showModal(modalId);
            btn.classList.add("active");
          }
          return;
        }

        // -------------------------
        // COPY (generic)
        // -------------------------
        if (label === "copy") {
          e.preventDefault();

          const wrap =
            btn.closest(".step2-card") ||
            btn.closest(".platform-card") ||
            btn.closest(".panel") ||
            btn.closest(".lab-card") ||
            DOC;

          const box = wrap.querySelector("textarea, .output");
          const txt = (box?.value ?? box?.textContent ?? "").trim();
          if (!txt) return;

          await copyText(txt);
          btn.classList.add("copied");
          setTimeout(() => btn.classList.remove("copied"), 700);
          return;
        }

        // -------------------------
        // NEW POST / NEW TEXT / NEW SET (generic)
        // -------------------------
        if (label === "new post") {
          e.preventDefault();
          if (typeof regenAllSocial === "function") return regenAllSocial();
          if (typeof generateSocialKit === "function") return generateSocialKit();
          // fallback MVP:
          return newPost();
        }

        if (label === "new text") {
          e.preventDefault();
          // fallback MVP:
          return newText();
        }

        if (label === "new set") {
          e.preventDefault();
          if (typeof generateHashtags === "function") return generateHashtags();
          // fallback MVP:
          setOut("hashtagOutput", `#LotRocket #CarGuy #DetroitCars #UsedCars #AutoSales #CarDeals`);
          return;
        }

        // Remove Emojis (safe/no-op placeholder if you don’t have handler)
        if (label === "remove emojis") {
          e.preventDefault();
          console.log("🟡 Remove Emojis (no handler wired yet)");
          return;
        }
      },
      true
    );

    console.log("✅ CLICK ROUTER ARMED");
  }

  function finalInit() {
    wireCloseButtons();
    wireDropZone();
    wireMVP();
    renderSocialStrip();
    armClickRouter();

    // legacy hooks (no crash)
    safe("wireAiModals", window.wireAiModals);
    safe("wireCalculatorPad", window.wireCalculatorPad);
    safe("wireIncomeCalcDirect", window.wireIncomeCalcDirect);

    console.log("✅ MVP WIRED");
  }

  DOC.addEventListener("DOMContentLoaded", () => {
    if (window.__LOTROCKET_BOOTED__) return;
    window.__LOTROCKET_BOOTED__ = true;
    console.log("✅ DOM READY");
    try {
      finalInit();
    } catch (e) {
      console.error("❌ FINAL INIT FAILED", e);
    }
  });
})();
