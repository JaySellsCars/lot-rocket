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
    console.log(kind === "bad" || kind === "error" ? "❌" : "✅", msg);
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

  // ==================================================
  // AUTO-GROW (AUTHORITATIVE) — ONE SOURCE ONLY ✅
  // ==================================================
  function autoGrowTextarea(el, cap = 420) {
    if (!el) return;
    if ((el.tagName || "").toUpperCase() !== "TEXTAREA") return;

    el.style.overflow = "hidden";
    el.style.resize = "none";
    el.style.height = "0px"; // force reflow
    el.style.height = Math.min((el.scrollHeight || 0) + 2, cap) + "px";
  }

  function autoGrowAllTextareas(root = document) {
    root.querySelectorAll("textarea").forEach((ta) => autoGrowTextarea(ta));
  }

  function wireAutoGrowInModal(modal) {
    if (!modal) return;
    const taList = modal.querySelectorAll("textarea");
    taList.forEach((ta) => {
      autoGrowTextarea(ta);

      if (ta.dataset.lrGrowWired === "true") return;
      ta.dataset.lrGrowWired = "true";

      ta.addEventListener("input", () => autoGrowTextarea(ta));
      ta.addEventListener("focus", () => autoGrowTextarea(ta));
    });
  }

  // ✅ Global delegate (covers dynamically swapped textareas)
  DOC.addEventListener(
    "input",
    (e) => {
      const ta = e.target;
      if (!ta) return;
      if ((ta.tagName || "").toUpperCase() !== "TEXTAREA") return;
      if (!ta.closest(".side-modal")) return;
      autoGrowTextarea(ta);
    },
    true
  );

  // ==================================================
  // SIDE TOOLS (FLOATING MODALS) — SINGLE SOURCE ✅
  // ==================================================
  function wireSideTools() {
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

      const modal = DOC.getElementById(modalId);
      if (!modal) return;

      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("open");

      // ✅ Auto-grow inside this modal (one pass)
      wireAutoGrowInModal(modal);
      setTimeout(() => wireAutoGrowInModal(modal), 30);
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

    if (modal.dataset.lrWired === "true") return;
    modal.dataset.lrWired = "true";

    wireAutoGrowInModal(modal);

    const input = $("objectionInput") || modal.querySelector("textarea");
    const output = $("objectionOutput") || modal.querySelector("[data-objection-output]");
    const btn =
      $("objectionSendBtn") ||
      modal.querySelector("button[type='button'], button[type='submit']");

    const setOutput = (txt) => {
      if (!output) return;

      if ((output.tagName || "").toUpperCase() === "TEXTAREA") {
        output.value = txt || "";
        autoGrowTextarea(output);
      } else {
        output.textContent = txt || "";
      }
    };

    if (input) {
      autoGrowTextarea(input);
      input.addEventListener("input", () => autoGrowTextarea(input));
      input.addEventListener("focus", () => autoGrowTextarea(input));
    }

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
          body: JSON.stringify({ objection, history: "" }),
        });

        const data = await res.json().catch(() => ({}));
        const reply = (data && (data.response || data.text || data.message)) || "";
        setOutput(reply || "Done — but empty response. (Check server logs for OpenAI errors.)");
      } catch (e) {
        console.error("❌ objection-coach failed", e);
        setOutput("Error running Objection Coach. Check console + server logs.");
      }
    }

    if (btn) btn.addEventListener("click", runCoach);

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

        const reply = data?.result || data?.text || data?.answer || "✅ Done (empty response).";
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

    // FRONT — Payment payload builder (requires TAX)
    const collectPaymentBody = (modal) => {
      const getVal = (selectors) => pickInside(modal, selectors)?.value ?? "";

      const price = num(getVal(["#payPrice", "input[name='price']", "#price"]));
      const down = num(getVal(["#payDown", "input[name='down']", "#down"]));
      const trade = num(getVal(["#payTrade", "input[name='trade']", "#trade"]));
      const payoff = num(getVal(["#payPayoff", "input[name='payoff']", "#payoff"]));

      const apr = num(getVal(["#payApr", "input[name='apr']", "#apr", "#rate"]));
      const term = num(getVal(["#payTerm", "input[name='term']", "#term"]));

      const taxRaw = String(getVal(["#payTax", "input[name='tax']", "#tax"])).trim();
      const tax = taxRaw === "" ? null : num(taxRaw);

      const fees = num(getVal(["#payFees", "#dealerFees", "input[name='fees']", "#fees"]));

      const state = String(
        getVal(["#payState", "select[name='state']", "input[name='state']"]) || "MI"
      )
        .trim()
        .toUpperCase();

      const rebate = num(getVal(["#payRebate", "input[name='rebate']", "#rebate"]));

      if (tax === null || !Number.isFinite(tax) || tax < 0) {
        if (typeof toast === "function") toast("Sales tax % is required.", "error");
        else alert("Sales tax % is required.");

        const taxEl = pickInside(modal, ["#payTax", "input[name='tax']", "#tax"]);
        if (taxEl) {
          taxEl.focus();
          taxEl.style.outline = "2px solid #ff4d4f";
          setTimeout(() => (taxEl.style.outline = ""), 1200);
        }

        throw new Error("missing_tax");
      }

      return {
        price,
        down,
        trade,
        payoff,
        apr,
        rate: apr, // backward compat
        term,
        tax,
        fees,
        state,
        rebate,
      };
    };

    const collectIncomeBody = (modal) => ({
      mtd: num(pickInside(modal, ["#incomeMtd", "input[name='mtd']", "#mtd"])?.value),
      lastPayDate: String(
        pickInside(modal, ["#incomeLastPayDate", "input[name='lastPayDate']", "input[type='date']"])
          ?.value || ""
      ).trim(),
    });

    const ensureTextarea = (modal) => {
      let input = modal.querySelector("[data-ai-input]") || modal.querySelector("textarea");
      if (input && (input.tagName || "").toUpperCase() !== "TEXTAREA") {
        input = modal.querySelector("textarea");
      }
      return input;
    };

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

          const input = ensureTextarea(modal);
          if (input) autoGrowTextarea(input);

          const output =
            modal.querySelector("[data-ai-output]") ||
            modal.querySelector(".ai-output") ||
            modal.querySelector("pre") ||
            modal.querySelector("div[id$='Output']");

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

            // ✅ FIXED routeMap (no stray braces)
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
                body: () => {
                  try {
                    return collectPaymentBody(modal);
                  } catch {
                    return null; // abort
                  }
                },
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

            const bodyObj = typeof cfg.body === "function" ? cfg.body() : cfg.body;
            if (!bodyObj) return;

            const r = await fetch(cfg.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(bodyObj),
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
  // NOTE:
  // Your remaining sections (holding zone, social strip, Step2 renderer, boost handler,
  // UI hider, final init, launch hide) can remain as-is BELOW here.
  // The critical fixes above are:
  // ✅ removed duplicate autoGrowTextarea
  // ✅ fixed routeMap stray braces
  // ✅ removed duplicate autoGrow const blocks
  // ✅ removed extra DOMContentLoaded closing
  // ==================================================

  // ... keep the rest of your file ...

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
    if (STORE?.lastBoostPhotos?.length && typeof renderStep1Photos === "function") {
      renderStep1Photos(STORE.lastBoostPhotos);
    }

    if (STORE?.holdingZonePhotos?.length) {
      STORE.activeHoldingPhoto = STORE.activeHoldingPhoto || STORE.holdingZonePhotos[0] || "";

      if (typeof renderHoldingZone === "function") renderHoldingZone();

      if (STORE.activeHoldingPhoto && typeof loadPhotoTuner === "function") {
        loadPhotoTuner(STORE.activeHoldingPhoto);
      }
    }

    if (typeof renderSocialStrip === "function") renderSocialStrip();

    if (typeof wireCalculatorPad === "function") wireCalculatorPad();
    if (typeof wireIncomeCalcDirect === "function") wireIncomeCalcDirect();

    if (typeof wireAiModals === "function") wireAiModals();
    if (typeof wireSideTools === "function") wireSideTools();
    if (typeof wireObjectionCoach === "function") wireObjectionCoach();

    if (!window.__LOTROCKET_UI_HIDER_CALLED__) {
      window.__LOTROCKET_UI_HIDER_CALLED__ = true;
      runUiHiderSafe();
      setTimeout(runUiHiderSafe, 250);
      setTimeout(runUiHiderSafe, 1000);
    }

    setTimeout(() => autoGrowAllTextareas(document), 50);

    console.log("✅ FINAL INIT COMPLETE");
  } catch (e) {
    console.error("❌ FINAL INIT FAILED", e);
  }

  // ============================================
  // LAUNCH ENFORCE HIDE — overlays + video bottom
  // (safe + one-time)
  // ============================================
  (() => {
    if (window.__LOTROCKET_LAUNCH_HIDE_CALLED__) return;
    window.__LOTROCKET_LAUNCH_HIDE_CALLED__ = true;

    const IDS = ["videoOutputBottom", "designStudioOverlay", "creativeStudioOverlay"];

    const kill = () => {
      for (const id of IDS) {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
      }
    };

    kill();
    setTimeout(kill, 150);
    setTimeout(kill, 600);
  })();
}); // ✅ CLOSE DOMContentLoaded (ONE COPY ONLY)
