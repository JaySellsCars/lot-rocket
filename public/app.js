console.log("🚨 RUN GATE HIT", new Date().toISOString());


// redeploy v10003

///// /public/app.js  (REPLACE ENTIRE FILE)
// LOT ROCKET — SINGLE SAFE BOOT FILE (CLEAN / STABLE) v10003
// ✅ Step 2 hardened + isolated (no Step 1 mixing)
// ✅ Step 2 outputs work for textarea OR div/pre
// ✅ Step 2 never leaves “Output…” placeholders
// ✅ Boost supports multiple grids (#step1Photos/#boostPhotoGrid/#photoGrid/#creativeThumbGrid)
// ✅ Thumbs stay square
// ✅ No duplicates / single-pass wiring

(async () => {
  const V = "10003";
  console.log("🚀 APP BOOT OK —", V);

  const DOC = document;
  const $ = (id) => DOC.getElementById(id);
  const q = (sel, root = DOC) => root.querySelector(sel);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  const domReady = () =>
    new Promise((res) => {
      if (DOC.readyState === "loading") DOC.addEventListener("DOMContentLoaded", res, { once: true });
      else res();
    });

  await domReady();

  // ==================================================
  // Auth modal click fix (IMPORTANT)
  // - Your core uses authModalId: "lrAuthModal"
  // - So we must target #lrAuthModal (NOT #lrAuth)
  // ==================================================
style.textContent = `
  /* overlays must win against broken CSS */
  #lrAuthModal.hidden, #lrPaywall.hidden { display:none !important; }

  #lrAuthModal, #lrPaywall {
    position: fixed !important;
    inset: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  #lrAuthModal { z-index: 999999 !important; }
  #lrPaywall  { z-index: 999998 !important; }

  #lrAuthModal *, #lrPaywall * { pointer-events: auto !important; }
`;


/* =========================================================
   SUPABASE + STRIPE + HARD GATE CORE
   SINGLE SOURCE OF TRUTH — NO DUPLICATES
========================================================= */
(() => {
  "use strict";

  // ----------------------------
  // CONFIG
  // ----------------------------
const CFG = Object.assign(
  {
    supabaseUrl: window.SUPABASE_URL || window.LR_SUPABASE_URL || "",
    supabaseAnonKey: window.SUPABASE_ANON_KEY || window.LR_SUPABASE_ANON_KEY || "",

    stripeCheckoutUrl: "/api/stripe/checkout",
    stripeVerifyUrl: "/api/stripe/verify",

    appRootId: "appMain",
    authModalId: "lrAuthModal",
    authMsgId: "lrAuthMsg",
    paywallId: "lrPaywall",

    openAuthBtnId: "lrUserChip",
    logoutBtnId: "lrSignOut",

    emailInputId: "lrEmail",
    passInputId: "lrPass",
    loginBtnId: "lrSignIn",
    signupBtnId: "lrSignUp",

    closePaywallBtnId: "lrClosePaywall",
    upgradeBtnId: "lrSubscribeNow",
  },
  window.LR_CFG || {}
);


  // ----------------------------
  // STATE
  // ----------------------------
  let SB = null;
  let LR_USER = null;
  let LR_SESSION = null;
  let LR_IS_PRO = false;

// ----------------------------
// DOM HELPERS (CLEAN / SINGLE)
// ----------------------------
const qs = (id) => document.getElementById(id);

const setText = (id, msg) => {
  const el = qs(id);
  if (el) el.textContent = msg || "";
};

function getRoot() {
  return qs(CFG.appRootId) || document.body;
}

// ----------------------------
// OVERLAY VISIBILITY (CSS-PROOF)
// ----------------------------
const show = (el) => {
  if (!el) return;

  el.classList.remove("hidden");
  el.setAttribute("aria-hidden", "false");

  // Only hard-force styles for the two overlays that MUST always appear
  if (el.id === CFG.authModalId || el.id === CFG.paywallId) {
    el.style.setProperty("position", "fixed", "important");
    el.style.setProperty("inset", "0", "important");
    el.style.setProperty("display", "flex", "important");
    el.style.setProperty("align-items", "center", "important");
    el.style.setProperty("justify-content", "center", "important");
    el.style.setProperty("visibility", "visible", "important");
    el.style.setProperty("opacity", "1", "important");
    el.style.setProperty("pointer-events", "auto", "important");
    el.style.setProperty("z-index", el.id === CFG.authModalId ? "999999" : "999998", "important");
  } else {
    el.style.setProperty("display", "block", "important");
    el.style.setProperty("visibility", "visible", "important");
    el.style.setProperty("opacity", "1", "important");
  }
};

const hide = (el) => {
  if (!el) return;

  el.classList.add("hidden");
  el.setAttribute("aria-hidden", "true");

  // Hard hide (CSS-proof)
  el.style.setProperty("display", "none", "important");
  el.style.setProperty("opacity", "0", "important");
  el.style.setProperty("visibility", "hidden", "important");
};

// ----------------------------
// HARD LOCK SHIELD (CLICK-PROOF + VISIBLE)
// ----------------------------
function ensureLockShield() {
  let shield = qs("lrLockShield");
  if (shield) return shield;

  shield = document.createElement("div");
  shield.id = "lrLockShield";
  shield.setAttribute("aria-hidden", "true");

  // Visible full-screen gate layer (so "locked" never feels "broken")
  shield.style.setProperty("position", "fixed", "important");
  shield.style.setProperty("inset", "0", "important");
  shield.style.setProperty("display", "none", "important");
  shield.style.setProperty("align-items", "center", "important");
  shield.style.setProperty("justify-content", "center", "important");
  shield.style.setProperty("pointer-events", "auto", "important");
  shield.style.setProperty("z-index", "999990", "important");
  shield.style.setProperty("background", "rgba(0,0,0,.72)", "important");

  shield.innerHTML = `
    <div style="width:min(560px,92vw);background:#0b1020;border:1px solid rgba(148,163,184,.35);border-radius:16px;padding:18px;box-shadow:0 24px 90px rgba(0,0,0,.55);">
      <div style="font-weight:800;font-size:18px;margin-bottom:6px;">🔒 Lot Rocket is a Paid App</div>
      <div style="opacity:.92;line-height:1.35;margin-bottom:14px;" id="lrLockShieldMsg">
        Sign in, then subscribe to unlock access.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button type="button" id="lrShieldSignIn">Sign in</button>
        <button type="button" id="lrShieldSubscribe">Subscribe</button>
      </div>
    </div>
  `;

  document.body.appendChild(shield);

  shield.querySelector("#lrShieldSignIn").addEventListener("click", () => {
    try { openAuth("Sign in to continue."); } catch {}
  });

  shield.querySelector("#lrShieldSubscribe").addEventListener("click", () => {
    try { openPaywall("Subscription required."); } catch {}
  });

  return shield;
}



// ----------------------------
// HARD LOCK SYSTEM (SINGLE)
// ----------------------------
function lockApp() {
  // ✅ use config, not hardcoded IDs
  const shield = ensureLockShield();
shield.style.setProperty("display", "flex", "important");
document.documentElement.classList.add("lr-locked");
document.body.classList.add("lr-locked");


  
  const main = qs(CFG.appRootId);
  const wire = qs("toolWire");
  const auth = qs(CFG.authModalId);
  const pay  = qs(CFG.paywallId);

  const authOpen = !!(auth && !auth.classList.contains("hidden"));
  const payOpen  = !!(pay  && !pay.classList.contains("hidden"));

  // Always lock the app canvas + tools when gated
  if (main) {
    main.style.filter = "blur(6px)";
    main.style.pointerEvents = "none";
    main.style.userSelect = "none";
  }

  if (wire) {
    wire.style.filter = "blur(6px)";
    wire.style.pointerEvents = "none";
    wire.style.userSelect = "none";
  }

  // But ALWAYS allow modal interactivity when they are shown
  if (authOpen && auth) {
    auth.style.filter = "none";
    auth.style.pointerEvents = "auto";
    auth.style.userSelect = "auto";
  }

  if (payOpen && pay) {
    pay.style.filter = "none";
    pay.style.pointerEvents = "auto";
    pay.style.userSelect = "auto";
  }

  getRoot().setAttribute("data-locked", "1");
}

function unlockApp() {
  // ✅ use config, not hardcoded IDs
  document.documentElement.classList.remove("lr-locked");
document.body.classList.remove("lr-locked");

   const shield = document.getElementById("lrLockShield");
  if (shield) shield.style.setProperty("display", "none", "important");
 
  const main = qs(CFG.appRootId);
  const wire = qs("toolWire");

  if (main) {
    main.style.filter = "";
    main.style.pointerEvents = "auto";
    main.style.userSelect = "";
  }

  if (wire) {
    wire.style.filter = "";
    wire.style.pointerEvents = "auto";
    wire.style.userSelect = "";
  }

  getRoot().removeAttribute("data-locked");
}
function getAuthEl() {
  return qs(CFG.authModalId) || qs("lrAuthModal") || qs("lrAuth");
}
function getPayEl() {
  return qs(CFG.paywallId) || qs("lrPaywall");
}

// ----------------------------
// AUTH / PAYWALL UI
// ----------------------------
function openAuth(msg) {
  lockApp();
  hide(getPayEl());
  show(getAuthEl());
  if (msg) setText(CFG.authMsgId, msg);
  console.log("🔒 LOCKED → AUTH", { authFound: !!getAuthEl(), payFound: !!getPayEl() });
}

function closeAuth() {
  hide(getAuthEl());
  setText(CFG.authMsgId, "");
}

function openPaywall(msg) {
  lockApp();
  closeAuth();
  show(getPayEl());
  if (msg) setText(CFG.authMsgId, msg);
  console.log("🔒 LOCKED → PAYWALL", { authFound: !!getAuthEl(), payFound: !!getPayEl() });
}

function closePaywall() {
  hide(getPayEl());
}


// ----------------------------
// BILLING BUTTON UI (SAFE)
// ----------------------------
function showManageBillingBtn() {
  const el = document.getElementById("lrManageBilling");
  if (el) el.classList.remove("hidden");
}

function hideManageBillingBtn() {
  const el = document.getElementById("lrManageBilling");
  if (el) el.classList.add("hidden");
}

// ----------------------------
// SUPABASE INIT (ONE)
// ----------------------------
async function initSupabaseOnce() {
  if (SB) return SB;

  if (!window.supabase) throw new Error("Supabase SDK missing");

  SB = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);

  const { data: s } = await SB.auth.getSession();
  LR_SESSION = s?.session || null;

  const { data: u } = await SB.auth.getUser();
  LR_USER = u?.user || null;

  SB.auth.onAuthStateChange((_e, session) => {
    LR_SESSION = session || null;
    LR_USER = session?.user || null;
    runGate().catch(console.warn);
  });

  return SB;
}

// ----------------------------
// PROFILE ROW ENSURE (FK-SAFE)
// ----------------------------
async function ensureProfileRow() {
  if (!SB) return;

  // ALWAYS pull freshest user from Supabase (don’t trust globals)
  const { data: u } = await SB.auth.getUser();
  const user = u?.user || null;
  if (!user?.id) return;

  const { data } = await SB
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.id) {
    // If FK isn't ready yet, don't crash the app — just skip and let gate retry.
    const { error } = await SB.from("profiles").upsert({
      id: user.id,
      email: user.email || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn("ensureProfileRow upsert skipped:", error.message);
      return;
    }
  }
}


// ===============================
// STRIPE CUSTOMER PORTAL (MANAGE BILLING)
// ===============================
async function openBillingPortal() {
  try {
    if (!SB) return alert("Auth not ready.");

    const { data } = await SB.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return alert("Not logged in.");

    const r = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });

    const j = await r.json();
    if (!r.ok || !j?.url) {
      console.error("portal failed", j);
      return alert(j?.error || "Billing portal unavailable.");
    }

    window.location.href = j.url;
  } catch (e) {
    console.error("openBillingPortal error", e);
    alert("Billing portal error.");
  }
}

// ----------------------------
// STRIPE RETURN CLEANUP + VERIFY  (GET — matches server)
// ----------------------------
async function handleStripeReturnOnce() {
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return;

  console.log("💳 Stripe return detected:", sessionId);

  try {
    const verifyUrl = `${CFG.stripeVerifyUrl}?session_id=${encodeURIComponent(sessionId)}`;

    const r = await fetch(verifyUrl, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      console.error("❌ Stripe verify failed:", j);
      openAuth("Payment verification failed. Please contact support.");
      return;
    }

    console.log("✅ Stripe verified. Refreshing session…");

    await initSupabaseOnce();
    await SB.auth.refreshSession();

  } catch (e) {
    console.error("❌ Stripe verify error:", e);
    openAuth("Payment verification error.");
    return;
  }

  // Clean URL
  url.searchParams.delete("session_id");
  history.replaceState({}, "", url.toString());

  // Re-run gate after payment
  if (typeof runGate === "function") {
    console.log("🚪 Re-running gate after Stripe return");
    await runGate();
  }
}


// ----------------------------
// THE ONLY GATE
// ----------------------------
async function runGate() {
  console.log("🚨 RUN GATE HIT", new Date().toISOString());
  lockApp();
  // 🧯 FAILSAFE: if we’re locked but NO overlay is visible, force one open (prevents blur-only dead state)
  const __visible = (el) =>
    !!(el && !el.classList.contains("hidden") && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  const __failsafe = (tag) => {
    try {
      const root = getRoot();
      const locked = root?.getAttribute("data-locked") === "1";
      if (!locked) return;

      const auth = qs(CFG.authModalId);
      const pay  = qs(CFG.paywallId);

      if (__visible(auth) || __visible(pay)) return;

      if (!LR_USER?.id) openAuth("Sign in to continue.");
      else openPaywall("Subscription required.");

      console.log("🧯 GATE FAILSAFE FIXED BLUR-ONLY —", tag);
    } catch (e) {
      console.warn("🧯 GATE FAILSAFE ERROR", e);
    }
  };

  setTimeout(() => __failsafe("t+0"), 0);
  setTimeout(() => __failsafe("t+400"), 400);
  setTimeout(() => __failsafe("t+1200"), 1200);

  // UI-only: default hidden until PRO is confirmed
  hideManageBillingBtn();

  await initSupabaseOnce();

  if (!LR_USER?.id) {
    closePaywall();
    openAuth("Sign in to continue.");
    return;
  }

  await ensureProfileRow();

  const { data, error } = await SB
    .from("profiles")
    .select("is_pro")
    .eq("id", LR_USER.id)
    .maybeSingle();
console.log("🧾 GATE DECISION", {
  user: LR_USER?.id,
  email: LR_USER?.email,
  is_pro: !!data?.is_pro,
  error: error?.message || null,
});

  // 🔒 NOT PRO (locked path)
if (error || !data?.is_pro) {
  LR_IS_PRO = false;
  hideManageBillingBtn();
  openPaywall("Subscription required.");

  // hard guarantee: stay locked
  lockApp();
  console.log("🔒 GATE LOCKED (NOT PAID)");
  return;
}


  // ✅ PRO USER
  closePaywall();
  closeAuth();
  unlockApp();

  console.log("🔓 PRO UNLOCKED");

  // UI only (billing button)
  showManageBillingBtn();

  if (typeof window.LR_BOOT === "function") {
    window.LR_BOOT({ user: LR_USER, session: LR_SESSION, is_pro: true });
  }
}



// ----------------------------
// AUTH UI
// ----------------------------
function wireAuthOnce() {
  const loginBtn = qs(CFG.loginBtnId);
  const signupBtn = qs(CFG.signupBtnId);
  const logoutBtn = qs(CFG.logoutBtnId);
  const openBtn = qs(CFG.openAuthBtnId);

  async function goStripeCheckout(userId) {
    // POST -> /api/stripe/checkout with userId, then redirect to returned url
    const r = await fetch(CFG.stripeCheckoutUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ userId }),
    });

    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const raw = await r.text();

    if (!ct.includes("application/json")) {
      console.error("❌ STRIPE CHECKOUT NON-JSON", { status: r.status, head: raw.slice(0, 250) });
      throw new Error("Stripe checkout returned non-JSON");
    }

    let j;
    try {
      j = JSON.parse(raw);
    } catch {
      console.error("❌ STRIPE CHECKOUT BAD JSON", raw.slice(0, 250));
      throw new Error("Stripe checkout returned bad JSON");
    }

    if (!r.ok || !j?.url) {
      console.error("❌ STRIPE CHECKOUT FAIL", { status: r.status, j });
      throw new Error(j?.error || `Stripe checkout failed (${r.status})`);
    }

    window.location.href = j.url;
  }

  async function doAuth(mode) {
    await initSupabaseOnce();

    const email = qs(CFG.emailInputId)?.value || "";
    const pass = qs(CFG.passInputId)?.value || "";
    if (!email || !pass) return setText(CFG.authMsgId, "Enter email + password.");

    // SIGN UP → create user, then send to Stripe checkout
    if (mode === "signup") {
      setText(CFG.authMsgId, "Creating account…");

      const { data, error } = await SB.auth.signUp({ email, password: pass });
      if (error) return setText(CFG.authMsgId, error.message);

      // Supabase returns the new user here (even if email confirm is ON)
      const userId = data?.user?.id;
      if (!userId) return setText(CFG.authMsgId, "Signup succeeded, but missing user id.");

      setText(CFG.authMsgId, "Redirecting to payment…");
      try {
        await goStripeCheckout(userId);
      } catch (e) {
        setText(CFG.authMsgId, e?.message || "Stripe redirect failed.");
      }
      return;
    }

     // LOGIN → normal flow (gate decides if they are paid)
    setText(CFG.authMsgId, "Signing in…");
    const { data: loginData, error: loginErr } = await SB.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (loginErr) return setText(CFG.authMsgId, loginErr.message);

    runGate();
  }

  if (loginBtn && !loginBtn.__LR_BOUND__) {
    loginBtn.__LR_BOUND__ = true;
    loginBtn.addEventListener("click", () => doAuth("login"));
  }

  if (signupBtn && !signupBtn.__LR_BOUND__) {
    signupBtn.__LR_BOUND__ = true;
    signupBtn.addEventListener("click", () => doAuth("signup"));
  }

  if (logoutBtn && !logoutBtn.__LR_BOUND__) {
    logoutBtn.__LR_BOUND__ = true;
    logoutBtn.addEventListener("click", async () => {
      await initSupabaseOnce();
      await SB.auth.signOut();
      runGate();
    });
  }

  // UPGRADE (paywall button -> Stripe Checkout)
  const upgradeBtn = qs(CFG.upgradeBtnId);

  if (upgradeBtn && !upgradeBtn.__LR_BOUND__) {
    upgradeBtn.__LR_BOUND__ = true;
    upgradeBtn.addEventListener("click", async () => {
      await initSupabaseOnce();

      const { data: sessData } = await SB.auth.getSession();
      const userId = sessData?.session?.user?.id;

      if (!userId) return openAuth("Sign in first.");

      try {
        const r = await fetch(CFG.stripeCheckoutUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ userId }),
        });

        const j = await r.json().catch(() => null);
        if (j?.url) window.location.href = j.url;
        else alert(j?.error || "Stripe checkout failed.");
      } catch (e) {
        console.error("Upgrade error:", e);
        alert("Stripe checkout error.");
      }
    });
  }

  if (openBtn && !openBtn.__LR_BOUND__) {
    openBtn.__LR_BOUND__ = true;
    openBtn.addEventListener("click", () => openAuth(""));
  }
}
const billBtn = document.getElementById("lrManageBilling");
if (billBtn) billBtn.addEventListener("click", openBillingPortal);

// ----------------------------
// 💳 PAYWALL / UPGRADE → STRIPE CHECKOUT
// ----------------------------

function wirePaywallOnce() {
  const btn = qs(CFG.upgradeBtnId);

  btn &&
    btn.addEventListener("click", async () => {
      await initSupabaseOnce();
      const { data } = await SB.auth.getSession();
      const userId = data?.session?.user?.id;

      if (!userId) return openAuth("Sign in first.");

      try {
        const r = await fetch(CFG.stripeCheckoutUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ userId }),
        });

        const j = await r.json().catch(() => null);
        if (j?.url) window.location.href = j.url;
        else alert(j?.error || "Stripe checkout failed.");
      } catch (e) {
        alert("Stripe checkout error.");
        console.error(e);
      }
    });
}


  // ----------------------------
  // BOOT
  // ----------------------------
(async function boot() {
  try {
    await handleStripeReturnOnce();
    wireAuthOnce();
    wirePaywallOnce();
    await runGate();
  } catch (e) {
    console.warn("CORE BOOT FAIL:", e);
    openAuth("Setup error. Check Supabase keys.");
  }
})();

  // minimal debug
  window.LR_CORE = { runGate, openAuth, openPaywall };
})();



  // ==================================================
  // HARD OVERRIDE: Step 1 thumbnails MUST be square
  // ==================================================
  (function forceSquareThumbs() {
    if (window.__LR_SQUARE_THUMBS__) return;
    window.__LR_SQUARE_THUMBS__ = true;

    const style = document.createElement("style");
    style.id = "lr-square-thumbs-override";
    style.textContent = `
      #step1Photos, #boostPhotoGrid, #photoGrid, #creativeThumbGrid{
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 14px !important;
      }
      .lr-thumb{
        position: relative !important;
        overflow: hidden !important;
        border-radius: 14px !important;
        aspect-ratio: 1 / 1 !important;
        background: rgba(255,255,255,.04) !important;
        border: 1px solid rgba(255,255,255,.12) !important;
      }
      #step1Photos > img, #boostPhotoGrid > img, #photoGrid > img, #creativeThumbGrid > img{
        width: 100% !important;
        aspect-ratio: 1 / 1 !important;
        height: auto !important;
        object-fit: cover !important;
        object-position: center !important;
        border-radius: 14px !important;
        display: block !important;
      }
      .lr-thumb img{
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        object-position: center !important;
        display: block !important;
      }
    `;
    document.head.appendChild(style);
    console.log("✅ SQUARE THUMB OVERRIDE LOADED");
  })();

  // ==================================================
  // SAFE GLOBAL STORE
  // ==================================================
  window.STORE = window.STORE || {};
  const STORE = window.STORE;

  STORE.step1Selected = Array.isArray(STORE.step1Selected) ? STORE.step1Selected : [];
  STORE.holdingZonePhotos = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos : [];
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];

  // ==================================================
  // UI HELPERS
  // ==================================================
  function pressAnim(el) {
    if (!el) return;
    el.classList.remove("lr-press");
    void el.offsetWidth;
    el.classList.add("lr-press");
    setTimeout(() => el.classList.remove("lr-press"), 220);
  }

  function setBtnLoading(btn, onState, label) {
    if (!btn) return;
    if (onState) {
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

  function flashBtn(btn, label = "Done", ms = 700) {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = label;
    setTimeout(() => (btn.textContent = old), ms);
  }

  function autoGrowTextarea(el) {
    if (!el || el.tagName !== "TEXTAREA") return;
    el.style.height = "auto";
    el.style.overflow = "hidden";
    el.style.resize = "none";
    el.style.height = (el.scrollHeight || 0) + "px";
  }

  // output setter works for textarea/input OR div/pre
  function setVal(id, v) {
    const el = $(id);
    if (!el) return;
    const text = (v ?? "").toString();

    if ("value" in el) {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      autoGrowTextarea(el);
      return;
    }
    el.textContent = text;
  }

  // ==================================================
  // HEADER UX
  // ==================================================
  (function wirePremiumHeader() {
    if (window.__LR_HEADER_WIRED__) return;
    window.__LR_HEADER_WIRED__ = true;

    const header = $("appHeader");
    const branding = header?.querySelector?.(".branding");
    const logo = $("appLogo");
    if (!header || !branding || !logo) return;

    branding.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 6);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    function applyLogo() {
      const darkSrc = logo.getAttribute("data-logo-dark") || logo.src;
      const lightSrc = logo.getAttribute("data-logo-light") || logo.src;

      const bodyIsDark =
        document.body.classList.contains("dark") || document.body.classList.contains("dark-theme");

      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

      const next = bodyIsDark || prefersDark ? darkSrc : lightSrc;
      if (next && logo.getAttribute("src") !== next) {
        logo.style.opacity = "0.85";
        logo.setAttribute("src", next);
        setTimeout(() => (logo.style.opacity = "1"), 120);
      }
    }

    applyLogo();
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq?.addEventListener) mq.addEventListener("change", applyLogo);
    }

    window.LR_applyLogoTheme = applyLogo;
    console.log("✅ PREMIUM HEADER WIRED");
  })();

  (function wireHeaderCompact() {
    if (window.__LR_HEADER_COMPACT__) return;
    window.__LR_HEADER_COMPACT__ = true;

    const header = $("appHeader");
    if (!header) return;

    const THRESH = 70;
    const onScroll = () => header.classList.toggle("is-compact", window.scrollY > THRESH);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  })();

  // ==================================================
  // AUTO-GROW OBSERVER + Step 2 textareas
  // ==================================================
  (function wireAutoGrowObserver() {
    if (window.__LR_AUTOGROW__) return;
    window.__LR_AUTOGROW__ = true;

    const obs = new MutationObserver(() => {
      DOC.querySelectorAll("textarea").forEach((ta) => autoGrowTextarea(ta));
    });

    obs.observe(DOC.body, { childList: true, subtree: true, characterData: true });
  })();

  (function wireAiAutoGrow() {
    const sel =
      "#workflowInput,#objectionInput,#messageInput,#askInput,#helpInput,#carExpertInput,[data-ai-followup-input]";
    function grow(el) {
      if (!el || el.tagName !== "TEXTAREA") return;
      el.style.height = "auto";
      el.style.overflow = "hidden";
      el.style.resize = "none";
      el.style.height = Math.min(el.scrollHeight || 0, 420) + "px";
    }

    DOC.querySelectorAll(sel).forEach((ta) => {
      grow(ta);
      ta.addEventListener("input", () => grow(ta));
    });

    DOC.addEventListener("input", (e) => {
      const t = e.target;
      if (t && t.tagName === "TEXTAREA" && t.matches(sel)) grow(t);
    });
  })();

  // ==================================================
  // URL NORMALIZER
  // ==================================================
  function normalizeDealerUrl(raw) {
    let s = (raw || "").toString().trim();
    s = s.replace(/\s+/g, "");

    const lastHttp = Math.max(s.lastIndexOf("http://"), s.lastIndexOf("https://"));
    if (lastHttp > 0) s = s.slice(lastHttp);

    s = s.replace(/^whttps:\/\//i, "https://");
    s = s.replace(/^whttp:\/\//i, "http://");

    if (!/^https?:\/\//i.test(s) && /^[\w.-]+\.[a-z]{2,}/i.test(s)) s = "https://" + s;
    return s;
  }

  // ==================================================
  // SUMMARY
  // ==================================================
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

  // ==================================================
  // STEP 2 MODULE — HARDENED + ISOLATED
  // ==================================================
  (function STEP2() {
    if (window.__LR_STEP2__) return;
    window.__LR_STEP2__ = true;

    const MAP = {
      facebook: "fbOutput",
      instagram: "igOutput",
      tiktok: "ttOutput",
      linkedin: "liOutput",
      x: "xOutput",
      dm: "dmOutput",
      marketplace: "marketplaceOutput",
      hashtags: "hashtagsOutput",
    };

    function outId(platform) {
      return MAP[String(platform || "").toLowerCase()] || "";
    }

    function platformRules(platform) {
      const p = String(platform || "").toLowerCase();
      if (p === "hashtags") return { hashtagsOnly: true };
      if (p === "x") return { maxChars: 280 };
      if (p === "dm") return { maxChars: 420 };
      if (p === "tiktok") return { maxChars: 700 };
      if (p === "instagram") return { maxChars: 900 };
      if (p === "marketplace") return { maxChars: 1400 };
      return { maxChars: 1200 };
    }

    function clampText(text, maxChars) {
      if (!maxChars) return text;
      const t = (text || "").toString();
      if (t.length <= maxChars) return t;
      return t.slice(0, maxChars - 1).trimEnd() + "…";
    }

    function buildDesiredFeatures(v) {
      v = v || {};
      const feats = [];
      const add = (x) => {
        const s = (x || "").toString().trim();
        if (!s) return;
        feats.push(s);
      };

      add(v.engine);
      add(v.drivetrain);
      add(v.transmission || v.trans);
      add(v.trim);
      add(v.mileage ? `Only ${v.mileage}` : "");
      add(v.exterior ? `${v.exterior} Exterior` : "");
      add(v.interior ? `${v.interior} Interior` : "");
      add(v.price ? `Priced at ${v.price}` : "");
      add(v.certified ? "Certified Pre-Owned" : "");
      add(v.oneOwner ? "One Owner" : "");
      add(v.noAccidents ? "No Accidents" : "");
      if (v.packages) add(v.packages);

      const txt = (v.description || "").toString();
      const has = (re) => re.test(txt);
      if (has(/\bcarplay\b/i)) add("Apple CarPlay");
      if (has(/\bandroid auto\b/i)) add("Android Auto");
      if (has(/\badaptive cruise\b|\bacc\b/i)) add("Adaptive Cruise Control");
      if (has(/\bheated steering wheel\b/i)) add("Heated Steering Wheel");
      if (has(/\bheated seats?\b/i)) add("Heated Seats");
      if (has(/\bremote start\b/i)) add("Remote Start");
      if (has(/\bblind spot\b/i)) add("Blind Spot Monitor");
      if (has(/\bcross[-\s]?traffic\b/i)) add("Rear Cross-Traffic Alert");
      if (has(/\blane keep\b|\blane assist\b/i)) add("Lane Keep Assist");
      if (has(/\bpark assist\b|\brear park\b/i)) add("Rear Park Assist");

      const seen = new Set();
      const out = [];
      for (const f of feats) {
        const key = f.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(f);
        if (out.length >= 12) break;
      }
      return out;
    }

    function ensureBullets(text, features) {
      const t = (text || "").toString().trim();
      const hasBullets = /(^|\n)\s*(•|-|⭐|✅|👉)/m.test(t);
      if (hasBullets || !features?.length) return t;
      return t + "\n\n⭐ MOST-WANTED FEATURES:\n" + features.map((f) => `• ${f}`).join("\n");
    }

    function clearPlaceholderOnce() {
      const ids = Object.values(MAP);
      ids.forEach((id) => {
        const el = $(id);
        if (!el) return;
        const val = "value" in el ? el.value || "" : el.textContent || "";
        if (el.__LR_CLEARED_ONCE__) return;
        if (String(val).trim() === "Output...") {
          if ("value" in el) el.value = "";
          else el.textContent = "";
          el.__LR_CLEARED_ONCE__ = true;
        }
      });
    }

    async function aiPost(platform) {
      const v = STORE.lastVehicle || STORE.vehicle || {};
      const rules = platformRules(platform);
      const desiredFeatures = buildDesiredFeatures(v);

      const payload = {
        platform,
        vehicle: {
          url: v.url || "",
          title: v.title || "",
          trim: v.trim || "",
          price: v.price || "",
          mileage: v.mileage || "",
          vin: v.vin || "",
          stock: v.stock || "",
          exterior: v.exterior || "",
          interior: v.interior || "",
          engine: v.engine || "",
          drivetrain: v.drivetrain || "",
          transmission: v.transmission || v.trans || "",
          description: v.description || "",
        },
        style: {
          tone: "high-energy closer",
          structure: "HOOK + BULLETS + CTA",
          bulletsRequired: true,
          hookRequired: true,
          ctaRequired: true,
          noFluff: true,
          rules,
        },
        desiredFeatures,
      };

      const r = await fetch("/api/ai/social", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const raw = await r.text();

      if (!ct.includes("application/json")) {
        console.error("❌ AI SOCIAL NON-JSON", { status: r.status, head: raw.slice(0, 350) });
        throw new Error("AI returned non-JSON");
      }

      let j;
      try {
        j = JSON.parse(raw);
      } catch {
        console.error("❌ AI SOCIAL BAD JSON", raw.slice(0, 350));
        throw new Error("Bad JSON from AI");
      }

      if (!j?.ok) throw new Error(j?.error || "AI failed");

      let text = (j.text || "").toString().trim();

      if (rules.hashtagsOnly) {
        text = text
          .split(/\s+/)
          .filter((w) => w.startsWith("#"))
          .slice(0, 25)
          .join(" ");

        if (!text) {
          const base = (v.title || "Car For Sale")
            .replace(/[^a-z0-9\s]/gi, " ")
            .trim()
            .split(/\s+/)
            .slice(0, 6)
            .map((w) => `#${w}`);
          text = base.join(" ");
        }

        return text.trim();
      }

      text = ensureBullets(text, desiredFeatures);
      text = clampText(text, rules.maxChars);
      return text.trim();
    }

    async function generateOne(platform) {
      clearPlaceholderOnce();
      const id = outId(platform);
      if (!id || !$(id)) return;
      setVal(id, "Generating…");
      try {
        const text = await aiPost(platform);
        setVal(id, text);
      } catch (e) {
        setVal(id, `AI ERROR: ${String(e?.message || e)}`);
      }
    }

    async function generateAll() {
      clearPlaceholderOnce();
      const platforms = ["facebook", "instagram", "tiktok", "linkedin", "x", "dm", "marketplace", "hashtags"];
      for (const p of platforms) await generateOne(p);
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

        b.addEventListener("click", async (e) => {
          e.preventDefault();
          pressAnim(b);
          await generateOne(platform);
        });
      });
    }

    function wireGenerateAll() {
      const genAllBtn = $("generateAllSocialBtn") || DOC.querySelector("[data-generate-all-social]");
      if (!genAllBtn || genAllBtn.__LR_BOUND__) return;
      genAllBtn.__LR_BOUND__ = true;

      genAllBtn.addEventListener("click", (e) => {
        e.preventDefault();
        pressAnim(genAllBtn);
        generateAll();
      });
    }

    window.LR_STEP2 = { generateAll, generateOne, wireRegenButtons, wireGenerateAll, clearPlaceholderOnce };

    clearPlaceholderOnce();
    wireRegenButtons();
    wireGenerateAll();
  })();

  // ==================================================
  // STEP 2 — COPY + REMOVE EMOJIS
  // ==================================================
  (function wireStep2CopyEmoji() {
    const STEP2 = {
      fb: { ta: "fbOutput", copy: "fbCopyBtn", emoji: "fbEmojiBtn" },
      ig: { ta: "igOutput", copy: "igCopyBtn", emoji: "igEmojiBtn" },
      tt: { ta: "ttOutput", copy: "ttCopyBtn", emoji: "ttEmojiBtn" },
      li: { ta: "liOutput", copy: "liCopyBtn", emoji: "liEmojiBtn" },
      x: { ta: "xOutput", copy: "xCopyBtn", emoji: "xEmojiBtn" },
      dm: { ta: "dmOutput", copy: "dmCopyBtn", emoji: "dmEmojiBtn" },
      mk: { ta: "marketplaceOutput", copy: "mkCopyBtn", emoji: "mkEmojiBtn" },
      hash: { ta: "hashtagsOutput", copy: "hashCopyBtn", emoji: "hashEmojiBtn" },
    };

    function stripEmojis(text) {
      if (!text) return "";
      return text
        .replace(/[\p{Extended_Pictographic}]/gu, "")
        .replace(/[\uFE0E\uFE0F]/g, "")
        .replace(/\u200D/g, "")
        .replace(/[^\S\r\n]{2,}/g, " ")
        .trim();
    }

    async function copyText(text) {
      if (!text) return false;
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = DOC.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      DOC.body.appendChild(ta);
      ta.select();
      const ok = DOC.execCommand("copy");
      DOC.body.removeChild(ta);
      return ok;
    }

    Object.values(STEP2).forEach((cfg) => {
      const copyBtn = $(cfg.copy);
      const emojiBtn = $(cfg.emoji);
      const ta = $(cfg.ta);

      if (copyBtn && !copyBtn.__LR_BOUND__) {
        copyBtn.__LR_BOUND__ = true;
        copyBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          pressAnim(copyBtn);
          const text = ((ta && ("value" in ta ? ta.value : ta.textContent)) || "").trim();
          if (!text) return;
          try {
            await copyText(text);
            flashBtn(copyBtn, "Copied!");
          } catch {
            flashBtn(copyBtn, "Copy failed");
          }
        });
      }

      if (emojiBtn && ta && !emojiBtn.__LR_BOUND__) {
        emojiBtn.__LR_BOUND__ = true;
        emojiBtn.addEventListener("click", (e) => {
          e.preventDefault();
          pressAnim(emojiBtn);

          const get = () => ("value" in ta ? ta.value : ta.textContent) || "";
          const set = (v) => {
            if ("value" in ta) ta.value = v;
            else ta.textContent = v;
            autoGrowTextarea(ta);
          };

          if (!ta.__LR_EMOJI_ORIG__) ta.__LR_EMOJI_ORIG__ = get();

          const isStripped = !!ta.__LR_EMOJI_STRIPPED__;
          if (!isStripped) {
            set(stripEmojis(get()));
            ta.__LR_EMOJI_STRIPPED__ = true;
            emojiBtn.textContent = "Restore Emojis";
          } else {
            set(ta.__LR_EMOJI_ORIG__ || "");
            ta.__LR_EMOJI_STRIPPED__ = false;
            emojiBtn.textContent = "Remove Emojis";
          }
        });
      }
    });
  })();

  // ==================================================
  // CALCULATOR PAD
  // ==================================================
  (function wireCalculatorPad() {
    if (window.__LR_CALC_WIRED__) return;
    window.__LR_CALC_WIRED__ = true;

    const modal = $("calcModal");
    const display = $("calcDisplay");
    if (!modal || !display) return;

    display.setAttribute("readonly", "readonly");
    display.value = display.value || "";

    const buttons = modal.querySelectorAll("[data-calc]");
    const isOp = (c) => ["+", "-", "*", "/"].includes(c);

    function safeEval(expr) {
      const ok = /^[0-9+\-*/().\s]+$/.test(expr);
      if (!ok) throw new Error("bad_chars");
      if (expr.includes("**")) throw new Error("bad_op");
      // eslint-disable-next-line no-new-func
      return Function(`"use strict"; return (${expr});`)();
    }

    function setDisplay(v) {
      display.value = String(v ?? "");
    }

    function append(ch) {
      const cur = display.value || "";
      if (cur === "Error") return setDisplay(ch);

      if (isOp(ch)) {
        if (!cur) return;
        const last = cur.slice(-1);
        if (isOp(last)) return setDisplay(cur.slice(0, -1) + ch);
      }

      if (ch === ".") {
        const parts = cur.split(/[\+\-\*\/]/);
        const lastChunk = parts[parts.length - 1] || "";
        if (lastChunk.includes(".")) return;
        if (!lastChunk.length) return setDisplay(cur + "0.");
      }

      setDisplay(cur + ch);
    }

    function backspace() {
      const cur = display.value || "";
      if (!cur || cur === "Error") return setDisplay("");
      setDisplay(cur.slice(0, -1));
    }

    function clearAll() {
      setDisplay("");
    }

    function evaluate() {
      const expr = (display.value || "").trim();
      if (!expr) return;

      try {
        const result = safeEval(expr);
        if (!Number.isFinite(result)) throw new Error("nan");
        const rounded =
          Math.abs(result) > 1e12 ? result.toExponential(6) : Math.round(result * 1e9) / 1e9;
        setDisplay(rounded);
      } catch {
        setDisplay("Error");
        setTimeout(() => {
          if (display.value === "Error") setDisplay("");
        }, 700);
      }
    }

    buttons.forEach((b) => {
      if (b.__LR_BOUND__) return;
      b.__LR_BOUND__ = true;

      b.addEventListener("click", () => {
        const v = b.getAttribute("data-calc");
        if (!v) return;
        if (v === "C") return clearAll();
        if (v === "⌫") return backspace();
        if (v === "=") return evaluate();
        append(v);
      });
    });

    DOC.addEventListener("keydown", (e) => {
      const isOpen = !modal.classList.contains("hidden") && modal.style.display !== "none";
      if (!isOpen) return;

      const k = e.key;

      if (k === "Escape") return (e.preventDefault(), clearAll());
      if (k === "Enter" || k === "=") return (e.preventDefault(), evaluate());
      if (k === "Backspace") return (e.preventDefault(), backspace());

      if (/[0-9]/.test(k)) return (e.preventDefault(), append(k));
      if (["+", "-", "*", "/"].includes(k)) return (e.preventDefault(), append(k));
      if (k === ".") return (e.preventDefault(), append("."));
      if (k === "(" || k === ")") return (e.preventDefault(), append(k));
    });

    console.log("✅ CALCULATOR WIRED");
  })();

  // ==================================================
  // FLOATING TOOLS WIRING
  // ==================================================
  (function wireFloatingTools() {
    if (window.__LR_FLOATING_TOOLS__) return;
    window.__LR_FLOATING_TOOLS__ = true;

    const BTN = {
      objection: "toolObjectionBtn",
      calc: "toolCalcBtn",
      payment: "toolPaymentBtn",
      income: "toolIncomeBtn",
      workflow: "toolWorkflowBtn",
      message: "toolMessageBtn",
      ask: "toolAskBtn",
      help: "toolHelpBtn",
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
      help: "helpModal",
      car: "carExpertModal",
      image: "imageGenModal",
      video: "videoGenModal",
    };

    [BTN.image, BTN.video].forEach((id) => {
      const b = $(id);
      if (b) b.style.display = "none";
    });

    const wfBtn = $(BTN.workflow);
    if (wfBtn) wfBtn.textContent = "AI Campaign Builder";

    const wfRun = $("runWorkflowBtn");
    if (wfRun) wfRun.textContent = "Build Campaign";

    const allBtnIds = Object.values(BTN);

    function setActive(btnId) {
      allBtnIds.forEach((id) => {
        const b = $(id);
        if (b) b.classList.toggle("active", id === btnId);
      });
    }

    function closeModal(modalId) {
      const m = $(modalId);
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
      const m = $(modalId);
      if (!m) return;

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

    on(DOC, "keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });

    function bind(key) {
      const btnId = BTN[key];
      const modalId = MODAL[key];
      const b = $(btnId);
      if (!b || b.__LR_BOUND__) return;
      b.__LR_BOUND__ = true;

      b.addEventListener("click", () => {
        pressAnim(b);
        const m = $(modalId);
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
  // AI EXPERTS — DELEGATED + CORRECT PAYLOADS
  // ==================================================
  (function wireAiExpertsDelegated() {
    if (window.__LR_AI_EXPERTS_DELEGATED__) return;
    window.__LR_AI_EXPERTS_DELEGATED__ = true;

    function buildCampaignScenario(userText) {
      const v = window.STORE?.lastVehicle || {};
      const vehicleLine =
        v?.title || v?.price || v?.mileage
          ? `Vehicle Context (if relevant): ${[
              v.title ? v.title : "",
              v.price ? `Price ${v.price}` : "",
              v.mileage ? `Miles ${v.mileage}` : "",
              v.vin ? `VIN ${v.vin}` : "",
              v.stock ? `Stock ${v.stock}` : "",
            ]
              .filter(Boolean)
              .join(" • ")}`
          : "";

      return [
        "ROLE: You are the Lot Rocket AI Campaign Builder.",
        "GOAL: Book an appointment. Every output must drive a clear CTA to DM/call/book.",
        "STYLE: Short, platform-specific, no fluff.",
        "",
        vehicleLine ? vehicleLine : "",
        vehicleLine ? "" : "",
        "USER REQUEST / SITUATION:",
        (userText || "").trim(),
      ]
        .filter((x) => x !== "")
        .join("\n");
    }

    const btnToType = {
      runObjectionBtn: "objection",
      objectionRunBtn: "objection",
      runMessageBtn: "message",
      messageRunBtn: "message",
      runWorkflowBtn: "campaign",
      runAskBtn: "ask",
      askRunBtn: "ask",
      runHelpBtn: "help",
      runCarExpertBtn: "car",
      carExpertRunBtn: "car",
    };

    const typeToEndpoint = {
      objection: "/api/ai/objection",
      message: "/api/ai/message",
      campaign: "/api/ai/workflow",
      ask: "/api/ai/ask",
      help: "/api/ai/ask",
      car: "/api/ai/car",
    };

    const typeToOutputId = {
      objection: "objectionOutput",
      message: "messageOutput",
      campaign: "workflowOutput",
      ask: "askOutput",
      help: "helpOutput",
      car: "carExpertOutput",
    };

    function closestModal(el) {
      return el?.closest?.(".side-modal") || null;
    }

    function findInput(modal, type) {
      const byType = {
        objection: "#objectionInput",
        message: "#messageInput",
        campaign: "#workflowInput",
        ask: "#askInput",
        help: "#helpInput",
        car: "#carExpertInput",
      };
      const explicit = byType[type] ? modal?.querySelector(byType[type]) : null;

      return (
        explicit ||
        modal?.querySelector("textarea") ||
        modal?.querySelector("input[type='text']") ||
        modal?.querySelector("input:not([type])") ||
        null
      );
    }

    function findOutput(modal, type) {
      const preferred = typeToOutputId[type];
      return (
        (preferred ? modal?.querySelector(`#${CSS.escape(preferred)}`) : null) ||
        modal?.querySelector("[data-ai-output]") ||
        modal?.querySelector(".ai-output") ||
        modal?.querySelector("pre") ||
        modal?.querySelector("div") ||
        null
      );
    }

    function vehicleToString(v) {
      if (!v || typeof v !== "object") return "";
      const parts = [
        v.title ? `Title: ${v.title}` : "",
        v.price ? `Price: ${v.price}` : "",
        v.mileage ? `Mileage: ${v.mileage}` : "",
        v.exterior ? `Exterior: ${v.exterior}` : "",
        v.interior ? `Interior: ${v.interior}` : "",
        v.engine ? `Engine: ${v.engine}` : "",
        (v.transmission || v.trans) ? `Transmission: ${v.transmission || v.trans}` : "",
        v.drivetrain ? `Drivetrain: ${v.drivetrain}` : "",
        v.vin ? `VIN: ${v.vin}` : "",
        v.stock ? `Stock: ${v.stock}` : "",
      ].filter(Boolean);
      return parts.join("\n");
    }

    function buildPayload(type, text) {
      const v = window.STORE?.lastVehicle || {};
      if (type === "objection") return { objection: text };
      if (type === "message") return { input: text };
      if (type === "campaign") return { scenario: buildCampaignScenario(text) };
      if (type === "ask") return { question: text, context: { tool: "ask" } };
      if (type === "help")
        return {
          question: text,
          context: {
            tool: "help",
            app: "lot-rocket",
            version: V,
            hint: "Answer only about using Lot Rocket + troubleshooting.",
          },
        };
      if (type === "car") return { vehicle: vehicleToString(v), question: text };
      return { input: text };
    }

    async function callAI(endpoint, payload) {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const raw = await r.text();
      if (!ct.includes("application/json")) throw new Error("Server returned non-JSON");

      const j = JSON.parse(raw);
      if (j && typeof j === "object" && "ok" in j && !j.ok) throw new Error(j?.error || "AI failed");
      return j?.text || "";
    }

    function setBusy(btn, onBusy) {
      if (!btn) return;
      if (onBusy) {
        btn.__LR_OLD_TEXT__ = btn.__LR_OLD_TEXT__ ?? btn.textContent;
        btn.textContent = "Working…";
        btn.disabled = true;
      } else {
        btn.textContent = btn.__LR_OLD_TEXT__ || btn.textContent;
        btn.disabled = false;
      }
    }

    DOC.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.("button");
      if (!btn || !btn.id) return;

      const type = btnToType[btn.id];
      if (!type) return;

      const endpoint = typeToEndpoint[type];
      if (!endpoint) return;

      e.preventDefault();

      const modal = closestModal(btn);
      const input = findInput(modal, type);
      const output = findOutput(modal, type);

      if (!input || !output) return;

      const text = (input.value || "").trim();
      if (!text) {
        output.textContent = "⚠️ Type something in the box first.";
        return;
      }

      setBusy(btn, true);
      output.textContent = "Thinking…";

      try {
        const payload = buildPayload(type, text);
        const answer = await callAI(endpoint, payload);
        output.textContent = answer;
      } catch (err) {
        output.textContent = "AI ERROR: " + (err?.message || err);
      } finally {
        setBusy(btn, false);
      }
    });

    console.log("✅ AI EXPERTS DELEGATED WIRED");
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
        return { url: p.url || p.src || "", locked: !!p.locked, selected: !!p.selected };
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
      img.alt = "";

      const lock = DOC.createElement("div");
      lock.className = "social-lock";
      lock.textContent = p.locked ? "🔒" : "🔓";
      lock.title = "Double-click to lock/unlock";

      if (p.selected) {
        btn.style.outline = "2px solid rgba(56,189,248,.95)";
        btn.style.outlineOffset = "0px";
      }

      btn.addEventListener("click", () => {
        setSelectedSocialIndex(idx);
        renderSocialStrip();
      });

      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        normalizeSocialReady();
        const cur = STORE.socialReadyPhotos[idx];
        if (!cur) return;
        cur.locked = !cur.locked;
        renderSocialStrip();
      });

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

  async function downloadLockedZip() {
    normalizeSocialReady();
    const locked = (STORE.socialReadyPhotos || []).filter((p) => p.locked).slice(0, 24);

    if (!locked.length) return alert("Lock at least 1 photo first.");
    if (!window.JSZip) return alert("JSZip not loaded.");

    const zipBtn = $("downloadZipBtn");
    setBtnLoading(zipBtn, true, "Zipping…");

    async function blobToJpegBlob(blob, quality = 0.92) {
      if (!blob) throw new Error("missing blob");
      if (blob.type === "image/jpeg") return blob;

      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0);

      if (bmp.close) bmp.close();

      return await new Promise((resolve, reject) => {
        canvas.toBlob(
          (out) => (out ? resolve(out) : reject(new Error("JPEG conversion failed"))),
          "image/jpeg",
          quality
        );
      });
    }

    try {
      const zip = new JSZip();
      const folder = zip.folder("lot-rocket");
      let ok = 0;

      for (let i = 0; i < locked.length; i++) {
        const url = locked[i].url;

        try {
          const prox = `/api/proxy?url=${encodeURIComponent(url)}`;
          const r = await fetch(prox, { cache: "no-store" });
          if (!r.ok) throw new Error("proxy fetch failed");

          const blob = await r.blob();
          const jpegBlob = await blobToJpegBlob(blob, 0.92);
          folder.file(`photo_${String(i + 1).padStart(2, "0")}.jpg`, jpegBlob);

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

  // ==================================================
  // PAYMENT CALCULATOR
  // ==================================================
  function wirePaymentCalculator() {
    const modal = $("paymentModal");
    if (!modal) return;

    const pickInside = (root, selectors) => {
      for (const sel of selectors) {
        const el = root.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    const num = (v) => {
      if (v == null) return 0;
      const s = String(v).replace(/[$,%\s,]/g, "").trim();
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    const collectPaymentBody = (root) => ({
      price: num(pickInside(root, ["#payPrice", "input[name='price']", "#price"])?.value),
      down: num(pickInside(root, ["#payDown", "input[name='down']", "#down"])?.value),
      trade: num(pickInside(root, ["#payTrade", "input[name='trade']", "#trade"])?.value),
      payoff: num(pickInside(root, ["#payPayoff", "input[name='payoff']", "#payoff"])?.value),
      rate: num(pickInside(root, ["#payApr", "#payRate", "input[name='apr']", "#apr", "#rate"])?.value),
      term: num(pickInside(root, ["#payTerm", "input[name='term']", "#term"])?.value),
      tax: num(pickInside(root, ["#payTax", "input[name='tax']", "#tax"])?.value),
      fees: num(pickInside(root, ["#payFees", "#dealerFees", "input[name='fees']", "#fees"])?.value),
      state: String(
        pickInside(root, ["#payState", "select[name='state']", "input[name='state']"])?.value || "MI"
      )
        .trim()
        .toUpperCase(),
      rebate: num(pickInside(root, ["#payRebate", "input[name='rebate']", "#rebate"])?.value),
    });

    const btn = modal.querySelector("#payCalcBtn");
    const out = modal.querySelector("#payOutput");

    if (!btn || !out) return;
    if (btn.__LR_BOUND__) return;
    btn.__LR_BOUND__ = true;

    const setLoading = (onBusy) => {
      btn.disabled = !!onBusy;
      if (onBusy) {
        btn.__LR_OLD_TEXT__ = btn.__LR_OLD_TEXT__ ?? btn.textContent;
        btn.textContent = "Calculating…";
      } else {
        btn.textContent = btn.__LR_OLD_TEXT__ || "Calculate";
      }
    };

    async function runPaymentCalc() {
      const body = collectPaymentBody(modal);

      if (!body.price || !body.term) {
        out.textContent = "Enter at least Price and Term (months).";
        return;
      }

      setLoading(true);
      out.textContent = "Working…";

      try {
        const r = await fetch("/api/payment-helper", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
        });

        const j = await r.json().catch(() => null);

        if (!r.ok) {
          const msg = j?.message || j?.error || `Request failed (${r.status})`;
          out.textContent = msg;
          return;
        }

        out.textContent = j?.breakdownText || j?.result || "Done.";
      } catch (e) {
        out.textContent = "Network error. Check server logs / endpoint.";
        console.error("payment calc failed:", e);
      } finally {
        setLoading(false);
      }
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      runPaymentCalc();
    });

    modal.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "SELECT")) {
          e.preventDefault();
          runPaymentCalc();
        }
      }
    });

    console.log("✅ PAYMENT CALC WIRED");
  }

  // ==================================================
  // INCOME CALCULATOR
  // ==================================================
  function wireIncomeCalcDirect() {
    const modal = $("incomeModal");
    if (!modal) return;

    const $in = (sel) => modal.querySelector(sel);

    const mtdEl = $in("#incomeMtd");
    const dateEl = $in("#incomeLastPayDate");
    const btn = $in("#incomeCalcBtn");
    const out = $in("#incomeOutput");

    if (!mtdEl || !dateEl || !btn || !out) return;
    if (btn.__LR_BOUND__) return;
    btn.__LR_BOUND__ = true;

    const num = (v) => {
      if (v == null) return 0;
      const s = String(v).replace(/[$,%\s,]/g, "").trim();
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    const money = (n) =>
      `$${Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    function daysInYear(year) {
      const start = new Date(year, 0, 1);
      const end = new Date(year + 1, 0, 1);
      return Math.round((end - start) / 86400000);
    }

    function clamp(n, a, b) {
      return Math.max(a, Math.min(b, n));
    }

    function calc() {
      const grossToDate = num(mtdEl.value);
      const payDateRaw = (dateEl.value || "").trim();

      if (!grossToDate || !payDateRaw) {
        out.textContent = "Enter Gross to date and your last pay date.";
        return;
      }

      const payDate = new Date(payDateRaw + "T12:00:00");
      if (Number.isNaN(payDate.getTime())) {
        out.textContent = "Invalid pay date.";
        return;
      }

      const year = payDate.getFullYear();
      const yearStart = new Date(year, 0, 1, 12, 0, 0);
      const yearEnd = new Date(year + 1, 0, 1, 12, 0, 0);

      if (payDate < yearStart || payDate >= yearEnd) {
        out.textContent = "Pay date must be within the same year you’re calculating.";
        return;
      }

      const elapsedDays = Math.max(1, Math.floor((payDate - yearStart) / 86400000) + 1);
      const totalDays = daysInYear(year);

      const fractionOfYear = clamp(elapsedDays / totalDays, 1 / totalDays, 1);
      const weeksIntoYear = elapsedDays / 7;

      const estAnnual = grossToDate / fractionOfYear;
      const avgWeekly = estAnnual / 52;
      const avgMonthly = estAnnual / 12;

      out.textContent = [
        `Estimated Annual Gross: ${money(estAnnual)}`,
        `Weeks into year: ${weeksIntoYear.toFixed(1)} (as of ${payDateRaw})`,
        `Gross-to-date: ${money(grossToDate)}`,
        "",
        `Average Weekly: ${money(avgWeekly)}`,
        `Average Monthly: ${money(avgMonthly)}`,
        "",
        "Note: This annualizes your year-to-date earnings based on how far into the year your last pay date is.",
      ].join("\n");
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      calc();
    });

    modal.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const t = e.target;
        if (t && (t === mtdEl || t === dateEl)) {
          e.preventDefault();
          calc();
        }
      }
    });

    console.log("✅ INCOME CALC WIRED");
  }

  // ==================================================
  // STEP 3: HOLDING ZONE
  // ==================================================
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

    const photos = Array.isArray(STORE.holdingZonePhotos) ? STORE.holdingZonePhotos.slice(0, 24) : [];
    hz.innerHTML = "";

    if (!photos.length) {
      hz.innerHTML = `<div class="small-note" style="opacity:.7;padding:.5rem 0;">No photos in holding zone yet.</div>`;
      return;
    }

    photos.forEach((src) => {
      const img = DOC.createElement("img");
      img.src = src;
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = "";

      img.addEventListener("dblclick", (e) => {
        e.preventDefault();
        addToSocialReady(src, true);
      });

      hz.appendChild(img);
    });
  }

  // ==================================================
  // STEP 1: SEND SELECTED → STEP 3
  // ==================================================
  function syncSendBtn() {
    const btn = $("sendToDesignStudio");
    if (!btn) return;
    const n = Array.isArray(STORE.step1Selected) ? STORE.step1Selected.length : 0;
    btn.disabled = n === 0;
    btn.style.opacity = n === 0 ? "0.55" : "1";
    btn.style.pointerEvents = n === 0 ? "none" : "auto";
  }

  (function wireSendToCreativeLab() {
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

      const picked = Array.isArray(STORE.step1Selected) ? STORE.step1Selected.slice(0, 24) : [];
      if (!picked.length) return alert("Select at least 1 photo first.");

      STORE.holdingZonePhotos = picked.slice(0, 24);
      STORE.activeHoldingPhoto = STORE.holdingZonePhotos[0] || "";

      renderHoldingZone();

      const step3 = $("creativeHub");
      if (step3) step3.scrollIntoView({ behavior: "smooth" });
    });
  })();

  // ==================================================
  // HEALTH CHECK
  // ==================================================
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    const json = await res.json();
    console.log("✅ API HEALTH:", json);
  } catch {}

  // ==================================================
  // BOOST (Step 1) → photos + vehicle + Step 2 AI
  // ==================================================
  const boostBtn = $("boostBtn");
  const urlInput = $("dealerUrlInput");

  if (boostBtn && !boostBtn.__LR_BOUND__) {
    boostBtn.__LR_BOUND__ = true;

    boostBtn.addEventListener("click", async () => {
      pressAnim(boostBtn);
      setBtnLoading(boostBtn, true, "Boosting…");

      try {
        const raw = urlInput?.value?.trim();
        const url = normalizeDealerUrl(raw);
        if (!url) return alert("Paste a valid vehicle URL first.");

        let res, data;

        try {
          res = await fetch(`/api/boost?url=${encodeURIComponent(url)}`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
          });

          const ct = (res.headers.get("content-type") || "").toLowerCase();
          if (!ct.includes("application/json")) {
            const txt = await res.text();
            console.error("❌ BOOST NON-JSON RESPONSE", {
              status: res.status,
              contentType: ct,
              head: txt.slice(0, 300),
            });
            alert(`Boost returned NON-JSON (status ${res.status}).`);
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

        STORE.lastVehicle = data.vehicle || { url, title: data.title || "" };
        STORE.lastVehicle.url = STORE.lastVehicle.url || url;

        renderSummary(STORE.lastVehicle);

        // Step 2 bridge only
        window.LR_STEP2?.clearPlaceholderOnce?.();
        window.LR_STEP2?.wireRegenButtons?.();
        window.LR_STEP2?.wireGenerateAll?.();
        window.LR_STEP2?.generateAll?.();

        const rawImages = Array.isArray(data.images) ? data.images : [];
        const images = [...new Set(rawImages)].filter(Boolean);

        const grid = $("step1Photos") || $("boostPhotoGrid") || $("photoGrid") || $("creativeThumbGrid");
        if (!grid) return;

        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
        grid.style.gap = "14px";
        grid.innerHTML = "";

        if (!images.length) {
          grid.innerHTML = `
            <div style="opacity:.75;padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:12px;">
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
          tile.className = "lr-thumb";
          tile.style.position = "relative";
          tile.style.cursor = "pointer";
          tile.style.borderRadius = "14px";
          tile.style.overflow = "hidden";
          tile.style.border = "1px solid rgba(255,255,255,.12)";
          tile.style.background = "rgba(255,255,255,.04)";
          tile.style.aspectRatio = "1 / 1";

          const img = DOC.createElement("img");
          img.src = src;
          img.loading = "lazy";
          img.decoding = "async";
          img.alt = "";
          img.style.position = "absolute";
          img.style.inset = "0";
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          img.style.objectPosition = "center";
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
            tile.style.outline = active ? "2px solid rgba(56,189,248,.55)" : "none";
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
    });
  }

  // ==================================================
  // UNIVERSAL AI FOLLOW-UP (ALL MODALS)
  // ==================================================
  function wireAiFollowups() {
    const configs = [
      ["workflowModal", "workflowInput", "runWorkflowBtn", "workflowOutput"],
      ["objectionModal", "objectionInput", "runObjectionBtn", "objectionOutput"],
      ["messageModal", "messageInput", "runMessageBtn", "messageOutput"],
      ["askModal", "askInput", "runAskBtn", "askOutput"],
      ["helpModal", "helpInput", "runHelpBtn", "helpOutput"],
      ["carExpertModal", "carExpertInput", "runCarExpertBtn", "carExpertOutput"],
    ];

    const labelMap = {
      workflowModal: "Continue Campaign",
      objectionModal: "Continue Objection",
      messageModal: "Continue Message",
      askModal: "Continue Strategy",
      helpModal: "Continue Help",
      carExpertModal: "Continue Car Expert",
    };

    configs.forEach(([modalId, inputId, runBtnId, outputId]) => {
      const modal = $(modalId);
      const mainInput = $(inputId);
      const runBtn = $(runBtnId);
      const outEl = $(outputId);
      if (!modal || !mainInput || !runBtn || !outEl) return;

      const followWrap = modal.querySelector("[data-ai-followup]");
      const followInput = modal.querySelector("[data-ai-followup-input]");
      const followBtn = modal.querySelector("[data-ai-followup-btn]");
      if (!followWrap || !followInput || !followBtn) return;

      followBtn.textContent = labelMap[modalId] || "Continue";

      function grow(el) {
        if (!el || el.tagName !== "TEXTAREA") return;
        el.style.overflow = "hidden";
        el.style.resize = "none";
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight || 0, 240) + "px";
      }

      followInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          followBtn.click();
        }
      });

      grow(followInput);
      followInput.addEventListener("input", () => grow(followInput));

      const showIfNeeded = () => {
        const text = (outEl.textContent || outEl.innerText || outEl.value || "").trim();
        const shouldShow = text.length > 0;
        const wasHidden = followWrap.style.display === "none" || !followWrap.style.display;
        followWrap.style.display = shouldShow ? "block" : "none";

        if (shouldShow && wasHidden) {
          setTimeout(() => {
            followInput.focus();
            const v = followInput.value || "";
            try {
              followInput.setSelectionRange(v.length, v.length);
            } catch {}
            grow(followInput);
          }, 0);
        }
      };

      const mo = new MutationObserver(showIfNeeded);
      mo.observe(outEl, { childList: true, subtree: true, characterData: true });

      followBtn.addEventListener("click", () => {
        const extra = (followInput.value || "").trim();
        if (!extra) return;

        const base = (mainInput.value || "").trim();
        mainInput.value = `${base}\n\nFOLLOW-UP / ANSWERS:\n${extra}\n`;
        followInput.value = "";
        grow(followInput);

        runBtn.click();
      });

      showIfNeeded();
    });
  }

// ==================================================
// FINAL INIT (LOT ROCKET LAUNCH BLOCK)
// ==================================================
wireSocialNav();
wireZipButton();
renderSocialStrip();
wireAiFollowups();

// ===============================
// TOOLS (RUN ONCE)
// ===============================
(function initToolsOnce() {
  if (window.__LR_TOOLS_INIT__) return;
  window.__LR_TOOLS_INIT__ = true;

  if (window.LR_TOOLS && typeof window.LR_TOOLS.closeAll === "function") {
    window.LR_TOOLS.closeAll();
  }

  wirePaymentCalculator();
  wireIncomeCalcDirect();
})();

// ===============================
// LOG OUT BUTTON
// ===============================
const logoutBtn = document.getElementById("lrLogoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await SB.auth.signOut();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    location.reload();
  });
}

// ===============================
// PREVENT EMAIL AUTOFILL INTO PRICE FIELD
// ===============================
(function preventEmailAutofillInPriceBox() {
  const priceEl = document.getElementById("priceOfferInput");
  if (!priceEl) return;

  const looksLikeEmail = (v) =>
    /@/.test(String(v || "")) && /\./.test(String(v || ""));

  // clear immediately if browser injected email
  if (looksLikeEmail(priceEl.value)) priceEl.value = "";

  // clear on focus
  priceEl.addEventListener("focus", () => {
    if (looksLikeEmail(priceEl.value)) priceEl.value = "";
  });

  // clear on any input
  priceEl.addEventListener("input", () => {
    if (looksLikeEmail(priceEl.value)) priceEl.value = "";
  });
})();

console.log("✅ APP READY");
})();


