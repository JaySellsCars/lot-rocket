// ==================================================
// HARD KILL: prevent older cached app.js from running
// (MUST BE AT VERY TOP OF public/app.js)
// ==================================================
(function () {
  if (window.__LOTROCKET_APPJS_VERSION__ && window.__LOTROCKET_APPJS_VERSION__ !== "999") {
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
    // safe fallback if your toast system exists elsewhere
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
  // SIDE TOOLS (FLOATING MODALS)
  // ==================================================
  function openSideModal(modalId) {
    const modal = DOC.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");

    const launcher = DOC.querySelector(
      `.floating-tools [data-modal-target="${modalId}"]`
    );
    launcher?.classList.add("active");

    log("✅ OPEN MODAL:", modalId);
  }

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

    const launcher = DOC.querySelector(
      `.floating-tools [data-modal-target="${modalEl.id}"]`
    );
    launcher?.classList.remove("active");

    log("✅ CLOSE MODAL:", modalEl.id);
  }

function wireSideTools() {
  // ==================================================
  // OPEN buttons (support multiple rails)
  // ==================================================
  const rail =
    DOC.querySelector(".floating-tools") ||
    DOC.querySelector("#toolWire") ||
    DOC.querySelector(".toolwire") ||
    DOC.querySelector(".side-tools") ||
    DOC.querySelector("[data-toolwire]") ||
    DOC;

  const openBtns = Array.from(rail.querySelectorAll("[data-modal-target]"));

  openBtns.forEach((btn) => {
    if (btn.dataset.wired === "true") return;
    btn.dataset.wired = "true";

    const targetId = (btn.getAttribute("data-modal-target") || "").trim();
    if (!targetId) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSideModal(targetId);
    });
  });

  // ==================================================
  // CLOSE buttons (inside modals)
  // ==================================================
  DOC.querySelectorAll(".side-modal [data-close], .side-modal .side-modal-close").forEach(
    (btn) => {
      if (btn.dataset.wired === "true") return;
      btn.dataset.wired = "true";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const modal = btn.closest(".side-modal");
        closeSideModal(modal);
      });
    }
  );

  log("🧰 Side tools wired:", {
    openBtns: openBtns.length,
    rail: rail === DOC ? "document" : (rail.id || rail.className || rail.tagName),
  });
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

        const reply = data?.result || data?.text || data?.answer || "✅ Done (empty response).";
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
  // NOTE: Buttons MUST have data-ai-action to route correctly
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
      const priceEl = pickInside(modal, ["#payPrice", "input[name='price']", "#price"]);
      const downEl = pickInside(modal, ["#payDown", "input[name='down']", "#down"]);
      const tradeEl = pickInside(modal, ["#payTrade", "input[name='trade']", "#trade"]);
      const payoffEl = pickInside(modal, ["#payPayoff", "input[name='payoff']", "#payoff"]);

      const aprEl = pickInside(modal, ["#payApr", "input[name='apr']", "input[name='rate']", "#apr", "#rate"]);
      const termEl = pickInside(modal, ["#payTerm", "input[name='term']", "#term"]);
      const taxEl = pickInside(modal, ["#payTax", "input[name='tax']", "#tax"]);

      const feesEl = pickInside(modal, ["#payFees", "#dealerFees", "input[name='fees']", "input[name='dealerFees']", "#fees"]);

      const stateEl = pickInside(modal, ["#payState", "select[name='state']", "input[name='state']"]);
      const rebateEl = pickInside(modal, ["#payRebate", "input[name='rebate']", "#rebate"]);

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

              // ✅ CALCULATORS
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
  } // ✅ closes wireAiModals()

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

    // one click handler (replace each render)
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
  // STEP 1 → SEND TOP PHOTOS → STEP 3 (SINGLE SOURCE)
  // ==================================================
  const sendTopBtn =
    $("sendTopPhotosBtn") ||
    $("sendTopPhotosToCreative") ||
    $("sendTopPhotosToCreativeLab") ||
    $("sendToCreativeLabBtn") ||
    $("sendToCreativeLab") ||
    $("sendToDesignStudio") ||
    DOC.querySelector("[data-send-top-photos]") ||
    DOC.querySelector("[data-send-top]");

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

    log("✅ Sent to Step 3 HOLDING ONLY:", STORE.holdingZonePhotos.length);
    toast(`Sent ${STORE.holdingZonePhotos.length} photo(s) to Step 3`, "ok");

    const step3 =
      DOC.querySelector("#creativeHub") ||
      DOC.querySelector("#step3") ||
      DOC.querySelector("#creativeLab");

    if (step3) step3.scrollIntoView({ behavior: "smooth" });
  }

if (sendTopBtn && sendTopBtn.dataset.wired !== "true") {
  sendTopBtn.dataset.wired = "true";

  // ✅ set the visible label (so it stays consistent on reload too)
  sendTopBtn.textContent = "Send Selected Photos to Creative Lab";

sendTopBtn.onclick = () => {
  log("🚀 SEND TOP PHOTOS CLICK");

  // tiny “animated” feedback (no CSS dependency)
  sendTopBtn.classList.add("btn-loading");
  sendTopBtn.style.transform = "scale(0.98)";
  setTimeout(() => {
    sendTopBtn.style.transform = "";
    sendTopBtn.classList.remove("btn-loading");
  }, 220);

  sendSelectedToHoldingZone();
};


// ==================================================
// STEP 3 — HOLDING ZONE RENDER (SINGLE SOURCE)
// Renders STORE.holdingZonePhotos into #holdingZone
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

  const list = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];
  hz.innerHTML = "";

  if (!list.length) return;

  // Ensure active exists
  if (!STORE.activeHoldingPhoto || !list.includes(STORE.activeHoldingPhoto)) {
    STORE.activeHoldingPhoto = list[0] || "";
  }

  list.slice(0, MAX_PHOTOS).forEach((url) => {
    if (!url) return;

    const btn = DOC.createElement("button");
    btn.type = "button";
    btn.className = "holding-thumb-btn";
    if (url === STORE.activeHoldingPhoto) btn.classList.add("active");

    const img = DOC.createElement("img");
    img.className = "holding-thumb-img";
    img.loading = "lazy";
    img.alt = "Holding photo";
    img.src = getProxiedImageUrl(url);

    btn.appendChild(img);

    // ✅ single click = set active + re-render + load into tuner
    btn.addEventListener("click", () => {
      STORE.activeHoldingPhoto = url;
      renderHoldingZone();
      loadPhotoTuner(url);
    });

    // ✅ double click = send to Social-ready strip
    // ✅ ALSO REMOVE from holding zone after sending (your request)
    btn.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // add to social
      addToSocialReady(url, true);

      // remove from holding
      STORE.holdingZonePhotos = (STORE.holdingZonePhotos || []).filter((u) => u !== url);

      // fix active photo if we removed it
      if (STORE.activeHoldingPhoto === url) {
        STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";
      }

      renderHoldingZone();
      renderSocialStrip();

      toast("Sent to Social-ready ✅", "ok");
      log("✅ Sent to social-ready (removed from holding):", url);
    });

    hz.appendChild(btn);
  });

  if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);

  log("✅ Holding zone rendered:", (STORE.holdingZonePhotos || []).length);
} // ✅ DO NOT DELETE THIS CLOSING BRACE



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
    if (typeof STORE.activeHoldingPhoto === "string" && STORE.activeHoldingPhoto.trim()) {
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

    if (STORE.socialReadyPhotos.length && !STORE.socialReadyPhotos.some((p) => p.selected)) {
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
      .concat((STORE.socialReadyPhotos || []).map((p) => ({ ...p, selected: false })))
      .filter((v, i, a) => a.findIndex((x) => x.url === v.url) === i)
      .slice(0, MAX_PHOTOS);

    STORE.socialReadyPhotos = next;
    return true;
  }

  // ==================================================
  // SOCIAL READY STRIP (SINGLE SOURCE)
  // MUST RENDER ONLY INTO: #socialCarousel
  // PREVIEW IMG: #socialCarouselPreviewImg
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
      previewEl.src = active?.url ? getProxiedImageUrl(active.originalUrl || active.url) : "";
    }

    if (statusEl) {
      const lockedCount = list.filter((p) => p && p.locked).length;
      statusEl.textContent = list.length
        ? `Social-ready: ${list.length} • Locked: ${lockedCount}`
        : "No social-ready photos yet.";
    }
  }

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
  // BOOST BUTTON HANDLER (SINGLE SOURCE OF TRUTH)
  // ==================================================
  if (boostBtn && boostBtn.dataset.wired !== "true") {
    boostBtn.dataset.wired = "true";

    boostBtn.onclick = async () => {
      log("🚀 BOOST CLICK");

      const url = dealerUrlInput?.value?.trim?.() || "";
      if (!url) {
        alert("Enter a vehicle URL first.");
        return;
      }

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

        // photos -> cap + dedupe -> Step 1 grid
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

        const step2 = DOC.querySelector("#step2");
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
// Goal for LAUNCH:
// - KEEP floating tools bar + Step 3 container
// - HIDE only 4 future buttons + their panels (Canvas/Design/Image/Video)
// - HIDE bottom video/script output area
// Survives DOM injections via MutationObserver.
// ==================================================
function installHideNextVersionUI() {
  if (window.__LOTROCKET_UI_HIDER_RUNNING__) return;
  window.__LOTROCKET_UI_HIDER_RUNNING__ = true;

  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

  // ✅ NEVER HIDE these containers (launch-critical UI)
  const KEEP_SELECTORS = ["#creativeHub", "#step3", "#creativeLab"];
  const getKeepNodes = () => KEEP_SELECTORS.map((s) => document.querySelector(s)).filter(Boolean);

  // Extra safety: never hide these, even if KEEP nodes aren't found yet
  const isAlwaysKeep = (el) => {
    if (!el) return true;
    if (el === document.documentElement) return true;
    if (el === document.body) return true;
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

    // protect the keep node itself
    if (keeps.some((k) => el === k)) return true;

    // protect any ancestor that contains Step 3 (prevents nuking Step 3 wrappers)
    if (keeps.some((k) => el.contains && el.contains(k))) return true;

    return false;
  };

// ✅ We ONLY want to kill these future buttons (text match)
const FUTURE_BUTTON_TEXT = [
  "ai image generation",
  "ai video generation",
  "canvas studio",
  "design studio",
  "canvas",          // ✅ NEW (your button has no target/action)
  "design",          // ✅ NEW (your button has no target/action)
];


  // ✅ If they use data-ai-action, kill them here too
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
  ]);

  // ✅ If they use data-modal-target, kill them here too
  const HIDE_MODAL_TARGETS = new Set([
    "imageModal",
    "videoModal",
    "canvasModal",
    "designModal",
    "canvasStudioModal",
    "designStudioModal",
  ].map(norm));

  // ✅ Hard-kill the actual DOM containers you showed in DevTools
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

    // console.log("🙈 HID:", reason, el);
    return true;
  };

  const forceShowFloatingBar = () => {
    document
      .querySelectorAll(".floating-tools, #floatingTools, #floatingToolBar")
      .forEach((bar) => {
        if (!bar) return;
        bar.hidden = false;
        bar.removeAttribute("aria-hidden");
        bar.dataset.lrHidden = "0"; // undo any prior hide marks
        bar.style.setProperty("display", "flex", "important");
        bar.style.setProperty("visibility", "visible", "important");
        bar.style.setProperty("pointer-events", "auto", "important");
      });
  };

  const pass = () => {
    // 0) Floating bar MUST stay visible
    forceShowFloatingBar();

    // 1) Always hide Step 3 "Send to Design Studio" future button if it exists
    hideEl(document.getElementById("sendToDesignStudio"), "#sendToDesignStudio");

    // 2) Hard kill by exact IDs/containers
    HARD_KILL_SELECTORS.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) hideEl(el, `hard-kill ${sel}`);
    });

   // 3) Hide ONLY the future buttons inside the floating tools bar (keep launch tools visible)
document
  .querySelectorAll(
    ".floating-tools button, .floating-tools a, .floating-tools [role='button'], .floating-tools .floating-tools-button"
  )
  .forEach((btn) => {
    // emoji-safe + whitespace-safe label
    const cleanLabel = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const txt = cleanLabel(btn.textContent);
    const action = cleanLabel(btn.getAttribute("data-ai-action"));
    const target = cleanLabel(btn.getAttribute("data-modal-target"));

    // exact matches for short labels so we don’t accidentally match “design studio”
    const shortExact = txt === "canvas" || txt === "design";

    // longer labels (must exist in your scope)
    const longContains =
      Array.isArray(FUTURE_BUTTON_TEXT) &&
      FUTURE_BUTTON_TEXT.some((t) => {
        const tt = cleanLabel(t);
        return tt.length > 6 && txt.includes(tt);
      });

    const actionMatch = !!action && HIDE_ACTIONS instanceof Set && HIDE_ACTIONS.has(action);
    const targetMatch = !!target && HIDE_MODAL_TARGETS instanceof Set && HIDE_MODAL_TARGETS.has(target);

    if (shortExact || longContains || actionMatch || targetMatch) {
      hideEl(btn, `floating future btn (${txt || action || target || "unknown"})`);
    }
  });


    // 4) If those buttons open modals by id, hide the modals too (safety)
    document.querySelectorAll(".side-modal, .modal").forEach((m) => {
      const mid = norm(m.id);
      if (!mid) return;

      if (mid.includes("video") || mid.includes("image") || mid.includes("canvas") || mid.includes("design")) {
        // Only hide if it clearly belongs to the future set
        if (mid.includes("canvas") || mid.includes("design") || mid.includes("video") || mid.includes("image")) {
          hideEl(m, `future modal ${m.id}`);
        }
      }
    });

    // 5) Kill any remaining “bottom output” section if present (your DOM shows it)
    const bottom = document.querySelector("#videoOutputBottom");
    if (bottom) hideEl(bottom, "#videoOutputBottom");
  };

  // initial pass
  pass();

  // observer (single)
  if (!window.__LOTROCKET_UI_HIDER_OBSERVER__) {
    const obs = new MutationObserver(() => {
      if (window.__LOTROCKET_UI_HIDER_TICK__) return;
      window.__LOTROCKET_UI_HIDER_TICK__ = true;
      requestAnimationFrame(() => {
        window.__LOTROCKET_UI_HIDER_TICK__ = false;
        pass();
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    window.__LOTROCKET_UI_HIDER_OBSERVER__ = obs;
  }

  // retry loop (covers slow render / late injection)
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    pass();
    if (tries >= 30) clearInterval(t);
  }, 200);

  console.log("✅ UI hider installed (authoritative LAUNCH v4)");
}





  // ==================================================
  // FINAL INIT (SAFE) ✅ MUST BE LAST
  // ==================================================
  try {
    if (STORE.lastBoostPhotos?.length && typeof renderStep1Photos === "function") {
      renderStep1Photos(STORE.lastBoostPhotos);
    }

    if (STORE.holdingZonePhotos?.length) {
      STORE.activeHoldingPhoto =
        STORE.activeHoldingPhoto || STORE.holdingZonePhotos[0] || "";

      if (typeof renderHoldingZone === "function") renderHoldingZone();

      if (STORE.activeHoldingPhoto && typeof loadPhotoTuner === "function") {
        loadPhotoTuner(STORE.activeHoldingPhoto);
      }
    }

    if (typeof renderCreativeThumbs === "function") renderCreativeThumbs();
    if (typeof renderSocialStrip === "function") renderSocialStrip();

    if (typeof wireCalculatorPad === "function") wireCalculatorPad();
    if (typeof wireIncomeCalcDirect === "function") wireIncomeCalcDirect();
    if (typeof wireAiModals === "function") wireAiModals();

    // ✅ Build ToolWire / floating tools first
    if (typeof wireSideTools === "function") wireSideTools();

    // ✅ ONE hide system (persistent)
    if (typeof installHideNextVersionUI === "function") {
      if (!window.__LOTROCKET_UI_HIDER_CALLED__) {
        window.__LOTROCKET_UI_HIDER_CALLED__ = true;
        installHideNextVersionUI();
      }
    } else {
      console.warn("🙈 installHideNextVersionUI() not found at FINAL INIT");
    }

    log("✅ FINAL INIT COMPLETE");
  } catch (e) {
    console.error("❌ FINAL INIT FAILED", e);
  }
}); // ✅ END DOMContentLoaded — THIS MUST BE THE LAST LINE
