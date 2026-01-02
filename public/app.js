// /public/app.js  — SINGLE SAFE BOOT FILE (CLEAN / STABLE) v10001
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
  // STEP 1 SELECTION — SINGLE SOURCE OF TRUTH
  // ==================================================
  if (!Array.isArray(STORE.step1Selected)) STORE.step1Selected = [];

  if ("_step1Selected" in STORE) {
    console.warn("🧨 Removing legacy STORE._step1Selected");
    try { delete STORE._step1Selected; } catch (e) { STORE._step1Selected = undefined; }
  }
// ==================================================
// STEP 2 OUTPUT SETTERS
// ==================================================
function setVal(id, v) {
  const el = $(id);
  if (!el) return;
  el.value = (v ?? "").toString();
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderSummary(vehicle) {
  const out = $("summaryOutput");
  if (!out) return;

  const v = vehicle || {};
  out.innerHTML = `
    <div class="small-note" style="margin:.35rem 0;">
      <b>${(v.title || "").replace(/</g,"&lt;")}</b>
    </div>
    <div class="small-note">Price: <b>${v.price || "—"}</b> • Mileage: <b>${v.mileage || "—"}</b></div>
    <div class="small-note">VIN: <b>${v.vin || "—"}</b> • Stock: <b>${v.stock || "—"}</b></div>
    <div class="small-note">Ext/Int: <b>${v.exterior || "—"}</b> / <b>${v.interior || "—"}</b></div>
    <div class="small-note">Powertrain: <b>${v.engine || "—"}</b> • <b>${v.transmission || v.trans || "—"}</b></div>
  `;
}

async function aiPost(platform) {
  const vehicle = STORE.lastVehicle || {};
  const r = await fetch("/api/ai/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vehicle, platform }),
  });
  const j = await r.json();
if (!j?.ok) throw new Error(j?.error || "AI failed");

  return j.text || "";
}

function mapPlatformToTextarea(platform) {
  const m = {
    facebook: "fbOutput",
    instagram: "igOutput",
    tiktok: "ttOutput",
    linkedin: "liOutput",
    x: "xOutput",
    dm: "dmOutput",
    marketplace: "marketplaceOutput",
    hashtags: "hashtagsOutput",
  };
  return m[platform];
}

async function generateAllStep2() {
  const platforms = ["facebook","instagram","tiktok","linkedin","x","dm","marketplace","hashtags"];
  for (const p of platforms) {
    const id = mapPlatformToTextarea(p);
    if (!$(id)) continue;
    setVal(id, "Generating…");
    try {
      const text = await aiPost(p);
      setVal(id, text);
    } catch (e) {
      setVal(id, `AI ERROR: ${String(e?.message || e)}`);
    }
  }
}

function wireRegenButtons() {
  const wires = [
    ["fbNewBtn","facebook"],
    ["igNewBtn","instagram"],
    ["ttNewBtn","tiktok"],
    ["liNewBtn","linkedin"],
    ["xNewBtn","x"],
    ["dmNewBtn","dm"],
    ["mkNewBtn","marketplace"],
    ["hashNewBtn","hashtags"],
  ];

  wires.forEach(([btnId, platform]) => {
    const b = $(btnId);
    if (!b || b.__LR_BOUND__) return;
    b.__LR_BOUND__ = true;
    b.addEventListener("click", async () => {
      const outId = mapPlatformToTextarea(platform);
      if (!$(outId)) return;
      setVal(outId, "Generating…");
      try {
        const text = await aiPost(platform);
        setVal(outId, text);
      } catch (e) {
        setVal(outId, `AI ERROR: ${String(e?.message || e)}`);
      }
    });
  });
}
// PROMPT SLOTS (NEXT) — add these now so each AI tool has its own prompt later
// /public/app.js — ADD INSIDE IIFE (anywhere after STORE init)
STORE.aiPrompts = STORE.aiPrompts || {
  workflow: "YOU WILL SET THIS PROMPT NEXT",
  message: "YOU WILL SET THIS PROMPT NEXT",
  ask: "YOU WILL SET THIS PROMPT NEXT",
  car: "YOU WILL SET THIS PROMPT NEXT",
};

// ==================================================
// SIDE TOOLS — ONE WIRE PASS (NO DUPES)
// - AI Image / AI Video hidden for now (next version)
// - Opens side-modals by ID
// - Close via [data-close] or .side-modal-close or ESC or backdrop click
// ==================================================
(function wireSideTools() {
  if (window.__LR_SIDE_TOOLS_WIRED__) return;
  window.__LR_SIDE_TOOLS_WIRED__ = true;

  const byId = (id) => DOC.getElementById(id);

  const TOOL_BTN_IDS = {
    objection: "toolObjectionBtn",
    calc: "toolCalcBtn",
    payment: "toolPaymentBtn",
    income: "toolIncomeBtn",

    workflow: "toolWorkflowBtn",
    message: "toolMessageBtn",
    ask: "toolAskBtn",
    car: "toolCarBtn",

    image: "toolImageBtn", // HIDDEN (next version)
    video: "toolVideoBtn", // HIDDEN (next version)
  };

  // Map tool -> modalId in your HTML
  // ✅ change modal IDs here ONLY if yours differ
  const TOOL_MODAL = {
    objection: "objectionModal",
    calc: "calcModal",
    payment: "paymentModal",
    income: "incomeModal",

    workflow: "workflowModal",
    message: "messageModal",
    ask: "askModal",
    car: "carExpertModal",

    image: "imageGenModal",
    video: "videoGenModal",
  };

  // Hide Image/Video (next version)
  [TOOL_BTN_IDS.image, TOOL_BTN_IDS.video].forEach((id) => {
    const b = byId(id);
    if (b) b.style.display = "none";
  });

  const allBtnIds = Object.values(TOOL_BTN_IDS).filter(Boolean);

  function setActive(btnId) {
    allBtnIds.forEach((id) => {
      const b = byId(id);
      if (b) b.classList.toggle("active", id === btnId);
    });
  }

  function closeAllModals() {
    Object.values(TOOL_MODAL).forEach((mid) => {
      const m = byId(mid);
      if (!m) return;
      m.classList.add("hidden");
      m.style.display = "none";
      m.setAttribute("aria-hidden", "true");
    });
    setActive(null);
  }

  function openModal(modalId, btnId) {
    const m = byId(modalId);
    if (!m) return console.warn("Modal missing:", modalId);

    closeAllModals();

    m.classList.remove("hidden");
    m.style.display = "flex";
    m.setAttribute("aria-hidden", "false");

    if (btnId) setActive(btnId);

    // autofocus if any input/textarea exists
    const focusEl =
      m.querySelector("textarea") ||
      m.querySelector("input:not([type='hidden'])") ||
      m.querySelector("button");
    if (focusEl) setTimeout(() => focusEl.focus(), 0);
  }

  // Close wiring (once)
  function wireModalClose(m) {
    if (!m || m.__LR_CLOSE_WIRED__) return;
    m.__LR_CLOSE_WIRED__ = true;

    // close buttons
    m.querySelectorAll("[data-close], .side-modal-close, .modal-close-btn").forEach((btn) => {
      if (btn.__LR_BOUND__) return;
      btn.__LR_BOUND__ = true;
      btn.addEventListener("click", () => closeAllModals());
    });

    // backdrop click closes
    m.addEventListener("click", (e) => {
      if (e.target === m) closeAllModals();
    });
  }

  // Wire all modals close behavior
  Object.values(TOOL_MODAL).forEach((mid) => wireModalClose(byId(mid)));

  // ESC closes
  DOC.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });

  // Button click opens mapped modal
  function bindTool(toolKey) {
    const btnId = TOOL_BTN_IDS[toolKey];
    const modalId = TOOL_MODAL[toolKey];
    const b = byId(btnId);
    if (!b || b.__LR_BOUND__) return;
    b.__LR_BOUND__ = true;

    b.addEventListener("click", () => {
      const m = byId(modalId);
      const isOpen = m && !m.classList.contains("hidden") && m.style.display !== "none";
      if (isOpen) return closeAllModals();
      openModal(modalId, btnId);
    });
  }

  Object.keys(TOOL_BTN_IDS).forEach(bindTool);

  // expose for other modules
  window.LR_TOOLS = { openModal, closeAllModals };

  console.log("✅ SIDE TOOLS WIRED");
})();

  // ==================================================
  // SOCIAL READY STORE (LOCKED DOWNLOAD)
  // STORE.socialReadyPhotos = [{ url, locked, selected }]
  // ==================================================
  function normalizeSocialReady() {
    if (!Array.isArray(STORE.socialReadyPhotos)) STORE.socialReadyPhotos = [];
    STORE.socialReadyPhotos = STORE.socialReadyPhotos
      .filter(Boolean)
      .map((p) => {
        if (typeof p === "string") return { url: p, locked: true, selected: false };
        return {
          url: p.url || p.src || "",
          locked: !!p.locked,
          selected: !!p.selected,
        };
      })
      .filter((p) => !!p.url);

    // dedupe by url
    const seen = new Set();
    STORE.socialReadyPhotos = STORE.socialReadyPhotos.filter((p) => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    });

    // cap 24
    STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(0, 24);

    // ensure one selected (if any)
    if (STORE.socialReadyPhotos.length && !STORE.socialReadyPhotos.some((p) => p.selected)) {
      STORE.socialReadyPhotos[0].selected = true;
    }
  }

  function getSelectedSocialIndex() {
    normalizeSocialReady();
    return Math.max(0, STORE.socialReadyPhotos.findIndex((p) => p.selected));
  }

  function setSelectedSocialIndex(idx) {
    normalizeSocialReady();
    if (!STORE.socialReadyPhotos.length) return;
    const clamped = Math.max(0, Math.min(idx, STORE.socialReadyPhotos.length - 1));
    STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p, i) => ({ ...p, selected: i === clamped }));
  }

  function addToSocialReady(url, lock = true) {
    if (!url) return false;
    normalizeSocialReady();

    // deselect all
    STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p) => ({ ...p, selected: false }));

    const i = STORE.socialReadyPhotos.findIndex((p) => p.url === url);
    if (i !== -1) {
      STORE.socialReadyPhotos[i].selected = true;
      if (lock) STORE.socialReadyPhotos[i].locked = true;
      renderSocialStrip();
      return true;
    }

    STORE.socialReadyPhotos.unshift({
      url,
      locked: !!lock,
      selected: true,
    });

    STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(0, 24);
    renderSocialStrip();
    return true;
  }

  function renderSocialStrip() {
    normalizeSocialReady();

    const stripEl = $("socialCarousel");
    const previewEl = $("socialCarouselPreviewImg");
    const statusEl = $("socialCarouselStatus");

    if (!stripEl) return;

    stripEl.innerHTML = "";

    const list = STORE.socialReadyPhotos || [];
    const sel = list.find((p) => p.selected) || list[0];

    if (previewEl) {
      previewEl.src = sel?.url || "";
    }

    if (statusEl) {
      const lockedCount = list.filter((p) => p.locked).length;
      statusEl.textContent = list.length
        ? `Selected: ${list.findIndex((p) => p.selected) + 1}/${list.length} • Locked: ${lockedCount}`
        : "No Social Ready photos yet.";
    }

    list.forEach((p, idx) => {
      const btn = DOC.createElement("button");
      btn.type = "button";
      btn.className = "social-thumb-btn";
      btn.style.position = "relative";

      const img = DOC.createElement("img");
      img.src = p.url;
      img.loading = "lazy";
      img.decoding = "async";

      // lock badge
      const lock = DOC.createElement("div");
      lock.className = "social-lock";
      lock.textContent = p.locked ? "🔒" : "🔓";
      lock.title = "Click to lock/unlock";

      // selected ring
      if (p.selected) {
        btn.style.outline = "2px solid rgba(56,189,248,.95)";
        btn.style.outlineOffset = "0px";
      }

      // CLICK: select
      btn.addEventListener("click", () => {
        setSelectedSocialIndex(idx);
        renderSocialStrip();
      });

      // DOUBLE CLICK: toggle lock
      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        normalizeSocialReady();
        const cur = STORE.socialReadyPhotos[idx];
        if (!cur) return;
        cur.locked = !cur.locked;
        renderSocialStrip();
      });

      btn.appendChild(img);
      btn.appendChild(lock);
      stripEl.appendChild(btn);
    });
  }

  // prev/next
  function wireSocialNav() {
    const prevBtn = $("socialCarouselPrev");
    const nextBtn = $("socialCarouselNext");
    if (prevBtn && !prevBtn.__LR_BOUND__) {
      prevBtn.__LR_BOUND__ = true;
      prevBtn.addEventListener("click", () => {
        const i = getSelectedSocialIndex();
        setSelectedSocialIndex(i - 1);
        renderSocialStrip();
      });
    }
    if (nextBtn && !nextBtn.__LR_BOUND__) {
      nextBtn.__LR_BOUND__ = true;
      nextBtn.addEventListener("click", () => {
        const i = getSelectedSocialIndex();
        setSelectedSocialIndex(i + 1);
        renderSocialStrip();
      });
    }
  }

  // download locked photos only
  async function downloadLockedZip() {
    normalizeSocialReady();
    const locked = (STORE.socialReadyPhotos || []).filter((p) => p.locked).slice(0, 24);

    if (!locked.length) {
      alert("Lock at least 1 photo first.");
      return;
    }

    if (!window.JSZip) {
      alert("JSZip not loaded.");
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder("lot-rocket");

    let ok = 0;

    for (let i = 0; i < locked.length; i++) {
      const url = locked[i].url;
      try {
        const r = await fetch(url);
        const blob = await r.blob();

        // extension guess
        const ext =
          (blob.type && blob.type.includes("png")) ? "png" :
          (blob.type && blob.type.includes("webp")) ? "webp" :
          (blob.type && blob.type.includes("jpeg")) ? "jpg" : "jpg";

        folder.file(`photo_${String(i + 1).padStart(2, "0")}.${ext}`, blob);
        ok++;
      } catch (e) {
        console.warn("ZIP skip (fetch failed):", url);
      }
    }

    if (!ok) {
      alert("Could not fetch images to zip (CORS).");
      return;
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const a = DOC.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lot-rocket-social-ready.zip";
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  function wireZipButton() {
    const btn = $("downloadZipBtn");
    if (!btn || btn.__LR_BOUND__) return;
    btn.__LR_BOUND__ = true;
    btn.addEventListener("click", downloadLockedZip);
  }

  // allow Step 3 button to push currently selected Step 1 picks into Social Ready (optional)
  function wireSendSelectedToSocialReady() {
    const btn = $("sendSelectedToSocialReady");
    if (!btn || btn.__LR_BOUND__) return;
    btn.__LR_BOUND__ = true;
    btn.addEventListener("click", () => {
      const picked = Array.isArray(STORE.step1Selected) ? STORE.step1Selected.slice(0, 24) : [];
      if (!picked.length) return alert("Select at least 1 photo first.");
      picked.forEach((u) => addToSocialReady(u, true));
      renderSocialStrip();
    });
  }

  // --------------------------------------------------
  // STEP 3: HOLDING ZONE RENDER (up to 24) + DBLCLICK → SOCIAL READY
  // --------------------------------------------------
  function renderHoldingZone() {
    const hz = $("holdingZone");
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

    photos.forEach((src) => {
      const img = DOC.createElement("img");
      img.src = src;
      img.loading = "lazy";
      img.decoding = "async";

      // ✅ DBLCLICK → add + lock in Social Ready
      img.addEventListener("dblclick", (e) => {
        e.preventDefault();
        addToSocialReady(src, true);
        console.log("🔒 ADDED TO SOCIAL READY:", src);
      });

      hz.appendChild(img);
    });
  }

  // --------------------------------------------------
  // STEP 1: SEND SELECTED → STEP 3 (bind ONCE)
  // Uses ID: #sendToDesignStudio
  // --------------------------------------------------
  function syncSendBtn() {
    const btn = $("sendToDesignStudio");
    if (!btn) return;
    const n = Array.isArray(STORE.step1Selected) ? STORE.step1Selected.length : 0;
    btn.disabled = n === 0;
    btn.style.opacity = n === 0 ? "0.55" : "1";
    btn.style.pointerEvents = n === 0 ? "none" : "auto";
  }

  (() => {
    const btn = $("sendToDesignStudio");
    if (!btn || btn.__LR_BOUND__) return;
    btn.__LR_BOUND__ = true;

    btn.classList.remove("hidden");
    btn.style.display = "inline-flex";
    btn.style.visibility = "visible";
    btn.style.opacity = "1";

    syncSendBtn();

    btn.addEventListener("click", () => {
      const picked = Array.isArray(STORE.step1Selected)
        ? STORE.step1Selected.slice(0, 24)
        : [];

      if (!picked.length) return alert("Select at least 1 photo first.");

      STORE.holdingZonePhotos = picked.slice(0, 24);
      STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

      renderHoldingZone();

      const step3 = $("creativeHub");
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
// ✅ vehicle details
STORE.lastVehicle = data.vehicle || { url };
STORE.lastVehicle.url = STORE.lastVehicle.url || url;

renderSummary(STORE.lastVehicle);

// ✅ auto-generate Step 2
wireRegenButtons();
generateAllStep2();

      const rawImages = Array.isArray(data.images) ? data.images : [];
      const images = [...new Set(rawImages)].filter(Boolean);

      const grid = $("step1Photos");
      if (!grid) return;

      grid.innerHTML = "";

      if (!images.length) {
        grid.innerHTML =
          `<div style="opacity:.75;padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:12px;">
            No images found.
          </div>`;
        return;
      }

      // ✅ reset selection for this boost
      STORE.step1Selected = [];
      syncSendBtn();

      const countEl = $("selectedCount");
      if (countEl) countEl.textContent = "0";

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
          syncSendBtn();
          if (countEl) countEl.textContent = String(STORE.step1Selected.length);
        });

        syncUI();
        tile.appendChild(img);
        tile.appendChild(badge);
        grid.appendChild(tile);
      });
    };
  }

  // --------------------------------------------------
  // SOCIAL READY WIRES (ONE PASS)
  // --------------------------------------------------
  wireSocialNav();
  wireZipButton();
  wireSendSelectedToSocialReady();
  renderSocialStrip();
// /public/app.js — ADD THIS AT THE VERY END (right before console.log("✅ APP READY"); is fine)
// ensures modals are closable + wires exist even if DOM changes later
if (window.LR_TOOLS && typeof window.LR_TOOLS.closeAllModals === "function") {
  window.LR_TOOLS.closeAllModals();
}

  console.log("✅ APP READY");
})();
