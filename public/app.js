// FIRST LINE OF public/app.js — NOTHING ABOVE THIS
(function () {
  const V = "10001";
  console.log("🧨 APPJS TOP MARKER LOADED — v", V, Date.now());
  if (window.__LOTROCKET_APPJS_VERSION__ && window.__LOTROCKET_APPJS_VERSION__ !== V) return;
  if (window.__LOTROCKET_APPJS_VERSION__ === V) return;
  window.__LOTROCKET_APPJS_VERSION__ = V;
})();


// 👇 FIRST LINE OF app.js — NOTHING ABOVE THIS
(function () {
  const V = "10001";
  console.log("🧨 APPJS TOP MARKER LOADED — v", V, Date.now());

  if (window.__LOTROCKET_APPJS_VERSION__ && window.__LOTROCKET_APPJS_VERSION__ !== V) return;
  if (window.__LOTROCKET_APPJS_VERSION__ === V) return;
  window.__LOTROCKET_APPJS_VERSION__ = V;
})();



// ==================================================
// HARD KILL: prevent older cached app.js from running
// (MUST BE AT VERY TOP OF public/app.js — FIRST EXECUTABLE JS)
// ==================================================
(function () {
  const V = "10001"; // ✅ ONE VERSION (match your HTML: /app.js?v=10001)
  console.log("🧨 APPJS TOP MARKER LOADED — v", V, "—", Date.now());

  // If a different version already ran, stop this file immediately
  if (window.__LOTROCKET_APPJS_VERSION__ && window.__LOTROCKET_APPJS_VERSION__ !== V) return;
  window.__LOTROCKET_APPJS_VERSION__ = V;
})();

// public/app.js — Lot Rocket (CLEAN SINGLE-PASS)
// One boot. One store. One wiring pass. No duplicate blocks.

document.addEventListener("DOMContentLoaded", () => {
  // ==================================================
  // BOOT GUARD + INSPECT
  // ==================================================
  if (window.__LOTROCKET_BOOTED__) {
    console.warn(
      "🚫 Lot Rocket boot blocked (double init) — version:",
      window.__LOTROCKET_APPJS_VERSION__
    );
    return;
  }
  window.__LOTROCKET_BOOTED__ = true;
  console.log("✅ APP BOOT — version:", window.__LOTROCKET_APPJS_VERSION__);

  const DOC = document;
  const $ = (id) => DOC.getElementById(id);
  const log = (...a) => console.log(...a);
  const warn = (...a) => console.warn(...a);
// ==================================================
// AUTO-GROW (GLOBAL DELEGATE) — FIXES ALL MODALS
// ==================================================
DOC.addEventListener(
  "input",
  (e) => {
    const ta = e.target;
    if (!ta) return;
    if ((ta.tagName || "").toUpperCase() !== "TEXTAREA") return;
    // only grow textareas inside your side tools/modals
    if (!ta.closest(".side-modal")) return;
    autoGrowTextarea(ta);
  },
  true
);

  // ================================
  // CONSTANTS + SINGLE STORE
  // ================================
  const MAX_PHOTOS = 24;

  window.LOTROCKET = window.LOTROCKET || {};
  const STORE = window.LOTROCKET;

  // expose for debugging (optional)
  window.STORE = STORE;
  window.LOTROCKET_STORE = STORE;

  // normalize arrays (safe defaults)
  STORE.step1Photos = Array.isArray(STORE.step1Photos) ? STORE.step1Photos : [];
  STORE.lastBoostPhotos = Array.isArray(STORE.lastBoostPhotos) ? STORE.lastBoostPhotos : [];
  STORE.holdingZonePhotos = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
  STORE.creativePhotos = Array.isArray(STORE.creativePhotos) ? STORE.creativePhotos : [];





  // ==================================================
  // UTILITIES (ONE SOURCE)
  // ==================================================
  function setBtnLoading(btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.dataset.originalText ||= btn.textContent;
      btn.textContent = label || "Working…";
      btn.disabled = true;
      btn.classList.add("btn-loading");
    } else {
      btn.disabled = false;
      btn.classList.remove("btn-loading");
      btn.textContent = btn.dataset.originalText || btn.textContent;
    }
  }

  function capMax(arr, max = MAX_PHOTOS) {
    return Array.isArray(arr) ? arr.slice(0, max) : [];
  }

  function uniqueUrls(urls) {
    const out = [];
    const seen = new Set();
    (urls || []).forEach((u) => {
      const s = String(u || "").trim();
      if (!s || seen.has(s)) return;
      seen.add(s);
      out.push(s);
    });
    return out;
  }

  function toast(msg, kind = "ok") {
    try {
      if (typeof window.toast === "function") return window.toast(msg, kind);
    } catch {}
    console.log(kind === "bad" ? "❌" : "✅", msg);
  }

  function getProxiedImageUrl(rawUrl) {
    if (!rawUrl) return rawUrl;
    try {
      const u = new URL(rawUrl, window.location.origin);
      if (u.origin === window.location.origin) return rawUrl;
      if (u.protocol === "blob:" || u.protocol === "data:") return rawUrl;
      if (u.pathname.startsWith("/api/proxy-image")) return rawUrl;
      return `/api/proxy-image?url=${encodeURIComponent(u.toString())}`;
    } catch {
      return rawUrl;
    }
  }

function autoGrowTextarea(el, cap = 520) {
  if (!el) return;
  if ((el.tagName || "").toUpperCase() !== "TEXTAREA") return;

  el.style.setProperty("overflow", "hidden", "important");
  el.style.setProperty("resize", "none", "important");

  // reset then grow
  el.style.setProperty("height", "auto", "important");
  const next = Math.min((el.scrollHeight || 0) + 2, cap);
  el.style.setProperty("height", next + "px", "important");
}

  function autoGrowAllTextareas(root = document) {
    root.querySelectorAll("textarea").forEach(autoGrowTextarea);
  }
// ==================================================
// AUTO-GROW (AUTHORITATIVE) — ONE SOURCE
// ==================================================
function autoGrowTextarea(el, cap = 420) {
  if (!el) return;
  if ((el.tagName || "").toUpperCase() !== "TEXTAREA") return;

  el.style.overflow = "hidden";
  el.style.resize = "none";
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight + 2, cap) + "px";
}

function wireAutoGrowInModal(modal) {
  if (!modal) return;
  const taList = modal.querySelectorAll("textarea");
  taList.forEach((ta) => {
    // initial grow
    autoGrowTextarea(ta);

    // prevent double binding
    if (ta.dataset.lrGrowWired === "true") return;
    ta.dataset.lrGrowWired = "true";

    ta.addEventListener("input", () => autoGrowTextarea(ta));
  });
}

  // ==================================================
  // SIDE TOOLS (FLOATING MODALS) — SINGLE SOURCE ✅
  // ==================================================
  function wireSideTools() {
    // prevent double-wiring
    if (DOC.body?.dataset?.lrSideToolsWired === "true") return;
    if (DOC.body) DOC.body.dataset.lrSideToolsWired = "true";

    const map = {
      objection: "objectionModal",
      drill: "drillModeModal",
      drillmode: "drillModeModal",
      calc: "calcModal",
      calculator: "calcModal",
      payment: "paymentModal",
      income: "incomeModal",
      workflow: "workflowModal",
      aiworkflow: "workflowModal",
      message: "messageModal",
      aimessage: "messageModal",
      ask: "askModal",
      askai: "askModal",
      car: "carModal",
      aicar: "carModal",
    };

function openSideModal(modalId) {
  modalId = String(modalId || "").replace(/^#/, "").trim();
  if (!modalId) return;

  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");

  // ✅ AUTO-GROW ALL TEXTAREAS WHEN MODAL OPENS
  setTimeout(() => {
    modal.querySelectorAll("textarea").forEach((ta) => {
      ta.style.overflow = "hidden";
      ta.style.resize = "none";
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight + 2, 420) + "px";

      // live resize while typing
      if (!ta.dataset.autogrow) {
        ta.dataset.autogrow = "true";
        ta.addEventListener("input", () => {
          ta.style.height = "auto";
          ta.style.height = Math.min(ta.scrollHeight + 2, 420) + "px";
        });
      }
    });
  }, 0);
}

    function closeSideModal(modalEl) {
      if (!modalEl) return;
      modalEl.classList.add("hidden");
      modalEl.setAttribute("aria-hidden", "true");
      modalEl.classList.remove("open");
    }

    // OPEN (delegated)
    DOC.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest(
          ".floating-tools button, .floating-tools [data-tool], .floating-tools [data-open], .floating-tools [data-modal-target], .floating-tools [data-modal]"
        );
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        let raw =
          btn.getAttribute("data-modal-target") ||
          btn.getAttribute("data-modal") ||
          btn.getAttribute("data-open") ||
          btn.getAttribute("data-tool") ||
          btn.dataset.modalTarget ||
          btn.dataset.modal ||
          btn.dataset.open ||
          btn.dataset.tool ||
          btn.id ||
          "";

        raw = String(raw || "").trim();
        const key = raw.toLowerCase().replace(/^#/, "").replace(/[^a-z]/g, "");
        const modalId = map[key] || raw;

        openSideModal(modalId);
      },
      true
    );

    // CLOSE (delegated)
    DOC.addEventListener(
      "click",
      (e) => {
        const close = e.target.closest("[data-close], .side-modal-close");
        if (!close) return;
        const modal = close.closest(".side-modal");
        if (!modal) return;
        e.preventDefault();
        e.stopPropagation();
        closeSideModal(modal);
      },
      true
    );

    log("✅ wireSideTools() wired");
  }
// ==================================================
// OBJECTION COACH (FRONT) — auto-grow + correct API parsing
// ==================================================
function wireObjectionCoach() {
  const modal = $("objectionModal");
  if (!modal) return;

  // Prevent double-wiring
  if (modal.dataset.lrWired === "true") return;
  modal.dataset.lrWired = "true";

  const input = $("objectionInput") || modal.querySelector("textarea");
  const output = $("objectionOutput") || modal.querySelector('[data-objection-output]');
  const btn = $("objectionSendBtn") || modal.querySelector("button[type='button'], button[type='submit']");

  const autoGrow = (el) => {
    if (!el) return;
   wireAutoGrowInModal(modal);

    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight + 2, 420) + "px"; // cap so it doesn't go insane
  };

  // Auto-grow on type
  if (input) {
    autoGrow(input);
    input.addEventListener("input", () => autoGrow(input));
  }
  if (output && output.tagName === "TEXTAREA") {
    autoGrow(output);
    output.addEventListener("input", () => autoGrow(output));
  }

  const setOutput = (txt) => {
    if (!output) return;

    // output can be div OR textarea
    if (output.tagName === "TEXTAREA" || output.tagName === "INPUT") {
      output.value = txt || "";
      autoGrow(output);
    } else {
      output.textContent = txt || "";
    }
  };

  async function runCoach() {
    const objection = (input?.value || "").trim();
    if (!objection) {
      setOutput("Type the customer objection first.");
      return;
    }

    setOutput("Thinking…");

    try {
      const res = await fetch("/api/objection-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objection,
          history: "", // optional — wire later if you add a history box
        }),
      });

      const data = await res.json().catch(() => ({}));

      // ✅ THIS IS THE BIG ONE:
      // backend returns { response: "..." }
      const reply = (data && (data.response || data.text || data.message)) || "";

      setOutput(reply || "Done — but empty response. (Check server logs for OpenAI errors.)");
    } catch (e) {
      console.error("❌ objection-coach failed", e);
      setOutput("Error running Objection Coach. Check console + server logs.");
    }
  }

  if (btn) {
    btn.addEventListener("click", runCoach);
  }

  // Also submit-safe if the modal uses a form
  const form = modal.querySelector("form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      runCoach();
    });
  }

  console.log("✅ Objection Coach wired");
}

  // ==================================================
  // CALCULATOR PAD (simple)
  // ==================================================
  function wireCalculatorPad() {
    const display = $("calcDisplay");
    const buttons = DOC.querySelectorAll("[data-calc]");
    if (!display || !buttons.length) return;

    buttons.forEach((btn) => {
      if (btn.dataset.wiredCalc === "true") return;
      btn.dataset.wiredCalc = "true";

      btn.addEventListener("click", () => {
        const v = btn.dataset.calc;

        if (v === "C") {
          display.value = "";
          return;
        }

        if (v === "=") {
          try {
            if (!/^[0-9+\-*/.() ]+$/.test(display.value)) throw new Error();
            display.value = Function(`"use strict";return (${display.value})`)();
          } catch {
            display.value = "Error";
          }
          return;
        }

        display.value += v;
      });
    });
  }

  // ==================================================
  // INCOME CALC — HARD WIRE (GUARANTEED CLICK)
  // ==================================================
  function wireIncomeCalcDirect() {
    const modal = DOC.getElementById("incomeModal");
    if (!modal) return;

    const btn = modal.querySelector("#incomeCalcBtn");
    const out = modal.querySelector("#incomeOutput");

    if (!btn) return;
    if (btn.dataset.wiredDirect === "true") return;
    btn.dataset.wiredDirect = "true";

    const num = (v) => {
      const s = String(v ?? "").replace(/[^\d.-]/g, "");
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const mtdEl = modal.querySelector("#incomeMtd");
      const dateEl = modal.querySelector("#incomeLastPayDate");

      const body = {
        mtd: num(mtdEl?.value),
        lastPayDate: (dateEl?.value || "").trim(),
      };

      if (out) out.textContent = "Thinking…";

      try {
        const r = await fetch("/api/income-helper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.message || data?.error || `HTTP ${r.status}`);

        const reply =
          data?.result || data?.text || data?.answer || "✅ Done (empty response).";
        if (out) out.textContent = reply;
      } catch (err) {
        console.error("🔴 INCOME DIRECT FAIL", err);
        if (out) out.textContent = `❌ Error: ${err?.message || err}`;
      }
    });

    log("✅ income calc: direct wire complete");
  }

  // ==================================================
  // AI MODALS UNIVERSAL WIRE (SAFE)
  // ==================================================
  function wireAiModals() {
    const modals = Array.from(DOC.querySelectorAll(".side-modal"));
    if (!modals.length) return;

    const num = (v) => {
      const s = String(v ?? "").replace(/[^\d.-]/g, "");
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    const pickInside = (root, selectors) => {
      for (const sel of selectors) {
        const el = root.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    const collectPaymentBody = (modal) => ({
      price: num(pickInside(modal, ["#payPrice", "input[name='price']", "#price"])?.value),
      down: num(pickInside(modal, ["#payDown", "input[name='down']", "#down"])?.value),
      trade: num(pickInside(modal, ["#payTrade", "input[name='trade']", "#trade"])?.value),
      payoff: num(pickInside(modal, ["#payPayoff", "input[name='payoff']", "#payoff"])?.value),
      rate: num(pickInside(modal, ["#payApr", "input[name='apr']", "#apr", "#rate"])?.value),
      term: num(pickInside(modal, ["#payTerm", "input[name='term']", "#term"])?.value),
      tax: num(pickInside(modal, ["#payTax", "input[name='tax']", "#tax"])?.value),
      fees: num(pickInside(modal, ["#payFees", "#dealerFees", "input[name='fees']", "#fees"])?.value),
      state: String(pickInside(modal, ["#payState", "select[name='state']", "input[name='state']"])?.value || "")
        .trim()
        .toUpperCase(),
      rebate: num(pickInside(modal, ["#payRebate", "input[name='rebate']", "#rebate"])?.value),
    });

    const collectIncomeBody = (modal) => ({
      mtd: num(pickInside(modal, ["#incomeMtd", "input[name='mtd']", "#mtd"])?.value),
      lastPayDate: String(
        pickInside(modal, ["#incomeLastPayDate", "input[name='lastPayDate']", "input[type='date']"])?.value || ""
      ).trim(),
    });

    modals.forEach((modal) => {
      wireAutoGrowInModal(modal);

      if (modal.dataset.aiWired === "true") return;
      modal.dataset.aiWired = "true";

      const actionBtns = Array.from(modal.querySelectorAll("[data-ai-action]"));
      actionBtns.forEach((btn) => {
        if (btn.dataset.aiBtnWired === "true") return;
        btn.dataset.aiBtnWired = "true";
        btn.type = "button";

        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const action = String(btn.getAttribute("data-ai-action") || "").trim();
// ✅ INPUT (must be THIS modal's textarea)
let input =
  modal.querySelector("[data-ai-input]") ||
  modal.querySelector("textarea");

if (input && input.tagName !== "TEXTAREA") {
  input = modal.querySelector("textarea");
}

const autoGrow = (el) => {
  if (!el) return;
  el.style.overflow = "hidden";
  el.style.resize = "none";
  el.style.height = "0px";               // 🔥 critical: force reflow
  el.style.height = Math.min(el.scrollHeight + 2, 420) + "px";
};

if (input && input.tagName === "TEXTAREA") {
  // ✅ immediate grow like objection coach
  autoGrow(input);

  // ✅ bind once
  if (input.dataset.lrGrowWired !== "true") {
    input.dataset.lrGrowWired = "true";
    input.addEventListener("input", () => autoGrow(input));
    input.addEventListener("focus", () => autoGrow(input));
  }
}



// ✅ If [data-ai-input] accidentally points to an <input>, prefer any textarea in the modal
if (input && input.tagName !== "TEXTAREA") {
  const ta = modal.querySelector("textarea");
  if (ta) input = ta;
}

          const output =
            modal.querySelector("[data-ai-output]") ||
            modal.querySelector(".ai-output") ||
            modal.querySelector("pre") ||
            modal.querySelector("div[id$='Output']");
// 🔧 Auto-grow textarea support
if (input && input.tagName === "TEXTAREA") {
  const autoGrow = () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 420) + "px";
  };

  autoGrow();
  input.addEventListener("input", autoGrow);
}

          const text = String(input?.value || "").trim();

          btn.dataset.originalText ||= btn.textContent;
          btn.textContent = "Working…";
          btn.disabled = true;
          if (output) output.textContent = "Thinking…";

          try {
            const noTextRequired = new Set(["payment_calc", "income_calc"]);
            if (!noTextRequired.has(action) && !text) {
              alert("Type your question/objection first.");
              return;
            }

            const routeMap = {
objection_coach: {
  url: "/api/objection-coach",
  body: { objection: text, history: "" },
  pick: (data) => data?.response || data?.answer || data?.text || "",
},

              ask_ai: {
                url: "/api/message-helper",
                body: { mode: "ask", prompt: text },
                pick: (data) => data?.text || data?.answer || "",
              },
              message_builder: {
                url: "/api/message-helper",
                body: { mode: "message", prompt: text },
                pick: (data) => data?.text || data?.answer || "",
              },
              workflow_builder: {
                url: "/ai/workflow",
                body: {
                  goal: "Set the Appointment",
                  tone: "Persuasive, Low-Pressure, High-Value",
                  channel: "Multi-Channel",
                  days: 10,
                  touches: 6,
                },
                pick: (data) => data?.text || "",
              },
              drill_master: {
                url: "/api/message-helper",
                body: { mode: "workflow", prompt: text },
                pick: (data) => data?.text || "",
              },
              car_expert: {
                url: "/api/message-helper",
                body: { mode: "car", prompt: text },
                pick: (data) => data?.text || "",
              },
              payment_calc: {
                url: "/api/payment-helper",
                body: collectPaymentBody(modal),
                pick: (data) =>
                  data?.breakdownText || data?.result || data?.text || data?.answer || "",
              },
              income_calc: {
                url: "/api/income-helper",
                body: collectIncomeBody(modal),
                pick: (data) => data?.result || data?.text || data?.answer || "",
              },
            };

            const cfg = routeMap[action];
            if (!cfg) throw new Error(`No backend route mapped for action: ${action}`);

            const r = await fetch(cfg.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cfg.body),
            });

            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data?.message || data?.error || `HTTP ${r.status}`);

            const reply = (cfg.pick ? cfg.pick(data) : "") || "";
            if (output) output.textContent = reply || "✅ Done (empty response).";
          } catch (err) {
            console.error("🟣 AI-WIRE: action failed", err);
            if (output) output.textContent = `❌ Error: ${err?.message || err}`;
            else alert(err?.message || "Action failed");
          } finally {
            btn.disabled = false;
            btn.textContent = btn.dataset.originalText || "Run";
          }
        });
      });
    });

    log("🟣 AI-WIRE: complete");
  }

  // ==================================================
  // STEP 1 — ELEMENTS
  // ==================================================
  const dealerUrlInput = $("vehicleUrl") || $("dealerUrl");
  const vehicleLabelInput = $("vehicleLabel");
  const priceInfoInput = $("priceInfo");

  const boostBtn =
    $("boostListingBtn") ||
    $("boostThisListingBtn") ||
    $("boostThisListing") ||
    $("boostButton");

  const statusText = $("statusText");
  const photosGridEl = $("photosGrid");

  // Step 3 holding zone / tuner
  const tunerPreviewImg = $("tunerPreviewImg");
  const tunerBrightness = $("tunerBrightness");
  const tunerContrast = $("tunerContrast");
  const tunerSaturation = $("tunerSaturation");
  const autoEnhanceBtn = $("autoEnhanceBtn");
  const sendToSocialStripBtn = $("sendToSocialStripBtn");

  const creativeThumbGrid = $("creativeThumbGrid");
  const downloadSocialReadyBtn = $("downloadSocialReadyBtn");

  // ==================================================
  // STEP 1 — PHOTO GRID
  // ==================================================
  function setStep1FromUrls(urls) {
    const clean = capMax(uniqueUrls(urls || []), MAX_PHOTOS);
    STORE.step1Photos = clean.map((u) => ({ url: u, selected: false, dead: false }));
  }

  function renderStep1Photos(urls) {
    if (!photosGridEl) return;

    setStep1FromUrls(urls);

    photosGridEl.style.display = "grid";
    photosGridEl.style.gridTemplateColumns = "repeat(4, 1fr)";
    photosGridEl.style.gap = "8px";
    photosGridEl.style.marginTop = "10px";
    photosGridEl.innerHTML = "";

    (STORE.step1Photos || []).forEach((item, idx) => {
      const src = getProxiedImageUrl(item.url);

      const btn = DOC.createElement("button");
      btn.type = "button";
      btn.className = "photo-thumb-btn";
      btn.setAttribute("data-i", String(idx));
      btn.style.position = "relative";
      btn.style.height = "72px";
      btn.style.borderRadius = "12px";
      btn.style.overflow = "hidden";
      btn.style.border = "1px solid rgba(148,163,184,.55)";
      btn.style.background = "#0b1120";
      btn.style.padding = "0";
      btn.style.cursor = "pointer";
      btn.style.opacity = item.selected ? "1" : "0.45";

      const img = DOC.createElement("img");
      img.className = "photo-thumb-img";
      img.src = src;
      img.alt = "photo";
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.display = "block";
      img.style.objectFit = "cover";

      const check = DOC.createElement("span");
      check.className = "photo-check";
      check.textContent = "✓";
      check.style.position = "absolute";
      check.style.top = "6px";
      check.style.right = "6px";
      check.style.width = "18px";
      check.style.height = "18px";
      check.style.borderRadius = "999px";
      check.style.background = "rgba(0,0,0,.55)";
      check.style.color = "#fff";
      check.style.fontSize = "12px";
      check.style.lineHeight = "18px";
      check.style.textAlign = "center";
      check.style.display = item.selected ? "block" : "none";

      btn.appendChild(img);
      btn.appendChild(check);
      photosGridEl.appendChild(btn);
    });

    photosGridEl.onclick = (e) => {
      const btnEl = e.target?.closest?.("[data-i]");
      if (!btnEl) return;

      const idx = Number(btnEl.getAttribute("data-i"));
      const item = STORE.step1Photos[idx];
      if (!item || item.dead) return;

      item.selected = !item.selected;

      btnEl.style.opacity = item.selected ? "1" : "0.45";
      const check = btnEl.querySelector(".photo-check");
      if (check) check.style.display = item.selected ? "block" : "none";
      btnEl.classList.toggle("photo-thumb-selected", item.selected);
    };
  }

  function getSelectedStep1Urls() {
    const picked = (STORE.step1Photos || [])
      .filter((p) => p && p.url && p.selected)
      .map((p) => p.url)
      .filter(Boolean);
    return picked.slice(0, MAX_PHOTOS);
  }

  // ==================================================
  // STEP 3 — HOLDING ZONE + TUNER
  // ==================================================
  function renderHoldingZone() {
    const hz = $("holdingZone") || DOC.querySelector("#holdingZone");
    if (!hz) return;

    const list = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];
    hz.innerHTML = "";
    if (!list.length) return;

    if (!STORE.activeHoldingPhoto || !list.includes(STORE.activeHoldingPhoto)) {
      STORE.activeHoldingPhoto = list[0] || "";
    }

    const THUMB = 110;

    list.slice(0, MAX_PHOTOS).forEach((url) => {
      if (!url) return;

      const btn = DOC.createElement("button");
      btn.type = "button";
      btn.className = "holding-thumb-btn";
      btn.style.width = `${THUMB}px`;
      btn.style.height = `${THUMB}px`;
      btn.style.overflow = "hidden";
      if (url === STORE.activeHoldingPhoto) btn.classList.add("active");

      const img = DOC.createElement("img");
      img.className = "holding-thumb-img";
      img.src = getProxiedImageUrl(url);
      img.alt = "Holding Photo";
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.display = "block";

      btn.appendChild(img);

      btn.addEventListener("click", () => {
        STORE.activeHoldingPhoto = url;
        renderHoldingZone();
        loadPhotoTuner(url);
      });

      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();

        addToSocialReady(url, true);
        STORE.holdingZonePhotos = (STORE.holdingZonePhotos || []).filter((u) => u !== url);

        if (STORE.activeHoldingPhoto === url) {
          STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";
        }

        renderHoldingZone();
        renderSocialStrip();
        toast("Sent to Social-ready ✅", "ok");
      });

      hz.appendChild(btn);
    });

    if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);
  }

  function loadPhotoTuner(url) {
    if (!tunerPreviewImg || !url) return;
    STORE.activeHoldingPhoto = url;
    tunerPreviewImg.src = getProxiedImageUrl(url);
  }

  function applyTunerFilters() {
    if (!tunerPreviewImg) return;
    const b = Number(tunerBrightness?.value || 100) / 100;
    const c = Number(tunerContrast?.value || 100) / 100;
    const s = Number(tunerSaturation?.value || 100) / 100;
    tunerPreviewImg.style.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
  }

  function getActivePhotoUrl() {
    return typeof STORE.activeHoldingPhoto === "string" ? STORE.activeHoldingPhoto.trim() : "";
  }

  if (autoEnhanceBtn && autoEnhanceBtn.dataset.wired !== "true") {
    autoEnhanceBtn.dataset.wired = "true";
    autoEnhanceBtn.onclick = () => {
      setBtnLoading(autoEnhanceBtn, true, "Enhancing…");
      if (tunerBrightness) tunerBrightness.value = 112;
      if (tunerContrast) tunerContrast.value = 112;
      if (tunerSaturation) tunerSaturation.value = 118;
      applyTunerFilters();
      setTimeout(() => setBtnLoading(autoEnhanceBtn, false), 200);
    };
  }

  tunerBrightness?.addEventListener("input", applyTunerFilters);
  tunerContrast?.addEventListener("input", applyTunerFilters);
  tunerSaturation?.addEventListener("input", applyTunerFilters);

  // ==================================================
  // SOCIAL READY (helpers + strip)
  // ==================================================
  function normalizeSocialReady() {
    STORE.socialReadyPhotos = (STORE.socialReadyPhotos || [])
      .map((p) =>
        typeof p === "string"
          ? { url: p, originalUrl: p, selected: true, locked: false }
          : { ...p }
      )
      .filter((p) => p && p.url);

    if (STORE.socialReadyPhotos.length > MAX_PHOTOS) {
      STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(-MAX_PHOTOS);
    }

    if (STORE.socialReadyPhotos.length && !STORE.socialReadyPhotos.some((p) => p.selected)) {
      STORE.socialReadyPhotos[0].selected = true;
    }
  }

  function setSocialSelectedIndex(nextIdx) {
    normalizeSocialReady();
    const list = STORE.socialReadyPhotos || [];
    if (!list.length) return;
    const idx = ((nextIdx % list.length) + list.length) % list.length;
    STORE.socialReadyPhotos = list.map((p, i) => ({ ...p, selected: i === idx }));
  }

  function addToSocialReady(url, selected = true) {
    if (!url) return false;
    normalizeSocialReady();

    STORE.socialReadyPhotos = (STORE.socialReadyPhotos || []).map((p) => ({
      ...p,
      selected: false,
    }));

    const existing = STORE.socialReadyPhotos.findIndex((p) => p && p.url === url);
    if (existing !== -1) {
      STORE.socialReadyPhotos[existing].selected = true;
      return true;
    }

    STORE.socialReadyPhotos.unshift({
      url,
      originalUrl: url,
      selected: !!selected,
      locked: false,
    });

    STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(0, MAX_PHOTOS);
    return true;
  }

  function pushToSocialReady(url) {
    if (!url) return false;
    normalizeSocialReady();

    const next = [{ url, originalUrl: url, selected: true, locked: false }]
      .concat((STORE.socialReadyPhotos || []).map((p) => ({ ...p, selected: false })))
      .filter((v, i, a) => a.findIndex((x) => x.url === v.url) === i)
      .slice(0, MAX_PHOTOS);

    STORE.socialReadyPhotos = next;
    return true;
  }

  function renderSocialStrip() {
    normalizeSocialReady();

    const stripEl = $("socialCarousel");
    const previewEl = $("socialCarouselPreviewImg");
    const statusEl = $("socialCarouselStatus");

    const prevBtn =
      $("socialCarouselPrev") ||
      $("socialPrevBtn") ||
      DOC.querySelector("[data-social-prev]") ||
      DOC.querySelector(".social-carousel-prev");

    const nextBtn =
      $("socialCarouselNext") ||
      $("socialNextBtn") ||
      DOC.querySelector("[data-social-next]") ||
      DOC.querySelector(".social-carousel-next");

    if (!stripEl) return;

    if (prevBtn && prevBtn.dataset.wired !== "true") {
      prevBtn.dataset.wired = "true";
      prevBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const list = STORE.socialReadyPhotos || [];
        if (!list.length) return;
        const cur = Math.max(0, list.findIndex((p) => p && p.selected));
        setSocialSelectedIndex(cur - 1);
        renderSocialStrip();
      });
    }

    if (nextBtn && nextBtn.dataset.wired !== "true") {
      nextBtn.dataset.wired = "true";
      nextBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const list = STORE.socialReadyPhotos || [];
        if (!list.length) return;
        const cur = Math.max(0, list.findIndex((p) => p && p.selected));
        setSocialSelectedIndex(cur + 1);
        renderSocialStrip();
      });
    }

    stripEl.innerHTML = "";
    const list = STORE.socialReadyPhotos || [];

    list.forEach((item, idx) => {
      if (!item?.url) return;

      const btn = DOC.createElement("button");
      btn.type = "button";
      btn.className = "social-thumb-btn";

      const img = DOC.createElement("img");
      img.src = getProxiedImageUrl(item.originalUrl || item.url);
      img.className = "social-ready-thumb";
      img.loading = "lazy";
      img.style.opacity = item.selected ? "1" : "0.55";

      const lock = DOC.createElement("div");
      lock.className = "social-lock";
      lock.textContent = item.locked ? "🔒" : "🔓";

      btn.addEventListener("click", () => {
        STORE.socialReadyPhotos = (STORE.socialReadyPhotos || []).map((p, i) => ({
          ...p,
          selected: i === idx,
        }));
        renderSocialStrip();
      });

      lock.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        normalizeSocialReady();
        const it = STORE.socialReadyPhotos[idx];
        if (!it) return;
        it.locked = !it.locked;
        renderSocialStrip();
      });

      btn.appendChild(img);
      btn.appendChild(lock);
      stripEl.appendChild(btn);
    });

    const active = list.find((p) => p && p.selected) || list[0];
    if (previewEl) {
      previewEl.src = active?.url ? getProxiedImageUrl(active.originalUrl || active.url) : "";
    }

    if (statusEl) {
      const lockedCount = list.filter((p) => p && p.locked).length;
      statusEl.textContent = list.length
        ? `Social-ready: ${list.length} • Locked: ${lockedCount}`
        : "No social-ready photos yet.";
    }
  }

  // Download locked photos
  if (downloadSocialReadyBtn && downloadSocialReadyBtn.dataset.wired !== "true") {
    downloadSocialReadyBtn.dataset.wired = "true";
    downloadSocialReadyBtn.addEventListener("click", async () => {
      normalizeSocialReady();

      const locked = (STORE.socialReadyPhotos || []).filter(
        (p) => p && p.locked && (p.originalUrl || p.url)
      );

      if (!locked.length) {
        alert("Lock at least one photo to download.");
        return;
      }

      if (typeof window.JSZip !== "function") {
        alert("Download engine not ready (JSZip missing).");
        return;
      }

      const zip = new window.JSZip();
      const folder = zip.folder("LotRocket_SocialReady");

      for (let i = 0; i < locked.length; i++) {
        const url = locked[i].originalUrl || locked[i].url;
        if (!url) continue;

        try {
          const fetchUrl = getProxiedImageUrl(url);
          const res = await fetch(fetchUrl);
          const blob = await res.blob();

          const ext = blob.type && blob.type.includes("png") ? "png" : "jpg";
          folder.file(`social_${String(i + 1).padStart(2, "0")}.${ext}`, blob);
        } catch (e) {
          console.warn("❌ Failed to fetch:", url, e);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });

      const a = DOC.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = "LotRocket_SocialReady.zip";
      DOC.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
  }

  if (sendToSocialStripBtn && sendToSocialStripBtn.dataset.wired !== "true") {
    sendToSocialStripBtn.dataset.wired = "true";
    sendToSocialStripBtn.onclick = () => {
      setBtnLoading(sendToSocialStripBtn, true, "Sending…");
      const ok = pushToSocialReady(getActivePhotoUrl());
      if (!ok) alert("No active photo selected.");
      renderSocialStrip();
      setTimeout(() => setBtnLoading(sendToSocialStripBtn, false), 200);
    };
  }

  // ==================================================
  // STEP 3 — SEND SELECTED (Step1) → HOLDING
  // ==================================================
  const sendTopBtn =
    $("sendTopPhotosBtn") ||
    $("sendTopPhotosToCreative") ||
    $("sendTopPhotosToCreativeLab") ||
    $("sendToCreativeLabBtn") ||
    $("sendToCreativeLab") ||
    DOC.querySelector("[data-send-top-photos]");

  function sendSelectedToHoldingZone() {
    const urls = getSelectedStep1Urls();
    if (!urls.length) {
      toast("Select at least 1 photo first.", "bad");
      return;
    }

    STORE.holdingZonePhotos = urls.slice(0, MAX_PHOTOS);
    STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

    renderHoldingZone();
    loadPhotoTuner(STORE.activeHoldingPhoto);

    toast(`Sent ${STORE.holdingZonePhotos.length} photo(s) to Creative Lab`, "ok");

    const step3 = DOC.querySelector("#creativeHub") || DOC.querySelector("#step3") || DOC.querySelector("#creativeLab");
    if (step3) step3.scrollIntoView({ behavior: "smooth" });
  }

  if (sendTopBtn && sendTopBtn.dataset.wired !== "true") {
    sendTopBtn.dataset.wired = "true";
    sendTopBtn.textContent = "Send Selected Photos to Creative Lab";
    sendTopBtn.addEventListener("click", () => sendSelectedToHoldingZone());
  }

  // ==================================================
  // STEP 2 — RENDER SOCIAL KIT OUTPUTS
  // ==================================================
  function renderStep2FromBoost(data) {
    if (!data) return;
    if (window.__STEP2_RENDER_LOCK__) return;
    window.__STEP2_RENDER_LOCK__ = true;
    setTimeout(() => (window.__STEP2_RENDER_LOCK__ = false), 0);

    const root = data?.data || data?.result || data?.payload || data || {};

    const asText = (v) => {
      if (v == null) return "";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      if (Array.isArray(v)) return v.map(asText).filter(Boolean).join("\n");
      if (typeof v === "object") {
        if (typeof v.text === "string") return v.text;
        if (typeof v.caption === "string") return v.caption;
        if (typeof v.value === "string") return v.value;
      }
      try { return JSON.stringify(v); } catch { return ""; }
    };

    const findKeyCI = (obj, key) => {
      if (!obj || typeof obj !== "object") return undefined;
      if (key in obj) return obj[key];
      const kl = String(key).toLowerCase();
      for (const k of Object.keys(obj)) {
        if (k.toLowerCase() === kl) return obj[k];
      }
      return undefined;
    };

    const deepFindPlatform = (obj, platform) => {
      if (!obj || typeof obj !== "object") return "";
      const direct = findKeyCI(obj, platform);
      if (direct != null) return asText(direct);

      const containers = ["posts", "socialPosts", "captions", "copy", "outputs", "output", "socialKit", "social"];
      for (const c of containers) {
        const bucket = findKeyCI(obj, c);
        if (bucket && typeof bucket === "object") {
          const hit = findKeyCI(bucket, platform);
          if (hit != null) return asText(hit);
          for (const k of Object.keys(bucket)) {
            if (k.toLowerCase().includes(String(platform).toLowerCase())) return asText(bucket[k]);
          }
        }
      }

      for (const k of Object.keys(obj)) {
        if (k.toLowerCase().includes(String(platform).toLowerCase())) return asText(obj[k]);
      }
      return "";
    };

    const getPlatformText = (k) => deepFindPlatform(root, k);

    const setText = (el, text) => {
      if (!el) return false;
      const val = text == null ? "" : String(text);
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "input") el.value = val;
      else el.textContent = val;
      el.classList.remove("hidden");
      el.style.display = "";
      return true;
    };

    const mapping = [
      { key: "facebook", sels: ["#facebookPost"] },
      { key: "instagram", sels: ["#instagramPost"] },
      { key: "tiktok", sels: ["#tiktokPost"] },
      { key: "linkedin", sels: ["#linkedinPost"] },
      { key: "twitter", sels: ["#twitterPost"] },
      { key: "text", sels: ["#textBlurb"] },
      { key: "marketplace", sels: ["#marketplacePost"] },
      { key: "hashtags", sels: ["#hashtags"] },
    ];

    let filled = 0;

    mapping.forEach(({ key, sels }) => {
      const el = DOC.querySelector(sels[0]);
      const txt =
        getPlatformText(key) ||
        getPlatformText(key + "Post") ||
        getPlatformText(key + "Caption") ||
        (key === "instagram" ? (getPlatformText("ig") || getPlatformText("insta")) : "") ||
        (key === "twitter" ? (getPlatformText("x") || getPlatformText("tweet")) : "") ||
        (key === "text" ? (getPlatformText("dm") || getPlatformText("sms") || getPlatformText("blurb")) : "");

      const ok = setText(el, txt);
      if (ok && txt) filled++;
    });

    setTimeout(() => autoGrowAllTextareas(document), 50);
    if (!filled) console.warn("🟥 STEP2: nothing filled (selector/key mismatch)");
  }

  // ==================================================
  // BOOST BUTTON HANDLER
  // ==================================================
  if (boostBtn && boostBtn.dataset.wired !== "true") {
    boostBtn.dataset.wired = "true";

    boostBtn.onclick = async () => {
      const url = dealerUrlInput?.value?.trim?.() || "";
      if (!url) return alert("Enter a vehicle URL first.");

      STORE.dealerUrl = url;
      STORE.vehicleUrl = url;

      setBtnLoading(boostBtn, true, "Boosting…");
      if (statusText) statusText.textContent = "Boosting…";

      try {
      const res = await fetch("/api/boost", {

          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            labelOverride: vehicleLabelInput?.value?.trim?.() || "",
            priceOverride: priceInfoInput?.value?.trim?.() || "",
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = data?.rawMessage || data?.details || data?.message || data?.error || `HTTP ${res.status}`;
          throw new Error(msg);
        }

        renderStep2FromBoost(data);

        const rawPhotos = Array.isArray(data.photos) ? data.photos : [];
        const seen = new Set();
        const cleaned = [];
        for (const u of rawPhotos) {
          if (!u) continue;
          const base = String(u).split("?")[0].replace(/\/+$/, "");
          if (seen.has(base)) continue;
          seen.add(base);
          cleaned.push(u);
          if (cleaned.length >= MAX_PHOTOS) break;
        }

        STORE.lastBoostPhotos = cleaned;
        renderStep1Photos(STORE.lastBoostPhotos);

        if (statusText) statusText.textContent = `Boost complete • Photos: ${STORE.lastBoostPhotos.length}`;
        toast("Boost complete 🚀", "ok");

        const step2 = DOC.querySelector("#step2") || DOC.querySelector("#socialKit") || DOC.querySelector("[data-step='2']");
        if (step2) step2.scrollIntoView({ behavior: "smooth" });
      } catch (err) {
        console.error("❌ BOOST FAILED:", err);
        if (statusText) statusText.textContent = "Boost failed.";
        toast(err?.message || "Boost failed", "bad");
        alert(err?.message || "Boost failed.");
      } finally {
        setBtnLoading(boostBtn, false);
      }
    };
  }



// ==================================================
// UI HIDER (SAFE)
// ==================================================
function runUiHiderSafe() {
  try {
    if (typeof installHideNextVersionUI === "function") {
      installHideNextVersionUI();
      console.log("✅ UI HIDER RAN");
    }
  } catch (e) {
    console.warn("⚠️ UI HIDER ERROR", e);
  }
}

// ==================================================
// FINAL INIT (SAFE) ✅ MUST BE LAST
// ==================================================
try {
  // Step 1 restore
  if (STORE?.lastBoostPhotos?.length && typeof renderStep1Photos === "function") {
    renderStep1Photos(STORE.lastBoostPhotos);
  }

  // Holding zone restore
  if (STORE?.holdingZonePhotos?.length) {
    STORE.activeHoldingPhoto =
      STORE.activeHoldingPhoto || STORE.holdingZonePhotos[0] || "";

    if (typeof renderHoldingZone === "function") renderHoldingZone();

    if (STORE.activeHoldingPhoto && typeof loadPhotoTuner === "function") {
      loadPhotoTuner(STORE.activeHoldingPhoto);
    }
  }

  // Core renders/wiring
  if (typeof renderSocialStrip === "function") renderSocialStrip();

  if (typeof wireCalculatorPad === "function") wireCalculatorPad();
  if (typeof wireIncomeCalcDirect === "function") wireIncomeCalcDirect();

  if (typeof wireAiModals === "function") wireAiModals();
  if (typeof wireSideTools === "function") wireSideTools();
  if (typeof wireObjectionCoach === "function") wireObjectionCoach();

  // UI hider (one-time)
  if (!window.__LOTROCKET_UI_HIDER_CALLED__) {
    window.__LOTROCKET_UI_HIDER_CALLED__ = true;
    if (typeof runUiHiderSafe === "function") {
      runUiHiderSafe();
      setTimeout(runUiHiderSafe, 250);
      setTimeout(runUiHiderSafe, 1000);
    }
  }

  // textarea autogrow
  if (typeof autoGrowAllTextareas === "function") {
    setTimeout(() => autoGrowAllTextareas(document), 50);
  }

  console.log("✅ FINAL INIT COMPLETE");
} catch (e) {
  console.error("❌ FINAL INIT FAILED", e);
}

}); // ✅ CLOSE DOMContentLoaded (ONE COPY ONLY)

// 🧨 EOF MARKER
console.log("🧨 EOF MARKER — app.js loaded:", window.__LOTROCKET_APPJS_VERSION__);
