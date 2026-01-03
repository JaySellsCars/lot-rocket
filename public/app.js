// /public/app.js  — SINGLE SAFE BOOT FILE (CLEAN / STABLE) v10001
(async () => {
  const V = "10001";
  console.log("🚀 APP BOOT OK —", V);

  const DOC = document;
  const $ = (id) => DOC.getElementById(id);

  window.STORE = window.STORE || {};
  const STORE = window.STORE;

  // ==================================================
  // UI FX HELPERS (PRESS + LOADING)
  // ==================================================
  function pressAnim(el) {
    if (!el) return;
    el.classList.remove("lr-press");
    void el.offsetWidth;
    el.classList.add("lr-press");
    setTimeout(() => el.classList.remove("lr-press"), 220);
  }

  function setBtnLoading(btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.__LR_OLD_TEXT__ = btn.__LR_OLD_TEXT__ ?? btn.textContent;
      if (label) btn.textContent = label;
      btn.disabled = true;
      btn.classList.add("lr-loading");
    } else {
      btn.textContent = btn.__LR_OLD_TEXT__ || btn.textContent;
      btn.disabled = false;
      btn.classList.remove("lr-loading");
    }
  }
function normalizeDealerUrl(raw) {
  let s = (raw || "").trim();

  // kill weird copy/paste prefixes like "whttps://"
  s = s.replace(/^w+https?:\/\//i, "https://");
  s = s.replace(/^w+https?:/i, "https:");

  // remove accidental duplicates like "https://https://"
  s = s.replace(/^https?:\/\/https?:\/\//i, "https://");

  // if someone pasted "www.site.com/..." without scheme
  if (!/^https?:\/\//i.test(s) && /^www\./i.test(s)) s = "https://" + s;

  // strip spaces
  s = s.replace(/\s+/g, "");

  // final sanity: if it STILL doesn’t start with http, reject
  if (!/^https?:\/\//i.test(s)) return "";
  return s;
}
function normalizeDealerUrl(raw) {
  let s = String(raw || "").trim();

  // remove quotes/spaces
  s = s.replace(/^["']|["']$/g, "").trim();

  // fix common bad paste: whttps:// or whttp://
  s = s.replace(/^whttps?:\/\//i, (m) => m.slice(1)); // remove leading "w"

  // fix double protocol paste: https://https://...
  s = s.replace(/^(https?:\/\/)(https?:\/\/)/i, "$2");

  // if user pasted "www." only
  if (/^www\./i.test(s)) s = "https://" + s;

  // if missing protocol entirely
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;

  return s;
}

  // ==================================================
  // STEP 1 SELECTION — SINGLE SOURCE OF TRUTH
  // ==================================================
  if (!Array.isArray(STORE.step1Selected)) STORE.step1Selected = [];
  if ("_step1Selected" in STORE) {
    console.warn("🧨 Removing legacy STORE._step1Selected");
    try { delete STORE._step1Selected; } catch (e) { STORE._step1Selected = undefined; }
  }
  STORE.step1Selected = Array.isArray(STORE.step1Selected) ? STORE.step1Selected : [];
  STORE.holdingZonePhotos = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];

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
        <b>${(v.title || "").replace(/</g, "&lt;")}</b>
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
    const platforms = ["facebook", "instagram", "tiktok", "linkedin", "x", "dm", "marketplace", "hashtags"];
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
      ["fbNewBtn", "facebook"],
      ["igNewBtn", "instagram"],
      ["ttNewBtn", "tiktok"],
      ["liNewBtn", "linkedin"],
      ["xNewBtn", "x"],
      ["dmNewBtn", "dm"],
      ["mkNewBtn", "marketplace"],
      ["hashNewBtn", "hashtags"],
    ];

    wires.forEach(([btnId, platform]) => {
      const b = $(btnId);
      if (!b || b.__LR_BOUND__) return;
      b.__LR_BOUND__ = true;

      b.addEventListener("click", async () => {
        pressAnim(b);
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

  // ==================================================
  // PROMPT SLOTS (NEXT) — per AI tool
  // ==================================================
  STORE.aiPrompts = STORE.aiPrompts || {
    workflow: "YOU WILL SET THIS PROMPT NEXT",
    message: "YOU WILL SET THIS PROMPT NEXT",
    ask: "YOU WILL SET THIS PROMPT NEXT",
    car: "YOU WILL SET THIS PROMPT NEXT",
  };

  // ==================================================
  // FLOATING TOOLS WIRING ✅ (ONE TRUE BLOCK)
  // Image/Video tools hidden for v1.
  // ==================================================
  (function wireFloatingTools() {
    if (window.__LR_FLOATING_TOOLS__) return;
    window.__LR_FLOATING_TOOLS__ = true;

    const byId = (id) => DOC.getElementById(id);

    const BTN = {
      objection: "toolObjectionBtn",
      calc: "toolCalcBtn",
      payment: "toolPaymentBtn",
      income: "toolIncomeBtn",
      workflow: "toolWorkflowBtn",
      message: "toolMessageBtn",
      ask: "toolAskBtn",
      car: "toolCarBtn",
      image: "toolImageBtn",
      video: "toolVideoBtn",
    };

    const MODAL = {
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

    [BTN.image, BTN.video].forEach((id) => {
      const b = byId(id);
      if (b) b.style.display = "none";
    });

    const allBtnIds = Object.values(BTN);

    function setActive(btnId) {
      allBtnIds.forEach((id) => {
        const b = byId(id);
        if (b) b.classList.toggle("active", id === btnId);
      });
    }

    function closeModal(modalId) {
      const m = byId(modalId);
      if (!m) return;
      m.classList.add("hidden");
      m.style.display = "none";
      m.setAttribute("aria-hidden", "true");
    }

    function closeAll() {
      Object.values(MODAL).forEach(closeModal);
      setActive(null);
    }

    function openModal(modalId, btnId) {
      const m = byId(modalId);
      if (!m) return console.warn("Modal missing:", modalId);

      closeAll();

      m.classList.remove("hidden");
      m.style.display = "flex";
      m.setAttribute("aria-hidden", "false");
      setActive(btnId);

      if (!m.__LR_CLOSE_WIRED__) {
        m.__LR_CLOSE_WIRED__ = true;

        m.querySelectorAll("[data-close], .side-modal-close, .modal-close-btn").forEach((x) => {
          if (x.__LR_BOUND__) return;
          x.__LR_BOUND__ = true;
          x.addEventListener("click", closeAll);
        });

        m.addEventListener("click", (e) => {
          if (e.target === m) closeAll();
        });
      }

      const focusEl =
        m.querySelector("textarea") ||
        m.querySelector("input:not([type='hidden'])") ||
        m.querySelector("button");
      if (focusEl) setTimeout(() => focusEl.focus(), 0);
    }

    DOC.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });

    function bind(key) {
      const btnId = BTN[key];
      const modalId = MODAL[key];
      const b = byId(btnId);
      if (!b || b.__LR_BOUND__) return;
      b.__LR_BOUND__ = true;

      b.addEventListener("click", () => {
        pressAnim(b);
        const m = byId(modalId);
        const isOpen = m && !m.classList.contains("hidden") && m.style.display !== "none";
        if (isOpen) return closeAll();
        openModal(modalId, btnId);
      });
    }

    Object.keys(BTN).forEach(bind);
    window.LR_TOOLS = { openModal, closeAll };
    console.log("✅ FLOATING TOOLS WIRED");
  })();
// ==================================================
// AI EXPERT WIRES — ONE PASS (OBJECTION, MESSAGE, WORKFLOW, ASK, CAR)
// ==================================================
(function wireAiExperts() {
  if (window.__LR_AI_EXPERTS__) return;
  window.__LR_AI_EXPERTS__ = true;

  const byId = (id) => document.getElementById(id);

  async function runAI({ btnId, inputId, outputId, endpoint }) {
    const btn = byId(btnId);
    const input = byId(inputId);
    const output = byId(outputId);
    if (!btn || !input || !output) return;

    if (btn.__LR_BOUND__) return;
    btn.__LR_BOUND__ = true;

    btn.addEventListener("click", async () => {
      const text = (input.value || "").trim();
      if (!text) {
        output.textContent = "Enter input first.";
        return;
      }

      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "Working…";
      output.textContent = "Thinking…";

      try {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: text,
            vehicle: window.STORE?.lastVehicle || {},
          }),
        });
        const j = await r.json();
        if (!j?.ok) throw new Error(j?.error || "AI failed");
        output.textContent = j.text || "";
      } catch (e) {
        output.textContent = "AI ERROR: " + (e?.message || e);
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    });
  }

  runAI({
    btnId: "runObjectionBtn",
    inputId: "objectionInput",
    outputId: "objectionOutput",
    endpoint: "/api/ai/objection",
  });

  runAI({
    btnId: "runMessageBtn",
    inputId: "messageInput",
    outputId: "messageOutput",
    endpoint: "/api/ai/message",
  });

  runAI({
    btnId: "runWorkflowBtn",
    inputId: "workflowInput",
    outputId: "workflowOutput",
    endpoint: "/api/ai/workflow",
  });

  runAI({
    btnId: "runAskBtn",
    inputId: "askInput",
    outputId: "askOutput",
    endpoint: "/api/ai/ask",
  });

  runAI({
    btnId: "runCarExpertBtn",
    inputId: "carExpertInput",
    outputId: "carExpertOutput",
    endpoint: "/api/ai/car",
  });

  console.log("✅ AI EXPERTS WIRED");
})();

  // ==================================================
  // HIDE "Send Selected to Social Ready" (next version)
  // ==================================================
  (function hideNextVersionButtons() {
    const b = $("sendSelectedToSocialReady");
    if (b) b.style.display = "none";
  })();

  // ==================================================
  // SOCIAL READY STORE (LOCK + ORDER + PROXY ZIP)
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

    const seen = new Set();
    STORE.socialReadyPhotos = STORE.socialReadyPhotos.filter((p) => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    });

    STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(0, 24);

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

    STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p) => ({ ...p, selected: false }));

    const i = STORE.socialReadyPhotos.findIndex((p) => p.url === url);
    if (i !== -1) {
      STORE.socialReadyPhotos[i].selected = true;
      if (lock) STORE.socialReadyPhotos[i].locked = true;
      renderSocialStrip();
      return true;
    }

    STORE.socialReadyPhotos.unshift({ url, locked: !!lock, selected: true });
    STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(0, 24);
    renderSocialStrip();
    return true;
  }

  function moveSocial(fromIdx, toIdx) {
    normalizeSocialReady();
    const list = STORE.socialReadyPhotos;
    if (!list.length) return;
    const from = Math.max(0, Math.min(fromIdx, list.length - 1));
    const to = Math.max(0, Math.min(toIdx, list.length - 1));
    if (from === to) return;

    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);

    // keep selection on the moved item
    list.forEach((p) => (p.selected = false));
    item.selected = true;

    STORE.socialReadyPhotos = list;
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

    if (previewEl) previewEl.src = sel?.url || "";

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
      btn.draggable = true;
      btn.dataset.idx = String(idx);

      const img = DOC.createElement("img");
      img.src = p.url;
      img.loading = "lazy";
      img.decoding = "async";

      const lock = DOC.createElement("div");
      lock.className = "social-lock";
      lock.textContent = p.locked ? "🔒" : "🔓";
      lock.title = "Double-click to lock/unlock";

      if (p.selected) {
        btn.style.outline = "2px solid rgba(56,189,248,.95)";
        btn.style.outlineOffset = "0px";
      }

      // select
      btn.addEventListener("click", () => {
        setSelectedSocialIndex(idx);
        renderSocialStrip();
      });

      // lock toggle
      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        normalizeSocialReady();
        const cur = STORE.socialReadyPhotos[idx];
        if (!cur) return;
        cur.locked = !cur.locked;
        renderSocialStrip();
      });

      // drag reorder
      btn.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(idx));
        btn.classList.add("dragging");
      });
      btn.addEventListener("dragend", () => btn.classList.remove("dragging"));

      btn.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      btn.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData("text/plain") || "-1", 10);
        const to = idx;
        if (Number.isFinite(from) && from >= 0) {
          moveSocial(from, to);
          renderSocialStrip();
        }
      });

      btn.appendChild(img);
      btn.appendChild(lock);
      stripEl.appendChild(btn);
    });
  }

  function wireSocialNav() {
    const prevBtn = $("socialCarouselPrev");
    const nextBtn = $("socialCarouselNext");
    if (prevBtn && !prevBtn.__LR_BOUND__) {
      prevBtn.__LR_BOUND__ = true;
      prevBtn.addEventListener("click", () => {
        pressAnim(prevBtn);
        const i = getSelectedSocialIndex();
        setSelectedSocialIndex(i - 1);
        renderSocialStrip();
      });
    }
    if (nextBtn && !nextBtn.__LR_BOUND__) {
      nextBtn.__LR_BOUND__ = true;
      nextBtn.addEventListener("click", () => {
        pressAnim(nextBtn);
        const i = getSelectedSocialIndex();
        setSelectedSocialIndex(i + 1);
        renderSocialStrip();
      });
    }
  }

  // ✅ ZIP (FIX): fetch via same-origin proxy to avoid CORS
  async function downloadLockedZip() {
    normalizeSocialReady();
    const locked = (STORE.socialReadyPhotos || []).filter((p) => p.locked).slice(0, 24);

    if (!locked.length) return alert("Lock at least 1 photo first.");
    if (!window.JSZip) return alert("JSZip not loaded.");

    const zipBtn = $("downloadZipBtn");
    setBtnLoading(zipBtn, true, "Zipping…");

    try {
      const zip = new JSZip();
      const folder = zip.folder("lot-rocket");
      let ok = 0;

      for (let i = 0; i < locked.length; i++) {
        const url = locked[i].url;

        try {
          const prox = `/api/proxy?url=${encodeURIComponent(url)}`;
          const r = await fetch(prox);
          if (!r.ok) throw new Error("proxy fetch failed");
          const blob = await r.blob();

          const ext =
            (blob.type && blob.type.includes("png")) ? "png" :
            (blob.type && blob.type.includes("webp")) ? "webp" :
            (blob.type && blob.type.includes("jpeg")) ? "jpg" :
            (blob.type && blob.type.includes("gif")) ? "gif" : "jpg";

          folder.file(`photo_${String(i + 1).padStart(2, "0")}.${ext}`, blob);
          ok++;
        } catch (e) {
          console.warn("ZIP skip:", url, e);
        }
      }

      if (!ok) return alert("Could not fetch images to zip.");

      const out = await zip.generateAsync({ type: "blob" });
      const a = DOC.createElement("a");
      a.href = URL.createObjectURL(out);
      a.download = "lot-rocket-social-ready.zip";
      DOC.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    } finally {
      setBtnLoading(zipBtn, false);
    }
  }

  function wireZipButton() {
    const btn = $("downloadZipBtn");
    if (!btn || btn.__LR_BOUND__) return;
    btn.__LR_BOUND__ = true;
    btn.addEventListener("click", () => {
      pressAnim(btn);
      downloadLockedZip();
    });
  }

  // --------------------------------------------------
  // STEP 3: HOLDING ZONE NOTE + RENDER (up to 24) + DBLCLICK → SOCIAL READY
  // --------------------------------------------------
  function ensureHoldingNote() {
    const hz = $("holdingZone");
    if (!hz) return;

    let note = $("holdingZoneNote");
    if (!note) {
      note = DOC.createElement("div");
      note.id = "holdingZoneNote";
      note.className = "small-note";
      note.style.margin = "0 0 .5rem 0";
      note.textContent = "Tip: Double-click a photo to send it to the Social Ready Strip.";
      hz.parentNode?.insertBefore(note, hz);
    }
  }

  function renderHoldingZone() {
    const hz = $("holdingZone");
    if (!hz) return;

    ensureHoldingNote();

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
  // Uses ID: #sendToDesignStudio  (KEEP THIS)
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
      pressAnim(btn);

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
// BOOST (Step 1) → photos + vehicle + Step 2 AI
// --------------------------------------------------
function normalizeDealerUrl(raw) {
  let s = (raw || "").toString().trim();

  // remove whitespace
  s = s.replace(/\s+/g, "");

  // if user pasted a bad double-scheme like: https://whttps://...
  // keep the LAST http(s) occurrence
  const lastHttp = Math.max(s.lastIndexOf("http://"), s.lastIndexOf("https://"));
  if (lastHttp > 0) s = s.slice(lastHttp);

  // common accidental prefix "whttps://"
  s = s.replace(/^whttps:\/\//i, "https://");
  s = s.replace(/^whttp:\/\//i, "http://");

  // if missing scheme but looks like a domain
  if (!/^https?:\/\//i.test(s) && /^[\w.-]+\.[a-z]{2,}/i.test(s)) {
    s = "https://" + s;
  }

  return s;
}

const boostBtn = $("boostBtn");
const urlInput = $("dealerUrlInput");

if (boostBtn) {
  boostBtn.onclick = async () => {
    pressAnim(boostBtn);
    setBtnLoading(boostBtn, true, "Boosting…");

    try {
const raw = urlInput?.value?.trim();
const url = normalizeDealerUrl(raw);
if (!url) return alert("Paste a valid vehicle URL first.");


      console.log("🚀 BOOST:", url);

let res, data;

try {
  res = await fetch(`/api/boost?url=${encodeURIComponent(url)}&debug=1`, {
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });

  const ct = (res.headers.get("content-type") || "").toLowerCase();

  // ✅ If server returns HTML (index fallback), show it immediately
  if (!ct.includes("application/json")) {
    const txt = await res.text();
    console.error("❌ BOOST NON-JSON RESPONSE", {
      status: res.status,
      contentType: ct,
      head: txt.slice(0, 300),
    });
    alert(`Boost returned NON-JSON (status ${res.status}). Check console.`);
    return;
  }

  data = await res.json();
} catch (e) {
  console.error("❌ BOOST FETCH FAILED", e);
  alert("Boost request failed (network/json).");
  return;
}

if (!data || !data.ok) {
  console.error("❌ BOOST ERROR PAYLOAD:", data);
  alert(data?.error || "Boost failed");
  return;
}



      // ✅ vehicle details (server should send data.vehicle; fallback to title if present)
      STORE.lastVehicle = data.vehicle || { url, title: data.title || "" };
      STORE.lastVehicle.url = STORE.lastVehicle.url || url;

      renderSummary(STORE.lastVehicle);

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
          if (idx > -1) STORE.step1Selected.splice(idx, 1);
          else {
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
    } finally {
      setBtnLoading(boostBtn, false);
    }
  };
}
// --------------------------------------------------

  // SOCIAL READY WIRES (ONE PASS)
  // --------------------------------------------------
  wireSocialNav();
  wireZipButton();
  renderSocialStrip();

  // close modals on boot
  if (window.LR_TOOLS && typeof window.LR_TOOLS.closeAll === "function") {
    window.LR_TOOLS.closeAll();
  }

  console.log("✅ APP READY");
})();
