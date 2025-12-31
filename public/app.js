// ==================================================
// HARD KILL: prevent older cached app.js from running
// (MUST BE AT VERY TOP OF public/app.js)
// ==================================================
(function () {
  if (
    window.__LOTROCKET_APPJS_VERSION__ &&
    window.__LOTROCKET_APPJS_VERSION__ !== "999"
  ) {
    return;
  }
  window.__LOTROCKET_APPJS_VERSION__ = "999";
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

  // ===============================
  // SAFE LOGGING (prevents crashes)
  // ===============================
  const log = (...a) => console.log(...a);
  const warn = (...a) => console.warn(...a);

  // ================================
  // CONSTANTS + SINGLE STORE
  // ================================
  const MAX_PHOTOS = 24;

  window.LOTROCKET = window.LOTROCKET || {};
  const STORE = window.LOTROCKET;

  // ✅ DEBUG/TOOLS ACCESS (so DevTools can see it)
  window.STORE = STORE;
  window.LOTROCKET_STORE = STORE;

  STORE.step1Photos = Array.isArray(STORE.step1Photos) ? STORE.step1Photos : [];
  STORE.lastBoostPhotos = Array.isArray(STORE.lastBoostPhotos)
    ? STORE.lastBoostPhotos
    : [];
  STORE.holdingZonePhotos = Array.isArray(STORE.holdingZonePhotos)
    ? STORE.holdingZonePhotos
    : [];
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos)
    ? STORE.socialReadyPhotos
    : [];
  STORE.creativePhotos = Array.isArray(STORE.creativePhotos)
    ? STORE.creativePhotos
    : [];

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


// ==================================================
// SIDE TOOLS (FLOATING MODALS) — SINGLE SOURCE ✅
// One open, one close, one delegated click, no duplicates.
// ==================================================
function wireSideTools() {
  const DOC = document;
  const log = (...a) => console.log(...a);

  // ✅ prevent double-wiring
  if (DOC.body?.dataset?.lrSideToolsWired === "true") return;
  if (DOC.body) DOC.body.dataset.lrSideToolsWired = "true";

  // ==================================================
  // OPEN MODAL (single function)
  // ==================================================
  function openSideModal(modalId) {
    // ✅ normalize (handles "#incomeModal")
    modalId = String(modalId || "").replace(/^#/, "").trim();
    if (!modalId) return;

    const modal = DOC.getElementById(modalId);
    if (!modal) {
      console.warn("❌ MODAL NOT FOUND:", modalId);
      return;
    }

    modal.classList.remove("hidden");
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");

    // ✅ DO NOT scope to ".floating-tools"
    const launcher =
      DOC.querySelector(`[data-modal-target="${modalId}"]`) ||
      DOC.querySelector(`[data-open="${modalId}"]`) ||
      DOC.querySelector(`[data-tool="${modalId}"]`) ||
      DOC.querySelector(`[data-modal="${modalId}"]`);

    if (launcher) launcher.classList.add("active");

    // optional focus
    const focusEl = modal.querySelector("textarea, input, button");
    if (focusEl) {
      try { focusEl.focus(); } catch {}
    }

    log("✅ OPEN MODAL:", modalId);
  }

  // ==================================================
  // CLOSE MODAL (single function)
  // ==================================================
  function closeSideModal(modalEl) {
    if (!modalEl) return;

    if (modalEl.contains(DOC.activeElement)) {
      try {
        DOC.activeElement.blur();
      } catch {}
    }

    modalEl.classList.add("hidden");
    modalEl.setAttribute("aria-hidden", "true");
    modalEl.classList.remove("open");

    const id = String(modalEl.id || "").trim();

    const launcher =
      DOC.querySelector(`[data-modal-target="${id}"]`) ||
      DOC.querySelector(`[data-open="${id}"]`) ||
      DOC.querySelector(`[data-tool="${id}"]`) ||
      DOC.querySelector(`[data-modal="${id}"]`);

    if (launcher) launcher.classList.remove("active");

    log("✅ CLOSE MODAL:", id);
  }

  // ==================================================
  // TOOL → MODAL MAP (normalized)
  // ==================================================
  const map = {
    objection: "objectionModal",
    drill: "drillModeModal",
    calc: "calcModal",
    payment: "paymentModal",
    income: "incomeModal",
    aiworkflow: "workflowModal",
    aimessage: "messageModal",
    askai: "askModal",
    aicar: "carModal",
  };

  // ==================================================
  // ONE delegated handler for all floating buttons
  // Supports: data-modal-target, data-open, data-tool, data-modal
  // ==================================================
  DOC.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(
        ".floating-tools button, .floating-tools [data-tool], .floating-tools [data-open], .floating-tools [data-modal-target], .floating-tools [data-modal]"
      );
      if (!btn) return;

      // stop weird overlay/drag issues
      e.preventDefault();
      e.stopPropagation();

      // read intent (prefer explicit modal target)
      let modalId =
        btn.getAttribute("data-modal-target") ||
        btn.getAttribute("data-modal") ||
        btn.getAttribute("data-open") ||
        btn.getAttribute("data-tool") ||
        btn.dataset.modalTarget ||
        btn.dataset.modal ||
        btn.dataset.open ||
        btn.dataset.tool ||
        "";

      // normalize
      modalId = String(modalId || "").trim();

      // if they provided a tool name, map it
      const key = modalId.toLowerCase().replace(/^#/, "").replace(/[^a-z]/g, "");
      const mapped = map[key];

      // final modalId
      modalId = mapped || modalId;

      // if still looks like "income" etc but not mapped, try map again
      const key2 = String(modalId).toLowerCase().replace(/^#/, "").replace(/[^a-z]/g, "");
      modalId = map[key2] || modalId;

      // ✅ open
      openSideModal(modalId);
    },
    true
  );

  // ==================================================
  // CLOSE buttons inside modals
  // ==================================================
  DOC.addEventListener(
    "click",
    (e) => {
      const close = e.target.closest("[data-close], .side-modal-close");
      if (!close) return;

      const modal = close.closest(".side-modal");
      if (!modal) return;

      closeSideModal(modal);
    },
    true
  );
}
// ==================================================
// TOOLWIRE / FLOATING TOOLS (HARDENED, SAFE) ✅
// Works with: [data-modal-target], [data-open], [data-tool]
// Modals supported: any .side-modal with matching id
// ==================================================
DOC.addEventListener(
  "click",
  (e) => {
    const btn = e.target.closest("[data-modal-target], [data-open], [data-tool]");
    if (!btn) return;

    let modalId =
      btn.getAttribute("data-modal-target") ||
      btn.getAttribute("data-open") ||
      btn.getAttribute("data-tool");

    // ✅ normalize (handles "#incomeModal")
    modalId = String(modalId || "").replace(/^#/, "").trim();
    if (!modalId) return;

    e.preventDefault();

// ==================================================
// OPEN MODAL HANDLER (SAFE + COMPATIBLE)
// ==================================================
if (typeof window.openModalById !== "function") {
  window.openModalById = function (modalId) {
    modalId = String(modalId || "").replace(/^#/, "").trim();
    if (!modalId) return;

    const modal = document.getElementById(modalId);
    if (!modal) {
      console.warn("❌ Modal not found:", modalId);
      return;
    }

    modal.classList.remove("hidden");
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-hidden", "false");

    const focusEl = modal.querySelector("input, textarea, button");
    if (focusEl) focusEl.focus();

    console.log("✅ OPEN MODAL:", modalId);
  };
}

// ==================================================
// GLOBAL CLICK HANDLER (SAFE, SINGLE SOURCE)
// ==================================================
document.addEventListener(
  "click",
  (e) => {
    const btn = e.target.closest(
      "[data-modal-target], [data-open], [data-tool]"
    );
    if (!btn) return;

    let modalId =
      btn.getAttribute("data-modal-target") ||
      btn.getAttribute("data-open") ||
      btn.getAttribute("data-tool");

    modalId = String(modalId || "").replace(/^#/, "").trim();
    if (!modalId) return;

    e.preventDefault();
    openModalById(modalId);
  },
  true
);




function wireSideTools() {
  try {
    const DOC = document;
    const log = (...a) => console.log(...a);

    // prevent double-wire
    if (window.__LOTROCKET_SIDETOOLS_WIRED__) return;
    window.__LOTROCKET_SIDETOOLS_WIRED__ = true;

    // ✅ safe opener (handles name mismatches + "#id")
    const openModalSafe = (id) => {
      id = String(id || "").replace(/^#/, "").trim();
      if (!id) return;

      if (typeof openModalById === "function") return openModalById(id);
      if (typeof openSideModal === "function") return openSideModal(id);

      console.warn("❌ No modal open function available for:", id);
    };

    // OPEN: event delegation so it works even if buttons render later
    DOC.addEventListener(
      "click",
      (e) => {
        const launcher =
          e.target.closest("[data-modal-target]") ||
          e.target.closest("[data-open]") ||
          e.target.closest("[data-tool]") ||
          e.target.closest(".toolwire-btn") ||
          e.target.closest(".floating-tool-btn");

        if (!launcher) return;

        let modalId =
          launcher.getAttribute("data-modal-target") ||
          launcher.getAttribute("data-open") ||
          launcher.getAttribute("data-tool");

        modalId = String(modalId || "").replace(/^#/, "").trim();
        if (!modalId) {
          console.warn("⚠️ Tool click but no modal id on:", launcher);
          return;
        }

        e.preventDefault();
        openModalSafe(modalId);
      },
      true
    );

    // CLOSE (inside modals)
    DOC.addEventListener(
      "click",
      (e) => {
        const close = e.target.closest("[data-close], .side-modal-close");
        if (!close) return;

        const modal = close.closest(".side-modal");
        if (!modal) return;

        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        log("✅ CLOSE MODAL:", modal.id || "(no id)");
      },
      true
    );

    log("✅ wireSideTools() wired (delegated)");
  } catch (e) {
    console.error("❌ wireSideTools() failed", e);
  }
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
            display.value = Function(
              `"use strict";return (${display.value})`
            )();
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
// FLOATING TOOLS (SINGLE SOURCE ✅) — attach to .floating-tools
// No duplicates. No mixed naming. Normalizes "#modalId".
// Supports: data-modal, data-open, data-tool, data-modal-target, button id.
// ==================================================
function wireFloatingTools() {
  const DOC = document;
  const log = (...a) => console.log(...a);
  const warn = (...a) => console.warn(...a);

  const wrap =
    DOC.querySelector(".floating-tools") ||
    DOC.getElementById("floatingTools") ||
    DOC.querySelector("[data-floating-tools]");

  if (!wrap) {
    warn("🟠 wireFloatingTools: .floating-tools wrapper not found");
    return;
  }

  // ✅ prevent double-wiring
  if (wrap.dataset.lrFloatingWired === "true") return;
  wrap.dataset.lrFloatingWired = "true";

  // ==================================================
  // OPEN MODAL BY ID (safe)
  // ==================================================
  const openModalById = (modalId) => {
    modalId = String(modalId || "").replace(/^#/, "").trim();
    if (!modalId) return;

    const modal = DOC.getElementById(modalId);
    if (!modal) {
      warn("🟠 FloatingTools: modal not found:", modalId);
      return;
    }

    modal.classList.remove("hidden");
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");

    // optional focus
    const focusEl = modal.querySelector("textarea, input, button");
    if (focusEl) {
      try { focusEl.focus(); } catch {}
    }
  };

  // ==================================================
  // MAP tool => modal id (edit keys ONLY if your ids differ)
  // ==================================================
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

  // ==================================================
  // ONE handler (works even if click never fires)
  // ==================================================
  const handler = (e) => {
    const btn = e.target.closest(
      "button,[data-modal-target],[data-modal],[data-open],[data-tool]"
    );
    if (!btn || !wrap.contains(btn)) return;

    e.preventDefault();
    e.stopPropagation();

    const raw =
      btn.getAttribute("data-modal-target") ||
      btn.dataset.modalTarget ||
      btn.dataset.modal ||
      btn.dataset.open ||
      btn.dataset.tool ||
      btn.getAttribute("data-modal") ||
      btn.getAttribute("data-open") ||
      btn.getAttribute("data-tool") ||
      btn.id ||
      "";

    const key = String(raw).toLowerCase().replace(/^#/, "").replace(/[^a-z]/g, "");

    // if raw is a direct modal id, this still works
    const modalId = map[key] || raw;

    log("✅ FloatingTools click:", { raw, key, modalId });

    openModalById(modalId);
  };

  // ✅ pointerup catches cases where click never fires
  wrap.addEventListener("pointerup", handler, true);
  wrap.addEventListener("click", handler, true);

  log("✅ wireFloatingTools READY (attached to .floating-tools)");
}

// ==================================================
// INCOME CALC — HARD WIRE (GUARANTEED CLICK)
// ==================================================
function wireIncomeCalcDirect() {
  const DOC = document;
  const log = (...a) => console.log(...a);
  const warn = (...a) => console.warn(...a);

  const modal = DOC.getElementById("incomeModal");
  if (!modal) return;

  const btn =
    modal.querySelector("#incomeCalcBtn") ||
    modal.querySelector("[data-ai-action='income_calc']");

  const out =
    modal.querySelector("#incomeOutput") ||
    modal.querySelector("[data-ai-output]");

  if (!btn) {
    warn("🟠 income calc: button not found");
    return;
  }

  if (btn.dataset.wiredDirect === "true") return;
  btn.dataset.wiredDirect = "true";

  const num = (v) => {
    if (v == null) return 0;
    const s = String(v).replace(/[^\d.-]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    log("🟢 INCOME DIRECT CLICK");

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

      if (!r.ok) {
        const msg = data?.message || data?.error || `HTTP ${r.status}`;
        throw new Error(msg);
      }

      const reply =
        data?.result || data?.text || data?.answer || "✅ Done (empty response).";
      if (out) out.textContent = reply;

      log("🟢 INCOME DIRECT OK", data);
    } catch (err) {
      console.error("🔴 INCOME DIRECT FAIL", err);
      if (out) out.textContent = `❌ Error: ${err?.message || err}`;
      else alert(err?.message || "Income calc failed");
    }
  });

  log("✅ income calc: direct wire complete");
}

// ==================================================
// AI MODALS UNIVERSAL WIRE (SAFE)
// ==================================================

  function wireAiModals() {
    const modals = Array.from(DOC.querySelectorAll(".side-modal"));
    if (!modals.length) {
      warn("🟣 AI-WIRE: no .side-modal found");
      return;
    }

    const num = (v) => {
      if (v == null) return 0;
      const s = String(v).replace(/[^\d.-]/g, "");
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

    const collectPaymentBody = (modal) => {
      const priceEl = pickInside(modal, [
        "#payPrice",
        "input[name='price']",
        "#price",
      ]);
      const downEl = pickInside(modal, [
        "#payDown",
        "input[name='down']",
        "#down",
      ]);
      const tradeEl = pickInside(modal, [
        "#payTrade",
        "input[name='trade']",
        "#trade",
      ]);
      const payoffEl = pickInside(modal, [
        "#payPayoff",
        "input[name='payoff']",
        "#payoff",
      ]);

      const aprEl = pickInside(modal, [
        "#payApr",
        "input[name='apr']",
        "input[name='rate']",
        "#apr",
        "#rate",
      ]);
      const termEl = pickInside(modal, [
        "#payTerm",
        "input[name='term']",
        "#term",
      ]);
      const taxEl = pickInside(modal, [
        "#payTax",
        "input[name='tax']",
        "#tax",
      ]);

      const feesEl = pickInside(modal, [
        "#payFees",
        "#dealerFees",
        "input[name='fees']",
        "input[name='dealerFees']",
        "#fees",
      ]);

      const stateEl = pickInside(modal, [
        "#payState",
        "select[name='state']",
        "input[name='state']",
      ]);
      const rebateEl = pickInside(modal, [
        "#payRebate",
        "input[name='rebate']",
        "#rebate",
      ]);

      return {
        price: num(priceEl?.value),
        down: num(downEl?.value),
        trade: num(tradeEl?.value),
        payoff: num(payoffEl?.value),
        rate: num(aprEl?.value),
        term: num(termEl?.value),
        tax: num(taxEl?.value),
        fees: num(feesEl?.value),
        state: (stateEl?.value || "").trim().toUpperCase(),
        rebate: num(rebateEl?.value),
      };
    };

    const collectIncomeBody = (modal) => {
      const mtdEl = pickInside(modal, ["#incomeMtd", "input[name='mtd']", "#mtd"]);
      const dateEl = pickInside(modal, [
        "#incomeLastPayDate",
        "input[name='lastPayDate']",
        "#lastPayDate",
        "input[type='date']",
      ]);

      return {
        mtd: num(mtdEl?.value),
        lastPayDate: (dateEl?.value || "").trim(),
      };
    };

    modals.forEach((modal) => {
      if (modal.dataset.aiWired === "true") return;
      modal.dataset.aiWired = "true";

      const inner =
        modal.querySelector(".side-modal-content") ||
        modal.querySelector(".modal-content") ||
        modal.firstElementChild;

      if (inner && inner.dataset.aiInnerWired !== "true") {
        inner.dataset.aiInnerWired = "true";
        inner.addEventListener("click", (e) => e.stopPropagation());
        inner.addEventListener("pointerdown", (e) => e.stopPropagation());
      }

      const form = modal.querySelector("form");
      if (form && form.dataset.aiFormWired !== "true") {
        form.dataset.aiFormWired = "true";
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          e.stopPropagation();
          log("🟣 AI-WIRE: submit blocked", modal.id || "(no id)");
        });
      }

      const actionBtns = Array.from(modal.querySelectorAll("[data-ai-action]"));
      actionBtns.forEach((btn) => {
        if (btn.dataset.aiBtnWired === "true") return;
        btn.dataset.aiBtnWired = "true";
        btn.type = "button";

        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const action = (btn.getAttribute("data-ai-action") || "").trim();
          const modalName = modal.id || modal.getAttribute("data-modal") || "side-modal";

          log("🟣 AI-WIRE: action click", { modal: modalName, action });

          const input =
            modal.querySelector("[data-ai-input]") ||
            modal.querySelector("textarea") ||
            modal.querySelector("input[type='text']");

          const output =
            modal.querySelector("[data-ai-output]") ||
            modal.querySelector(".ai-output") ||
            modal.querySelector(".tool-output") ||
            modal.querySelector("pre") ||
            modal.querySelector("div[id$='Output']");

          const text = (input?.value || "").trim();

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
                pick: (data) => data?.answer || data?.text || "",
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
            if (!cfg) {
              if (output) {
                output.textContent =
                  `✅ Received (${action}). No route mapped yet.\n` + `Input: ${text}`;
              } else {
                alert(`Received (${action}). No route mapped yet.`);
              }
              throw new Error(`No backend route mapped for action: ${action}`);
            }

            const r = await fetch(cfg.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cfg.body),
            });

            const data = await r.json().catch(() => ({}));
            if (!r.ok) {
              const msg = data?.message || data?.error || `HTTP ${r.status}`;
              throw new Error(msg);
            }

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
  // STEP 1 — ELEMENTS (READ ONCE)
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

  // Creative thumbs
  const creativeThumbGrid = $("creativeThumbGrid");

  // Social strip
  const downloadSocialReadyBtn = $("downloadSocialReadyBtn");

  // ==================================================
  // STEP 1 — PHOTO GRID (SINGLE SOURCE)
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

  // ==================================================
  // STEP 1 HELPERS (SELECTED URLS) — SINGLE SOURCE
  // ==================================================
  function getSelectedStep1Urls() {
    if (Array.isArray(STORE.step1Photos) && STORE.step1Photos.length) {
      const picked = STORE.step1Photos
        .filter((p) => p && typeof p === "object" && p.url && p.selected)
        .map((p) => p.url)
        .filter(Boolean);

      if (picked.length) return picked.slice(0, MAX_PHOTOS);
    }

    if (STORE.step1Selected && STORE.step1Selected instanceof Set) {
      const picked = Array.from(STORE.step1Selected).filter(Boolean);
      if (picked.length) return picked.slice(0, MAX_PHOTOS);
    }

    const grid =
      DOC.querySelector("#photoGrid") ||
      DOC.querySelector("#step1PhotoGrid") ||
      DOC.querySelector(".photo-grid") ||
      DOC.querySelector("#boostPhotoGrid") ||
      photosGridEl;

    if (!grid) return [];

    const picked = [];
    const nodes = grid.querySelectorAll(
      "button.photo-thumb-btn.selected, button.photo-thumb-btn.photo-thumb-selected"
    );

    nodes.forEach((btn) => {
      const img = btn.querySelector("img");
      const src =
        img?.getAttribute("data-original") ||
        img?.getAttribute("data-src") ||
        img?.src ||
        "";
      if (src) picked.push(src);
    });

    return picked.slice(0, MAX_PHOTOS);
  }
// ==================================================
// UI HIDER RUNNER (SAFE) — run now + after DOM settles
// ==================================================
function runUiHiderSafe() {
  try {
    if (typeof installHideNextVersionUI === "function") {
      installHideNextVersionUI();
      console.log("✅ UI HIDER RAN");
    } else {
      console.warn("⚠️ installHideNextVersionUI() not found");
    }
  } catch (e) {
    console.warn("⚠️ UI HIDER ERROR (non-fatal)", e);
  }
}

  // ==================================================
  // STEP 1 → SEND TOP PHOTOS → STEP 3 (SINGLE SOURCE)
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

    log("🧪 sendSelectedToHoldingZone urls =", urls.length, urls);

    if (!urls.length) {
      toast("Select at least 1 photo first.", "bad");
      return;
    }

    STORE.holdingZonePhotos = urls.slice(0, MAX_PHOTOS);
    STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

    if (typeof renderHoldingZone === "function") renderHoldingZone();
    if (STORE.activeHoldingPhoto && typeof loadPhotoTuner === "function") {
      loadPhotoTuner(STORE.activeHoldingPhoto);
    }

    log("✅ Sent to Step 3 HOLDING:", STORE.holdingZonePhotos.length);
    toast(`Sent ${STORE.holdingZonePhotos.length} photo(s) to Creative Lab`, "ok");

    const step3 =
      DOC.querySelector("#creativeHub") ||
      DOC.querySelector("#step3") ||
      DOC.querySelector("#creativeLab");

    if (step3) step3.scrollIntoView({ behavior: "smooth" });
  }

  if (sendTopBtn && sendTopBtn.dataset.wired !== "true") {
    sendTopBtn.dataset.wired = "true";
    sendTopBtn.textContent = "Send Selected Photos to Creative Lab";

    sendTopBtn.addEventListener("click", () => {
      log("🚀 SEND SELECTED PHOTOS CLICK");
      sendTopBtn.style.transform = "scale(0.98)";
      sendTopBtn.style.opacity = "0.9";
      setTimeout(() => {
        sendTopBtn.style.transform = "";
        sendTopBtn.style.opacity = "";
      }, 180);

      sendSelectedToHoldingZone();
    });
  }
// ==================================================
// STEP 2 — REMOVE EMOJIS BUTTONS (INJECT + WIRE)
// ==================================================
function stripEmojis(str) {
  const s = String(str || "");
  // Broad emoji ranges (works well in modern Chromium)
  return s
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/\u{FE0F}/gu, "") // variation selector
    .replace(/\s{2,}/g, " ")
    .trim();
}

function installStep2RemoveEmojiButtons() {
  const rows = Array.from(DOC.querySelectorAll(".step2-card .btn-row"));
  rows.forEach((row) => {
    if (row.dataset.emojiBtn === "true") return;
    row.dataset.emojiBtn = "true";

    const btn = DOC.createElement("button");
    btn.type = "button";
    btn.className = "emoji-strip-btn";
btn.textContent = "No Emojis";

    row.appendChild(btn);
  });

  console.log("✅ Step 2 emoji buttons installed:", rows.length);
}

function wireStep2RemoveEmojiClicks() {
  if (window.__STEP2_EMOJI_WIRED__) return;
  window.__STEP2_EMOJI_WIRED__ = true;

  DOC.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".emoji-strip-btn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    // find the textarea in the same card
    const card = btn.closest(".step2-card");
    const ta = card?.querySelector("textarea");
    if (!ta) return;

    ta.value = stripEmojis(ta.value);
    autoResizeTextarea(ta);

    try { toast("Emojis removed ✅", "ok"); } catch {}
  });

  console.log("✅ Step 2 emoji strip wired");
}

  // ==================================================
  // STEP 3 — HOLDING ZONE RENDER
  // ==================================================
  function renderHoldingZone() {
    const hz =
      $("holdingZone") ||
      DOC.getElementById("holdingZone") ||
      DOC.querySelector("#holdingZone");

    if (!hz) {
      warn("❌ renderHoldingZone: #holdingZone not found");
      return;
    }

    const list = Array.isArray(STORE.holdingZonePhotos)
      ? STORE.holdingZonePhotos
      : [];

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

      if (url === STORE.activeHoldingPhoto) {
        btn.classList.add("active");
      }

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
        if (typeof loadPhotoTuner === "function") loadPhotoTuner(url);
      });

      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (typeof addToSocialReady === "function") addToSocialReady(url, true);

        STORE.holdingZonePhotos = (STORE.holdingZonePhotos || []).filter(
          (u) => u !== url
        );

        if (STORE.activeHoldingPhoto === url) {
          STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";
        }

        renderHoldingZone();
        if (typeof renderSocialStrip === "function") renderSocialStrip();

        toast("Sent to Social-ready ✅", "ok");
        log("✅ Sent to social-ready (removed from holding):", url);
      });

      hz.appendChild(btn);
    });

    if (STORE.activeHoldingPhoto && typeof loadPhotoTuner === "function") {
      loadPhotoTuner(STORE.activeHoldingPhoto);
    }
  }

  // ==================================================
  // PHOTO TUNER
  // ==================================================
  function loadPhotoTuner(url) {
    if (!tunerPreviewImg || !url) return;
    STORE.activeHoldingPhoto = url;

    tunerPreviewImg.onload = () => log("✅ Photo Tuner loaded");
    tunerPreviewImg.onerror = () => warn("❌ Photo Tuner failed:", url);

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
    if (
      typeof STORE.activeHoldingPhoto === "string" &&
      STORE.activeHoldingPhoto.trim()
    ) {
      return STORE.activeHoldingPhoto;
    }
    return "";
  }

  // ==================================================
  // AUTO ENHANCE
  // ==================================================
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
  // SOCIAL READY HELPERS ✅ SINGLE SOURCE
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

    if (
      STORE.socialReadyPhotos.length &&
      !STORE.socialReadyPhotos.some((p) => p.selected)
    ) {
      STORE.socialReadyPhotos[0].selected = true;
    }
  }

  function setSocialSelectedIndex(nextIdx) {
    normalizeSocialReady();
    const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
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
      .concat(
        (STORE.socialReadyPhotos || []).map((p) => ({ ...p, selected: false }))
      )
      .filter((v, i, a) => a.findIndex((x) => x.url === v.url) === i)
      .slice(0, MAX_PHOTOS);

    STORE.socialReadyPhotos = next;
    return true;
  }
function autoGrowTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = (el.scrollHeight || 0) + "px";
}

function autoGrowAllTextareas(root = document) {
  root.querySelectorAll("textarea").forEach(autoGrowTextarea);
}


  // ==================================================
  // SOCIAL READY STRIP (SINGLE SOURCE)
  // ==================================================
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

        const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
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

        const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
        if (!list.length) return;

        const cur = Math.max(0, list.findIndex((p) => p && p.selected));
        setSocialSelectedIndex(cur + 1);
        renderSocialStrip();
      });
    }

    stripEl.innerHTML = "";

    const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];

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
      lock.title = item.locked ? "Locked (will download)" : "Unlocked (won’t download)";

      btn.addEventListener("click", () => {
        STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p, i) => ({
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
      previewEl.src = active?.url
        ? getProxiedImageUrl(active.originalUrl || active.url)
        : "";
    }

    if (statusEl) {
      const lockedCount = list.filter((p) => p && p.locked).length;
      statusEl.textContent = list.length
        ? `Social-ready: ${list.length} • Locked: ${lockedCount}`
        : "No social-ready photos yet.";
    }
  }
setTimeout(() => {
  document.querySelectorAll("textarea").forEach(autoGrowTextarea);
}, 50);

  // ==================================================
  // DOWNLOAD SOCIAL-READY (LOCKED PHOTOS ONLY)
  // ==================================================
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
      log("🚀 SEND TO STRIP CLICK");
      setBtnLoading(sendToSocialStripBtn, true, "Sending…");
      const ok = pushToSocialReady(getActivePhotoUrl());
      if (!ok) alert("No active photo selected.");
      renderSocialStrip();
      setTimeout(() => setBtnLoading(sendToSocialStripBtn, false), 200);
    };
  }

  // ==================================================
  // CREATIVE THUMBS (MINIMAL, STABLE)
  // ==================================================
  function renderCreativeThumbs() {
    if (!creativeThumbGrid) return;

    if (!STORE.creativePhotos || !STORE.creativePhotos.length) {
      creativeThumbGrid.innerHTML = "";
      return;
    }

    creativeThumbGrid.innerHTML = "";

    STORE.creativePhotos = capMax(uniqueUrls(STORE.creativePhotos || []), MAX_PHOTOS);

    STORE.creativePhotos.forEach((url) => {
      const img = DOC.createElement("img");
      img.src = getProxiedImageUrl(url);
      img.alt = "Creative photo";
      img.loading = "lazy";
      img.className = "creative-thumb";
      img.title = "Click = preview • Double-click = send to Social Strip";

      img.addEventListener("click", () => {
        img.classList.toggle("selected");
        loadPhotoTuner(url);
        applyTunerFilters();
      });

      img.addEventListener("dblclick", () => {
        addToSocialReady(url, true);
        renderSocialStrip();
        toast("Sent to Social-ready ✅", "ok");
      });

      creativeThumbGrid.appendChild(img);
    });

    if (tunerPreviewImg && !tunerPreviewImg.src && STORE.creativePhotos.length) {
      loadPhotoTuner(STORE.creativePhotos[0]);
      applyTunerFilters();
    }
  }

  // ==================================================
  // STEP 2 — RENDER SOCIAL KIT OUTPUTS (SINGLE PATH)
  // ==================================================
  function renderStep2FromBoost(data) {
    if (!data) return;

    // ✅ lock INSIDE render (never outside boot)
    if (window.__STEP2_RENDER_LOCK__) return;
    window.__STEP2_RENDER_LOCK__ = true;
    setTimeout(() => (window.__STEP2_RENDER_LOCK__ = false), 0);

    const root =
      (data && data.data) ||
      (data && data.result) ||
      (data && data.payload) ||
      data ||
      {};

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
      const p = String(platform).toLowerCase();

      const direct = findKeyCI(obj, platform);
      if (direct != null) return asText(direct);

      const containers = ["posts", "socialPosts", "captions", "copy", "outputs", "output", "socialKit", "social"];
      for (const c of containers) {
        const bucket = findKeyCI(obj, c);
        if (bucket && typeof bucket === "object") {
          const hit = findKeyCI(bucket, platform);
          if (hit != null) return asText(hit);

          for (const k of Object.keys(bucket)) {
            const kk = k.toLowerCase();
            if (kk.includes(p)) return asText(bucket[k]);
          }
        }
      }

      for (const k of Object.keys(obj)) {
        const kk = k.toLowerCase();
        if (kk.includes(p)) return asText(obj[k]);
      }

      return "";
    };

    const getPlatformText = (k) => deepFindPlatform(root, k);

    const findEl = (sels) => {
      for (const sel of sels) {
        try {
          const el = DOC.querySelector(sel);
          if (el) return el;
        } catch {}
      }
      return null;
    };

    const setText = (el, text) => {
      if (!el) return false;
      const val = text == null ? "" : String(text);
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "input") el.value = val;
      else el.textContent = val;

      el.classList.remove("hidden");
      el.style.display = "";
      el.setAttribute("data-filled", val ? "1" : "0");
      return true;
    };
console.log("🟦 STEP2 root keys:", Object.keys(root || {}));
console.log("🟦 STEP2 root preview:", JSON.stringify(root).slice(0, 500));

    // ✅ STEP2 TARGETS — MATCH index.html EXACTLY
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


// ===== STEP2 DOM PROBE (TEMP) =====
// prints what nodes exist so we stop guessing IDs
const PROBE_SELS = [
  "#tiktokOutput","#tiktokCaption","#tiktokText",
  "#instagramOutput","#instagramCaption","#instagramText",
  "#facebookOutput","#facebookCaption","#facebookText",
  "#linkedinOutput","#linkedinCaption","#linkedinText",
  "#marketplaceOutput","#marketplaceCaption","#marketplaceText",
  "#hashtagsOutput","#hashtagOutput","#hashtagSet","#hashtags",
  "[data-out='tiktok']","[data-out='instagram']","[data-out='facebook']","[data-out='linkedin']",
  "[data-out='marketplace']","[data-out='hashtags']",
  "[data-step2='tiktok']","[data-step2='instagram']","[data-step2='facebook']","[data-step2='linkedin']",
  "[data-step2='marketplace']","[data-step2='hashtags']"
];

const probeHits = {};
PROBE_SELS.forEach((sel) => {
  try {
    const el = DOC.querySelector(sel);
    if (el) {
      probeHits[sel] = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (el.className ? `.${String(el.className).split(" ").filter(Boolean).slice(0,3).join(".")}` : "");
    }
  } catch {}
});

console.log("🧲 STEP2 PROBE hits:", probeHits);
// ===== END PROBE =====

    const report = {};
    let filled = 0;

mapping.forEach(({ key, sels }) => {
  const el = findEl(sels);

  // Pull text using multiple likely keys (covers real backend variants)
  const txt =
    getPlatformText(key) ||
    getPlatformText(key + "Post") ||
    getPlatformText(key + "Caption") ||
    getPlatformText(key + "_post") ||
    getPlatformText(key + "_caption") ||
    (key === "instagram" ? (getPlatformText("ig") || getPlatformText("insta")) : "") ||
    (key === "twitter" ? (getPlatformText("x") || getPlatformText("tweet")) : "") ||
    (key === "text" ? (getPlatformText("dm") || getPlatformText("sms") || getPlatformText("blurb")) : "");

  const ok = setText(el, txt);

  report[key] = {
    found: !!el,
    sel: sels[0],
    chars: (txt || "").length,
    sample: (txt || "").slice(0, 80),
    filled: ok && !!txt,
  };

  if (ok && txt) filled++;
});


    console.log("🟦 STEP2 render report:", report);
    if (!filled) console.warn("🟥 STEP2: nothing filled (selector/key mismatch)", report);
  }

  // ==================================================
  // BOOST BUTTON HANDLER (SINGLE SOURCE OF TRUTH)
  // ==================================================
  if (boostBtn && boostBtn.dataset.wired !== "true") {
    boostBtn.dataset.wired = "true";

    boostBtn.onclick = async () => {
      log("🚀 BOOST CLICK");
setTimeout(() => autoGrowAllTextareas(document), 50);

      const url = dealerUrlInput?.value?.trim?.() || "";
      if (!url) {
        alert("Enter a vehicle URL first.");
        return;
      }

      STORE.dealerUrl = url;
      STORE.vehicleUrl = url;

      setBtnLoading(boostBtn, true, "Boosting…");
      if (statusText) statusText.textContent = "Boosting…";

      try {
        const res = await fetch("/boost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            labelOverride: vehicleLabelInput?.value?.trim?.() || "",
            priceOverride: priceInfoInput?.value?.trim?.() || "",
          }),
        });

        const data = await res.json().catch(() => ({}));
        log("🧪 BOOST RESPONSE KEYS:", Object.keys(data || {}));

        if (!res.ok) {
          const msg =
            data?.rawMessage ||
            data?.details ||
            data?.message ||
            data?.error ||
            `Boost failed (HTTP ${res.status})`;
          throw new Error(msg);
        }

       try {
  renderStep2FromBoost(data);

  // 🔽 ADD THIS RIGHT HERE
  setTimeout(() => {
    if (typeof autoGrowAllTextareas === "function") {
      autoGrowAllTextareas(document);
    }
  }, 50);

} catch (e) {
  console.warn("⚠️ Step 2 render failed:", e);
}


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

        if (statusText) {
          statusText.textContent = `Boost complete • Photos: ${STORE.lastBoostPhotos.length}`;
        }

        toast("Boost complete 🚀", "ok");

        const step2 =
          DOC.querySelector("#step2") ||
          DOC.querySelector("#socialKit") ||
          DOC.querySelector("[data-step='2']");
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
  // UI HIDER (AUTHORITATIVE) — SINGLE COPY ONLY
  // ==================================================
  function installHideNextVersionUI() {
    if (window.__LOTROCKET_UI_HIDER_RUNNING__) return;
    window.__LOTROCKET_UI_HIDER_RUNNING__ = true;

    const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

    const KEEP_SELECTORS = ["#creativeHub", "#step3", "#creativeLab"];
    const getKeepNodes = () =>
      KEEP_SELECTORS.map((s) => DOC.querySelector(s)).filter(Boolean);

    const isAlwaysKeep = (el) => {
      if (!el) return true;
      if (el === DOC.documentElement) return true;
      if (el === DOC.body) return true;
      if (el.tagName === "BODY") return true;
      if (el.tagName === "HTML") return true;
      if (el.tagName === "MAIN") return true;
      return false;
    };

    const isKeep = (el) => {
      if (!el) return false;
      if (isAlwaysKeep(el)) return true;

      const keeps = getKeepNodes();
      if (!keeps.length) return false;

      if (keeps.some((k) => el === k)) return true;
      if (keeps.some((k) => el.contains && el.contains(k))) return true;

      return false;
    };

    const FUTURE_BUTTON_TEXT = [
      "ai image generation",
      "ai video generation",
      "canvas studio",
      "design studio",
      "canvas",
      "design",
    ];

    const HIDE_ACTIONS = new Set([
      "image_ai",
      "video_ai",
      "image_generator",
      "video_generator",
      "video_script",
      "shot_list",
      "thumbnail_prompt",
      "canvas",
      "canvas_studio",
      "design",
      "design_studio",
      "design_studio_3",
      "design_studio_3_0",
      "design_studio_3_5",
    ]);

    const HIDE_MODAL_TARGETS = new Set(
      [
        "imageModal",
        "videoModal",
        "canvasModal",
        "designModal",
        "canvasStudioModal",
        "designStudioModal",
      ].map(norm)
    );

    const HARD_KILL_SELECTORS = [
      "#videoOutputBottom",
      "#creativeStudioOverlay",
      "#designStudioOverlay",
      "#canvasStudio",
      "#canvasStudioWrap",
      "#canvasStudioRoot",
      "#designStudio",
      "#designStudioRoot",
      "#konvaStage",
      "#fabricCanvasWrap",
    ];

    const hideEl = (el, reason) => {
      if (!el) return false;
      if (isKeep(el)) return false;
      if (el.dataset?.lrHidden === "1") return false;

      el.dataset.lrHidden = "1";
      el.setAttribute("aria-hidden", "true");
      el.hidden = true;

      el.style.setProperty("display", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
      el.style.setProperty("pointer-events", "none", "important");

      return true;
    };

    const forceShowFloatingBar = () => {
      DOC.querySelectorAll(".floating-tools, #floatingTools, #floatingToolBar").forEach(
        (bar) => {
          if (!bar) return;
          bar.hidden = false;
          bar.removeAttribute("aria-hidden");
          bar.dataset.lrHidden = "0";
          bar.style.setProperty("display", "flex", "important");
          bar.style.setProperty("visibility", "visible", "important");
          bar.style.setProperty("pointer-events", "auto", "important");
        }
      );
    };

    const pass = () => {
      forceShowFloatingBar();

      hideEl(DOC.getElementById("sendToDesignStudio"), "#sendToDesignStudio");

      HARD_KILL_SELECTORS.forEach((sel) => {
        const el = DOC.querySelector(sel);
        if (el) hideEl(el, `hard-kill ${sel}`);
      });

      DOC.querySelectorAll(
        ".floating-tools button, .floating-tools a, .floating-tools [role='button'], .floating-tools .floating-tools-button"
      ).forEach((btn) => {
        const cleanLabel = (s) =>
          String(s || "")
            .toLowerCase()
            .replace(/[^a-z0-9 ]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        const txt = cleanLabel(btn.textContent);
        const action = cleanLabel(btn.getAttribute("data-ai-action"));
        const target = cleanLabel(btn.getAttribute("data-modal-target"));

        const shortExact = txt === "canvas" || txt === "design";

        const longContains =
          Array.isArray(FUTURE_BUTTON_TEXT) &&
          FUTURE_BUTTON_TEXT.some((t) => {
            const tt = cleanLabel(t);
            return tt.length > 6 && txt.includes(tt);
          });

        const actionMatch = !!action && HIDE_ACTIONS instanceof Set && HIDE_ACTIONS.has(action);
        const targetMatch =
          !!target && HIDE_MODAL_TARGETS instanceof Set && HIDE_MODAL_TARGETS.has(target);

        if (shortExact || longContains || actionMatch || targetMatch) {
          hideEl(btn, `floating future btn (${txt || action || target || "unknown"})`);
        }
      });

      DOC.querySelectorAll(".side-modal, .modal").forEach((m) => {
        const mid = norm(m.id);
        if (!mid) return;

        if (
          mid.includes("video") ||
          mid.includes("image") ||
          mid.includes("canvas") ||
          mid.includes("design")
        ) {
          hideEl(m, `future modal ${m.id}`);
        }
      });

      const bottom = DOC.querySelector("#videoOutputBottom");
      if (bottom) hideEl(bottom, "#videoOutputBottom");
    };

    pass();

    if (!window.__LOTROCKET_UI_HIDER_OBSERVER__) {
      const obs = new MutationObserver(() => {
        if (window.__LOTROCKET_UI_HIDER_TICK__) return;
        window.__LOTROCKET_UI_HIDER_TICK__ = true;
        requestAnimationFrame(() => {
          window.__LOTROCKET_UI_HIDER_TICK__ = false;
          pass();
        });
      });
      obs.observe(DOC.body, { childList: true, subtree: true });
      window.__LOTROCKET_UI_HIDER_OBSERVER__ = obs;
    }

    let tries = 0;
    const t = setInterval(() => {
      tries++;
      pass();
      if (tries >= 30) clearInterval(t);
    }, 200);

    console.log("✅ UI hider installed (authoritative LAUNCH v4)");
  } // ✅ end runUiHiderSafe()


function updateStep2ButtonLabels() {
  document.querySelectorAll(".regen-btn").forEach(btn => {
    const text = btn.textContent.toLowerCase().trim();

    if (text.includes("new") && text.includes("post")) {
      btn.innerHTML = "<span>New</span><span>Post</span>";
    }

    if (text.includes("remove") && text.includes("emoji")) {
      btn.innerHTML = "<span>No</span><span>Emoji</span>";
    }
  });
}

// ==================================================

// FINAL INIT (SAFE) ✅ MUST BE LAST
// ==================================================
try {
  // Step 1 restore
  if (STORE.lastBoostPhotos?.length && typeof renderStep1Photos === "function") {
    renderStep1Photos(STORE.lastBoostPhotos);
  }

  // Step 3 restore
  if (STORE.holdingZonePhotos?.length) {
    STORE.activeHoldingPhoto =
      STORE.activeHoldingPhoto || STORE.holdingZonePhotos[0] || "";

    if (typeof renderHoldingZone === "function") {
      renderHoldingZone();
    }

    if (STORE.activeHoldingPhoto && typeof loadPhotoTuner === "function") {
      loadPhotoTuner(STORE.activeHoldingPhoto);
    }
  }

  // Step 3 UI
  if (typeof renderCreativeThumbs === "function") renderCreativeThumbs();
  if (typeof renderSocialStrip === "function") renderSocialStrip();

  // Tools
  if (typeof wireCalculatorPad === "function") wireCalculatorPad();
  if (typeof wireIncomeCalcDirect === "function") wireIncomeCalcDirect();

  // AI + Floating tools (order matters)
  if (typeof wireAiModals === "function") wireAiModals();
  if (typeof wireSideTools === "function") wireSideTools();

  // Step 2 helpers
  if (typeof installAutoGrowTextareas === "function") installAutoGrowTextareas();
  if (typeof wireStep2RegenButtons === "function") wireStep2RegenButtons();
  if (typeof installStep2RemoveEmojiButtons === "function") {
    installStep2RemoveEmojiButtons();
  }

  // Step 2 button label stacker
  if (typeof updateStep2ButtonLabels === "function") {
    updateStep2ButtonLabels();
    setTimeout(updateStep2ButtonLabels, 150);
  }

  // UI Hider (authoritative)
  if (!window.__LOTROCKET_UI_HIDER_CALLED__) {
    window.__LOTROCKET_UI_HIDER_CALLED__ = true;
    runUiHiderSafe();
    setTimeout(runUiHiderSafe, 250);
    setTimeout(runUiHiderSafe, 1000);
  }

  console.log("✅ FINAL INIT COMPLETE");
} catch (e) {
  console.error("❌ FINAL INIT FAILED", e);
}

// ✅ MUST be the LAST line of the file (closes the DOMContentLoaded wrapper)
});
