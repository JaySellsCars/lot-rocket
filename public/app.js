// ==================================================
// HARD KILL: prevent older cached app.js from running
// (PUT THIS AT VERY TOP OF public/app.js)
// ==================================================
(function () {
  if (window.__LOTROCKET_APPJS_VERSION__ && window.__LOTROCKET_APPJS_VERSION__ !== "999") return;
  window.__LOTROCKET_APPJS_VERSION__ = "999";
})();

// public/app.js — Lot Rocket (CLEAN SINGLE-PASS)
// One boot. One store. One wiring pass. No duplicate blocks.

document.addEventListener("DOMContentLoaded", () => {
  // ==================================================
  // BOOT GUARD + INSPECT
  // ==================================================
  if (window.__LOTROCKET_BOOTED__) {
    console.warn("🚫 Lot Rocket boot blocked (double init) — version:", window.__LOTROCKET_APPJS_VERSION__);
    return;
  }
  window.__LOTROCKET_BOOTED__ = true;
  console.log("✅ APP BOOT — version:", window.__LOTROCKET_APPJS_VERSION__);

  const DOC = document;
  const $ = (id) => DOC.getElementById(id);

  const log = (...a) => console.log(...a);
  const warn = (...a) => console.warn(...a);
  // ==================================================
  // UI HIDER: SINGLE AUTHORITY GUARD
  // ==================================================
  if (window.__LOTROCKET_UI_HIDER_INSTALLED__) {
    console.warn("🧯 UI hider already installed — skipping duplicate");
  }
  window.__LOTROCKET_UI_HIDER_INSTALLED__ = true;

  // ================================
  // CONSTANTS + SINGLE STORE
  // ================================
  const MAX_PHOTOS = 24;

  window.LOTROCKET = window.LOTROCKET || {};
  const STORE = window.LOTROCKET;

  // ✅ DEBUG/TOOLS ACCESS (so DevTools can see it)
  window.STORE = STORE;
  window.LOTROCKET_STORE = STORE;

  // init store arrays
  STORE.step1Photos = Array.isArray(STORE.step1Photos) ? STORE.step1Photos : [];
  STORE.lastBoostPhotos = Array.isArray(STORE.lastBoostPhotos) ? STORE.lastBoostPhotos : [];
  STORE.holdingZonePhotos = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];
  STORE.creativePhotos = Array.isArray(STORE.creativePhotos) ? STORE.creativePhotos : [];
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];

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
try {
  if (typeof installHideNextVersionUI === "function") {
    installHideNextVersionUI();
  }
} catch (e) {
  console.error("❌ UI hider failed", e);
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

    const launcher = DOC.querySelector(`.floating-tools [data-modal-target="${modalId}"]`);
    launcher?.classList.add("active");

    console.log("✅ OPEN MODAL:", modalId);
  }

  function closeSideModal(modalEl) {
    if (!modalEl) return;

    // ✅ MOVE FOCUS OUT BEFORE HIDING (fixes aria-hidden warning)
    if (modalEl.contains(DOC.activeElement)) DOC.activeElement.blur();

    modalEl.classList.add("hidden");
    modalEl.setAttribute("aria-hidden", "true");
    modalEl.classList.remove("open");

    const launcher = DOC.querySelector(`.floating-tools [data-modal-target="${modalEl.id}"]`);
    launcher?.classList.remove("active");

    console.log("✅ CLOSE MODAL:", modalEl.id);
  }

  function wireSideTools() {
    // OPEN buttons (floating tools)
    DOC.querySelectorAll(".floating-tools [data-modal-target]").forEach((btn) => {
      if (btn.dataset.wired === "true") return;
      btn.dataset.wired = "true";

      const targetId = btn.getAttribute("data-modal-target");
      if (!targetId) return;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSideModal(targetId);
      });
    });

    // CLOSE buttons (inside modals)
    DOC.querySelectorAll(".side-modal [data-close], .side-modal .side-modal-close").forEach((btn) => {
      if (btn.dataset.wired === "true") return;
      btn.dataset.wired = "true";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const modal = btn.closest(".side-modal");
        closeSideModal(modal);
      });
    });

    console.log("🧰 Side tools wired");
  }

  // ==================================================
  // WHAT "data-ai-action" IS
  // - It’s an attribute on buttons that tells wireAiModals what tool to run
  //   Example: <button data-ai-action="message_builder">AI Message Builder</button>
  // ==================================================

  // ==================================================
  // OBJECTION COACH — REAL HANDLER (frontend)
  // ==================================================
  window.handleObjectionCoach = async function (text) {
    const out = DOC.querySelector("#objectionOutput");
    if (out) out.textContent = "Thinking…";

    const res = await fetch("/api/objection-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objection: text, history: "" }),
    });

    const data = await res.json().catch(() => ({}));
    window.lastBoostResponse = data;
    STORE.lastBoostResponse = data;

    if (!res.ok) {
      const msg = data?.message || data?.error || `Objection coach failed (HTTP ${res.status})`;
      if (out) out.textContent = "❌ " + msg;
      return;
    }

    const reply = (data?.answer || "").trim();
    if (out) out.textContent = reply || "✅ Coach response received (empty).";
    return reply;
  };

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

    const btn = modal.querySelector("#incomeCalcBtn") || modal.querySelector("[data-ai-action='income_calc']");
    const out = modal.querySelector("#incomeOutput") || modal.querySelector("[data-ai-output]");

    if (!btn) {
      console.warn("🟠 income calc: button not found");
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

      console.log("🟢 INCOME DIRECT CLICK");

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

        console.log("🟢 INCOME DIRECT OK", data);
      } catch (err) {
        console.error("🔴 INCOME DIRECT FAIL", err);
        if (out) out.textContent = `❌ Error: ${err?.message || err}`;
        else alert(err?.message || "Income calc failed");
      }
    });

    console.log("✅ income calc: direct wire complete");
  }

  // ==================================================
  // AI MODALS UNIVERSAL WIRE (SAFE)
  // ==================================================
  function wireAiModals() {
    const modals = Array.from(DOC.querySelectorAll(".side-modal"));
    if (!modals.length) {
      console.warn("🟣 AI-WIRE: no .side-modal found");
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
      const dateEl = pickInside(modal, ["#incomeLastPayDate", "input[name='lastPayDate']", "#lastPayDate", "input[type='date']"]);
      return { mtd: num(mtdEl?.value), lastPayDate: (dateEl?.value || "").trim() };
    };

    modals.forEach((modal) => {
      if (modal.dataset.aiWired === "true") return;
      modal.dataset.aiWired = "true";

      const inner = modal.querySelector(".side-modal-content") || modal.querySelector(".modal-content") || modal.firstElementChild;
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
          console.log("🟣 AI-WIRE: submit blocked", modal.id || "(no id)");
        });
      }

      // ✅ IMPORTANT: buttons must have data-ai-action for this system
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
          console.log("🟣 AI-WIRE: action click", { modal: modalName, action });

          const input = modal.querySelector("[data-ai-input]") || modal.querySelector("textarea") || modal.querySelector("input[type='text']");
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
              objection_coach: { url: "/api/objection-coach", body: { objection: text, history: "" }, pick: (d) => d?.answer || d?.text || "" },
              ask_ai: { url: "/api/message-helper", body: { mode: "ask", prompt: text }, pick: (d) => d?.text || d?.answer || "" },
              message_builder: { url: "/api/message-helper", body: { mode: "message", prompt: text }, pick: (d) => d?.text || d?.answer || "" },
              workflow_builder: { url: "/ai/workflow", body: { goal: "Set the Appointment", tone: "Persuasive, Low-Pressure, High-Value", channel: "Multi-Channel", days: 10, touches: 6 }, pick: (d) => d?.text || "" },
              drill_master: { url: "/api/message-helper", body: { mode: "workflow", prompt: text }, pick: (d) => d?.text || "" },
              car_expert: { url: "/api/message-helper", body: { mode: "car", prompt: text }, pick: (d) => d?.text || "" },

              image_ai: { url: "/api/message-helper", body: { mode: "image-brief", prompt: text }, pick: (d) => d?.text || "" },
              video_ai: { url: "/api/message-helper", body: { mode: "video-brief", prompt: text }, pick: (d) => d?.text || "" },

              payment_calc: { url: "/api/payment-helper", body: collectPaymentBody(modal), pick: (d) => d?.breakdownText || d?.result || d?.text || d?.answer || "" },
              income_calc: { url: "/api/income-helper", body: collectIncomeBody(modal), pick: (d) => d?.result || d?.text || d?.answer || "" },
            };

            const cfg = routeMap[action];
            if (!cfg) throw new Error(`No backend route mapped for action: ${action}`);

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

    console.log("🟣 AI-WIRE: complete (buttons require data-ai-action)");
  } // ✅ closes wireAiModals()

  // ==================================================
  // HIDE NEXT-VERSION UI (SINGLE SOURCE + PERSISTENT)
  // Hides:
  // - Tool rail buttons: AI Image/Video + Canvas/Design (all label variants + data-ai-action)
  // - Step 3 button: #sendToDesignStudio
  // - The big sections shown in your screenshots (Design Studio 3.0 Beta, Canvas Studio overlay)
  // ==================================================
  function installHideNextVersionUI() {
    const actionsToHide = new Set(["image_ai", "video_ai", "canvas_studio", "design_studio"]);

    const labelMatchers = [
      /^ai image generation$/i,
      /^ai video generation$/i,
      /^canvas studio$/i,
      /^design studio$/i,
      /^image ai$/i,
      /^video ai$/i,
      /^canvas$/i,
      /^design$/i,
      /^image$/i,
      /^video$/i,
    ];

    const sectionHeadMatchers = [/^design studio 3\.0\s*\(beta\)$/i, /^canvas studio\s*[-–]\s*creative overlay$/i];

    const normalize = (s) =>
      String(s || "")
        .replace(/\s+/g, " ")
        .replace(/[^\w\s().-]/g, "")
        .trim();

    const shouldHideLabel = (label) => labelMatchers.some((rx) => rx.test(label));
    const shouldHideHeading = (label) => sectionHeadMatchers.some((rx) => rx.test(label));

    const hideEl = (el) => {
      if (!el || el.dataset.lrHidden === "true") return false;
      el.dataset.lrHidden = "true";
      el.setAttribute("aria-hidden", "true");
      el.hidden = true;
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
      el.style.setProperty("pointer-events", "none", "important");
      return true;
    };

    const hideByHeadingText = () => {
      let hidden = 0;
      const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,strong,b"));
      headings.forEach((h) => {
        const t = normalize(h.textContent);
        if (!t) return;
        if (!shouldHideHeading(t)) return;

        const container =
          h.closest(".panel, .modal, .side-modal, .lab-card, section, article, .card, .tool, div") || h.parentElement;

        if (hideEl(container)) hidden++;
      });
      return hidden;
    };

    const hideNow = () => {
      let hidden = 0;

      // Step 3 button
      const step3Btn = document.getElementById("sendToDesignStudio");
      if (step3Btn && hideEl(step3Btn)) hidden++;

      // buttons by data-ai-action
      Array.from(document.querySelectorAll("[data-ai-action]")).forEach((el) => {
        const action = (el.getAttribute("data-ai-action") || "").trim();
        if (action && actionsToHide.has(action)) {
          if (hideEl(el)) hidden++;
        }
      });

      // fallback by label
      Array.from(document.querySelectorAll("button, a, [role='button']")).forEach((el) => {
        const label = normalize(el.textContent);
        if (!label) return;
        if (shouldHideLabel(label)) {
          if (hideEl(el)) hidden++;
        }
      });

      // screenshot sections
      hidden += hideByHeadingText();

      console.log("🙈 installHideNextVersionUI hidden:", hidden);
      return hidden;
    };

    hideNow();

    if (!installHideNextVersionUI.__installed) {
      installHideNextVersionUI.__installed = true;
      const obs = new MutationObserver(() => hideNow());
      obs.observe(document.body, { childList: true, subtree: true });
      console.log("✅ installHideNextVersionUI observer installed");
    }

    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      hideNow();
      if (tries >= 25) clearInterval(timer);
    }, 200);
  }

  // ==================================================
  // STEP 2 POPULATE (from Boost response) ✅ SINGLE SOURCE
  // ==================================================
  function setTextSmart(el, text) {
    if (!el) return false;
    const val = String(text ?? "").trim();
    if ("value" in el) el.value = val;
    else el.textContent = val;
    return true;
  }

  function pickEl(selectors) {
    for (const sel of selectors) {
      const el = DOC.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function applyBoostToStep2(data) {
    console.log("🧪 applyBoostToStep2() RUNNING — keys:", Object.keys(data || {}));
    if (!data || typeof data !== "object") return;

    const clean = (s) => String(s ?? "").trim();
    const isUrlOnly = (s) => /^https?:\/\/\S+$/i.test(clean(s));

    const posts =
      Array.isArray(data.posts) ? data.posts : Array.isArray(data.socialPosts) ? data.socialPosts : Array.isArray(data.captions) ? data.captions : [];

    const p = (i) => clean(posts[i] || "");

    let fb = data.facebook || "";
    let ig = data.instagram || "";
    let tt = data.tiktok || "";
    let li = data.linkedin || "";
    let tw = data.twitter || "";
    let mp = data.marketplace || "";
    let tags = data.hashtags || "";

    let text = data.text || data.textDm || data.textDM || data.textBlurb || data.sms || data.dm || "";

    if (isUrlOnly(fb)) fb = "";
    if (isUrlOnly(ig)) ig = "";
    if (isUrlOnly(tt)) tt = "";
    if (isUrlOnly(li)) li = "";
    if (isUrlOnly(tw)) tw = "";
    if (isUrlOnly(mp)) mp = "";
    if (isUrlOnly(text)) text = "";

    if (!clean(fb) && p(0) && !isUrlOnly(p(0))) fb = p(0);
    if (!clean(ig) && p(1) && !isUrlOnly(p(1))) ig = p(1);
    if (!clean(tt) && p(2) && !isUrlOnly(p(2))) tt = p(2);
    if (!clean(li) && p(3) && !isUrlOnly(p(3))) li = p(3);
    if (!clean(tw) && p(4) && !isUrlOnly(p(4))) tw = p(4);
    if (!clean(text) && p(5) && !isUrlOnly(p(5))) text = p(5);
    if (!clean(mp) && p(6) && !isUrlOnly(p(6))) mp = p(6);

    if (!clean(tags) && p(7)) tags = p(7).replace(/^Hashtags:\s*/i, "").trim();

    const fbEl = pickEl(["#facebookPost"]);
    const igEl = pickEl(["#instagramPost"]);
    const ttEl = pickEl(["#tiktokPost"]);
    const liEl = pickEl(["#linkedinPost"]);
    const twEl = pickEl(["#twitterPost"]);
    const mpEl = pickEl(["#marketplacePost"]);
    const tagsEl = pickEl(["#hashtags"]);
    const textEl = pickEl(["#textBlurb"]);

    console.log("🧪 Step2 elements found:", {
      fbEl: !!fbEl,
      igEl: !!igEl,
      ttEl: !!ttEl,
      liEl: !!liEl,
      twEl: !!twEl,
      mpEl: !!mpEl,
      tagsEl: !!tagsEl,
      textEl: !!textEl,
    });

    if (!fbEl && !igEl && !ttEl && !liEl && !twEl && !textEl) {
      console.warn("🧨 Step2 populate FAILED: none of the Step2 IDs were found in DOM.");
      return;
    }

    const stamp = () => {
      setTextSmart(fbEl, fb);
      setTextSmart(igEl, ig);
      setTextSmart(ttEl, tt);
      setTextSmart(liEl, li);
      setTextSmart(twEl, tw);
      setTextSmart(mpEl, mp);
      setTextSmart(tagsEl, tags);
      setTextSmart(textEl, text);

      const wipeIfUrl = (el) => {
        if (!el) return;
        const v = "value" in el ? el.value : el.textContent;
        if (isUrlOnly(v)) {
          if ("value" in el) el.value = "";
          else el.textContent = "";
        }
      };

      wipeIfUrl(fbEl);
      wipeIfUrl(igEl);
      wipeIfUrl(ttEl);
      wipeIfUrl(liEl);
      wipeIfUrl(twEl);
      wipeIfUrl(mpEl);
      wipeIfUrl(textEl);
    };

    stamp();

    let ticks = 0;
    const iv = setInterval(() => {
      ticks++;
      stamp();
      if (ticks >= 6) clearInterval(iv);
    }, 200);

    STORE.lastBoostKit = data;
  }

  // ==================================================
  // ELEMENTS (READ ONCE)
  // ==================================================
  const dealerUrlInput = $("vehicleUrl") || $("dealerUrl"); // your HTML uses #vehicleUrl
  const vehicleLabelInput = $("vehicleLabel");
  const priceInfoInput = $("priceInfo");

  const summaryLabel = $("summaryLabel") || $("vehicleTitle") || $("vehicleName");
  const summaryPrice = $("summaryPrice") || $("vehiclePrice");

  const boostBtn = $("boostListingBtn") || $("boostThisListingBtn") || $("boostThisListing") || $("boostButton");
  console.log("🧪 boostBtn found:", !!boostBtn, boostBtn?.id || boostBtn);

  const statusText = $("statusText");
  const photosGridEl = $("photosGrid");

  const holdingZoneEl = $("holdingZone") || $("holdingZonePhotos") || $("holdingZoneGrid");
  const tunerPreviewImg = $("tunerPreviewImg");
  const tunerBrightness = $("tunerBrightness");
  const tunerContrast = $("tunerContrast");
  const tunerSaturation = $("tunerSaturation");
  const autoEnhanceBtn = $("autoEnhanceBtn");
  const sendToSocialStripBtn = $("sendToSocialStripBtn");

  const creativeThumbGrid = $("creativeThumbGrid");

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

    // fallback: DOM selected classes
    const grid =
      document.querySelector("#photosGrid") ||
      document.querySelector("#photoGrid") ||
      document.querySelector("#step1PhotoGrid") ||
      document.querySelector(".photo-grid") ||
      document.querySelector("#boostPhotoGrid");

    if (!grid) return [];

    const picked = [];
    const nodes = grid.querySelectorAll("button.photo-thumb-btn.selected, button.photo-thumb-btn.photo-thumb-selected");
    nodes.forEach((btn) => {
      const img = btn.querySelector("img");
      const src = img?.getAttribute("data-original") || img?.getAttribute("data-src") || img?.src || "";
      if (src) picked.push(src);
    });

    return picked.slice(0, MAX_PHOTOS);
  }

  // ==================================================
  // STEP 3 — HOLDING ZONE RENDER (SINGLE SOURCE)
  // ==================================================
  function renderHoldingZone() {
    const hz = $("holdingZone") || DOC.querySelector("#holdingZone");
    if (!hz) {
      console.warn("❌ renderHoldingZone: #holdingZone not found");
      return;
    }

    const list = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];
    hz.innerHTML = "";
    if (!list.length) return;

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

      btn.addEventListener("click", () => {
        STORE.activeHoldingPhoto = url;
        renderHoldingZone();
        loadPhotoTuner(url);
      });

      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        pushToSocialReady(url);
      });

      hz.appendChild(btn);
    });

    if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);
    console.log("✅ Holding zone rendered:", list.length);
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
    applyTunerFilters();
  }

  function applyTunerFilters() {
    if (!tunerPreviewImg) return;
    const b = Number(tunerBrightness?.value || 100) / 100;
    const c = Number(tunerContrast?.value || 100) / 100;
    const s = Number(tunerSaturation?.value || 100) / 100;
    tunerPreviewImg.style.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
  }

  function getActivePhotoUrl() {
    if (typeof STORE.activeHoldingPhoto === "string" && STORE.activeHoldingPhoto.trim()) return STORE.activeHoldingPhoto;
    return "";
  }

  // AUTO ENHANCE
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
  // SOCIAL READY HELPERS (ONE COPY ONLY)
  // ==================================================
  function normalizeSocialReady() {
    STORE.socialReadyPhotos = (STORE.socialReadyPhotos || [])
      .map((p) =>
        typeof p === "string" ? { url: p, originalUrl: p, selected: true, locked: false } : { ...p }
      )
      .filter((p) => p && p.url);

    if (STORE.socialReadyPhotos.length > MAX_PHOTOS) STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(-MAX_PHOTOS);
    if (STORE.socialReadyPhotos.length && !STORE.socialReadyPhotos.some((p) => p.selected)) STORE.socialReadyPhotos[0].selected = true;
  }

  function pushToSocialReady(url) {
    if (!url) return false;
    normalizeSocialReady();

    const next = [{ url, originalUrl: url, selected: true, locked: false }]
      .concat((STORE.socialReadyPhotos || []).map((p) => ({ ...p, selected: false })))
      .filter((v, i, a) => a.findIndex((x) => x.url === v.url) === i)
      .slice(0, MAX_PHOTOS);

    STORE.socialReadyPhotos = next;
    renderSocialStrip();
    return true;
  }

  function setSocialSelectedIndex(nextIdx) {
    normalizeSocialReady();
    const list = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];
    if (!list.length) return;
    const idx = ((nextIdx % list.length) + list.length) % list.length;
    STORE.socialReadyPhotos = list.map((p, i) => ({ ...p, selected: i === idx }));
  }

  // ==================================================
  // SOCIAL READY STRIP (SINGLE SOURCE)
  // Renders ONLY into #socialCarousel + updates preview + status
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
        STORE.socialReadyPhotos = STORE.socialReadyPhotos.map((p, i) => ({ ...p, selected: i === idx }));
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
    if (previewEl) previewEl.src = active?.url ? getProxiedImageUrl(active.originalUrl || active.url) : "";

    if (statusEl) {
      const lockedCount = list.filter((p) => p && p.locked).length;
      statusEl.textContent = list.length ? `Social-ready: ${list.length} • Locked: ${lockedCount}` : "No social-ready photos yet.";
    }
  }

  // DOWNLOAD SOCIAL-READY (LOCKED ONLY)
  if (downloadSocialReadyBtn && downloadSocialReadyBtn.dataset.wired !== "true") {
    downloadSocialReadyBtn.dataset.wired = "true";
    downloadSocialReadyBtn.addEventListener("click", async () => {
      normalizeSocialReady();
      const locked = (STORE.socialReadyPhotos || []).filter((p) => p && p.locked && (p.originalUrl || p.url));

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
          const res = await fetch(getProxiedImageUrl(url));
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

  // Send active tuner photo to strip
  if (sendToSocialStripBtn && sendToSocialStripBtn.dataset.wired !== "true") {
    sendToSocialStripBtn.dataset.wired = "true";
    sendToSocialStripBtn.onclick = () => {
      log("🚀 SEND TO STRIP CLICK");
      setBtnLoading(sendToSocialStripBtn, true, "Sending…");
      const ok = pushToSocialReady(getActivePhotoUrl());
      if (!ok) alert("No active photo selected.");
      setTimeout(() => setBtnLoading(sendToSocialStripBtn, false), 200);
    };
  }

  // ==================================================
  // CREATIVE THUMBS (MINIMAL, STABLE)
  // ==================================================
  function renderCreativeThumbs() {
    if (!creativeThumbGrid) return;

    STORE.creativePhotos = capMax(uniqueUrls(STORE.creativePhotos || []), MAX_PHOTOS);

    if (!STORE.creativePhotos.length) {
      creativeThumbGrid.innerHTML = "";
      return;
    }

    creativeThumbGrid.innerHTML = "";

    STORE.creativePhotos.forEach((url) => {
      const img = DOC.createElement("img");
      img.src = getProxiedImageUrl(url);
      img.alt = "Creative photo";
      img.loading = "lazy";
      img.className = "creative-thumb";

      img.addEventListener("click", () => {
        img.classList.toggle("selected");
        loadPhotoTuner(url);
      });

      img.addEventListener("dblclick", () => {
        pushToSocialReady(url);
      });

      creativeThumbGrid.appendChild(img);
    });

    if (tunerPreviewImg && !tunerPreviewImg.src && STORE.creativePhotos.length) {
      loadPhotoTuner(STORE.creativePhotos[0]);
    }
  }

  // ==================================================
  // STEP 1 → SEND SELECTED → STEP 3 HOLDING ZONE
  // ==================================================
  function sendSelectedToHoldingZone() {
    const urls = getSelectedStep1Urls();
    console.log("🧪 sendSelectedToHoldingZone urls =", urls.length, urls);

    if (!urls.length) {
      alert("Select at least 1 photo first.");
      return;
    }

    STORE.holdingZonePhotos = urls.slice(0, MAX_PHOTOS);
    STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

    renderHoldingZone();
    if (STORE.activeHoldingPhoto) loadPhotoTuner(STORE.activeHoldingPhoto);

    console.log("✅ Sent to Step 3 HOLDING ONLY:", STORE.holdingZonePhotos.length);
  }

  // Wire Step 3 button exists in HTML (we hide it for launch, but keep handler safe)
  const sendToDesignStudioBtn = $("sendToDesignStudio");
  if (sendToDesignStudioBtn && sendToDesignStudioBtn.dataset.wired !== "true") {
    sendToDesignStudioBtn.dataset.wired = "true";
    sendToDesignStudioBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // For now: do nothing / placeholder
      console.log("🧪 sendToDesignStudio clicked (hidden in launch build)");
    });
  }

  // Wire Step1 send top photos button (various IDs)
  const sendTopPhotosBtn =
    $("sendTopPhotosBtn") ||
    $("sendTopPhotosToCreative") ||
    $("sendTopPhotosToCreativeLab") ||
    $("sendToCreativeLabBtn") ||
    $("sendToCreativeLab") ||
    DOC.querySelector("[data-send-top-photos]");

  if (sendTopPhotosBtn && sendTopPhotosBtn.dataset.wired !== "true") {
    sendTopPhotosBtn.dataset.wired = "true";
    sendTopPhotosBtn.onclick = () => {
      console.log("🚀 SEND TOP PHOTOS CLICK");
      sendSelectedToHoldingZone();
    };
  }

  // ==================================================
  // BOOST BUTTON HANDLER (SINGLE SOURCE OF TRUTH)
  // ==================================================
  if (boostBtn && boostBtn.dataset.wired !== "true") {
    boostBtn.dataset.wired = "true";

    boostBtn.onclick = async () => {
      console.log("🚀 BOOST CLICK");

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
        console.log("🧪 BOOST RESPONSE KEYS:", Object.keys(data || {}));

        if (!res.ok) {
          const msg = data?.rawMessage || data?.details || data?.message || data?.error || `Boost failed (HTTP ${res.status})`;
          throw new Error(msg);
        }

        // Step2 fill (most important)
        applyBoostToStep2(data);

        // Summary
        const vLabel = data.vehicleLabel || data.title || "";
        const vPrice = data.priceInfo || data.price || "";
        if (summaryLabel) summaryLabel.textContent = vLabel || "—";
        if (summaryPrice) summaryPrice.textContent = vPrice || "—";
        if (vehicleLabelInput && !vehicleLabelInput.value) vehicleLabelInput.value = vLabel || "";
        if (priceInfoInput && !priceInfoInput.value) priceInfoInput.value = vPrice || "";

        // Photos -> cap + dedupe
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

        const step2 = DOC.querySelector("#step2");
        if (step2) step2.scrollIntoView({ behavior: "smooth" });
      } catch (err) {
        console.error("❌ BOOST FAILED:", err);
        if (statusText) statusText.textContent = "Boost failed.";
        alert(err?.message || "Boost failed.");
      } finally {
        setBtnLoading(boostBtn, false);
      }
    };
  }
// ==================================================
// UI HIDER (AUTHORITATIVE) — KEEP ONE COPY ONLY
// Hides: Design Studio 3.0, AI Video Generator, Video Script / Shot List,
// Thumbnail Prompt, Canvas/Design tools, and future AI panels not in launch.
// Survives DOM injections via MutationObserver.
// ==================================================
function installHideNextVersionUI() {
  // hard guard (prevents duplicates even if function exists multiple times)
  if (window.__LOTROCKET_UI_HIDER_RUNNING__) return;
  window.__LOTROCKET_UI_HIDER_RUNNING__ = true;

  const DOC = document;

  const SHOULD_HIDE_TEXT = [
    "design studio 3.0",
    "ai video generator",
    "video script",
    "shot list",
    "thumbnail prompt",
    "canvas",
    "ai image",
    "ai video",
    "ai prompt",
  ];

  // optional: kill by data-ai-action (strongest selector)
  const SHOULD_HIDE_ACTION = [
    "image_generator",
    "video_generator",
    "video_script",
    "shot_list",
    "thumbnail_prompt",
    "design_studio_3",
    "design_studio_3_0",
    "canvas",
  ];

  function norm(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function hideEl(el, reason) {
    if (!el || el.dataset?.lrHidden === "1") return;
    el.dataset.lrHidden = "1";
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
    // uncomment if you want proof in console while testing:
    // console.log("🧹 HIDING:", reason, el);
  }

  function matchesText(el) {
    const t = norm(el.textContent);
    if (!t) return false;
    return SHOULD_HIDE_TEXT.some((k) => t.includes(k));
  }

  function pass() {
    // 1) Hide buttons by data-ai-action
    DOC.querySelectorAll("[data-ai-action]").forEach((btn) => {
      const a = norm(btn.getAttribute("data-ai-action"));
      if (SHOULD_HIDE_ACTION.includes(a)) {
        hideEl(btn, `data-ai-action=${a}`);
        // if button lives inside a panel, hide the panel too
        const panel = btn.closest("section, .panel, .tool-panel, .lab-card, .card, .modal, .side-modal");
        if (panel) hideEl(panel, `parent panel of action=${a}`);
      }
    });

    // 2) Hide panels/sections by headings + text content
    DOC.querySelectorAll("section, .panel, .tool-panel, .lab-card, .card").forEach((box) => {
      if (matchesText(box)) hideEl(box, "panel text match");
      const h = box.querySelector("h1,h2,h3,h4,h5");
      if (h && matchesText(h)) hideEl(box, "panel heading match");
    });

    // 3) Hide any remaining standalone buttons/links with matching labels
    DOC.querySelectorAll("button,a,[role='button']").forEach((el) => {
      if (matchesText(el)) hideEl(el, "button/label text match");
    });
  }

  // initial pass
  pass();

  // observe late injections (single observer)
  if (window.__LOTROCKET_UI_HIDER_OBSERVER__) return;
  const obs = new MutationObserver(() => {
    // cheap throttle
    if (window.__LOTROCKET_UI_HIDER_TICK__) return;
    window.__LOTROCKET_UI_HIDER_TICK__ = true;
    requestAnimationFrame(() => {
      window.__LOTROCKET_UI_HIDER_TICK__ = false;
      pass();
    });
  });

  obs.observe(DOC.body, { childList: true, subtree: true });
  window.__LOTROCKET_UI_HIDER_OBSERVER__ = obs;

  console.log("✅ UI hider installed (authoritative)");
}

  // ================================
  // FINAL INIT (SAFE) ✅ MUST BE LAST
  // ================================
  try {
    if (STORE.lastBoostPhotos?.length && typeof renderStep1Photos === "function") {
      renderStep1Photos(STORE.lastBoostPhotos);
    }

    if (STORE.holdingZonePhotos?.length) {
      STORE.activeHoldingPhoto = STORE.activeHoldingPhoto || STORE.holdingZonePhotos[0] || "";
      if (typeof renderHoldingZone === "function") renderHoldingZone();
      if (STORE.activeHoldingPhoto && typeof loadPhotoTuner === "function") loadPhotoTuner(STORE.activeHoldingPhoto);
    }

    if (typeof renderCreativeThumbs === "function") renderCreativeThumbs();
    if (typeof renderSocialStrip === "function") renderSocialStrip();

    if (typeof wireCalculatorPad === "function") wireCalculatorPad();
    if (typeof wireIncomeCalcDirect === "function") wireIncomeCalcDirect();

    // build/wire tool UI first
    if (typeof wireAiModals === "function") wireAiModals();
    if (typeof wireSideTools === "function") wireSideTools();

// ✅ hide future UI (buttons + big sections + Step3 design button) — RUN ONCE
if (!window.__LOTROCKET_UI_HIDER_CALLED__) {
  window.__LOTROCKET_UI_HIDER_CALLED__ = true;

  if (typeof installHideNextVersionUI === "function") {
    installHideNextVersionUI();
  } else {
    console.warn("🙈 installHideNextVersionUI() not found");
  }
}


    console.log("✅ FINAL INIT COMPLETE");
  } catch (e) {
    console.error("❌ FINAL INIT FAILED", e);
  }

  // ✅ closes document.addEventListener("DOMContentLoaded", ... )
});
