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
// SUPABASE AUTH (PATH A STEP 1)
// ==================================================
let SB = null;               // supabase client
let LR_USER = null;          // current user object
let LR_SESSION = null;       // current session

function qs(id){ return DOC.getElementById(id); }

function show(el){ if(el) el.classList.remove("hidden"); }
function hide(el){ if(el) el.classList.add("hidden"); }

function setAuthMsg(msg){
  const box = qs("lrAuthMsg");
  if (box) box.textContent = msg || "";
}

function openAuth(){
  const m = qs("lrAuth");
  if (!m) return;
  m.classList.remove("hidden");
  m.setAttribute("aria-hidden", "false");
}
function closeAuth(){
  const m = qs("lrAuth");
  if (!m) return;
  m.classList.add("hidden");
  m.setAttribute("aria-hidden", "true");
}

function renderUserChip(){
  const chip = qs("lrUserChip");
  const btnOut = qs("lrSignOut");
  if (!chip) return;

  // Always show chip once SB is ready
  show(chip);

  if (LR_USER && LR_USER.email) {
    chip.textContent = `👤 ${LR_USER.email}`;
    if (btnOut) show(btnOut);
  } else {
    chip.textContent = "👤 Sign in";
    if (btnOut) hide(btnOut);
  }
}


// Expose userId for later (Stripe bind happens Step 2)
function publishUser() {
  const userId = LR_USER?.id || "";
  window.LR_USER_ID = userId;
  window.dispatchEvent(
    new CustomEvent("lr:user", { detail: { userId, user: LR_USER || null } })
  );
}

// ✅ Ensures profiles row exists for the signed-in user (RLS must allow "insert own")
async function ensureProfileRow(user) {
  try {
    if (!SB || !user?.id) return;

    const payload = {
      id: user.id,
      is_pro: false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await SB
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.warn("⚠️ ensureProfileRow failed:", error.message);
      return;
    }
  } catch (e) {
    console.warn("⚠️ ensureProfileRow exception:", e?.message || e);
  }
}

async function initSupabaseAuth() {
  // Fetch safe config from server
  let cfg = null;
  try {
    const r = await fetch("/api/config", { cache: "no-store" });
    cfg = await r.json();
  } catch (e) {
    console.error("❌ /api/config failed", e);
  }

  const supabaseUrl = cfg?.supabaseUrl || "";
  const supabaseAnonKey = cfg?.supabaseAnonKey || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ Supabase config missing. Check Render env SUPABASE_URL + SUPABASE_ANON_KEY");
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error("❌ Supabase JS not loaded. Ensure CDN script is above app.js");
    return;
  }

  SB = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  // Initial session
  const { data: s0 } = await SB.auth.getSession();
  LR_SESSION = s0?.session || null;
  LR_USER = LR_SESSION?.user || null;

  // ✅ Create/ensure profile row as soon as we have a user
  if (LR_USER?.id) await ensureProfileRow(LR_USER);

  renderUserChip();
  publishUser();

  // Listen for auth changes
  SB.auth.onAuthStateChange(async (_event, session) => {
    LR_SESSION = session || null;
    LR_USER = session?.user || null;

    // ✅ Create/ensure profile row on every sign-in
    if (LR_USER?.id) await ensureProfileRow(LR_USER);

    renderUserChip();
    publishUser();
  });

  wireAuthUI();
  console.log("✅ Supabase Auth READY", { userId: LR_USER?.id || null });
}



function wireAuthUI(){
  const chip = qs("lrUserChip");
  const closeBtn = qs("lrAuthClose");

  if (chip) chip.onclick = () => openAuth();
  if (closeBtn) closeBtn.onclick = () => closeAuth();

  const btnLink = qs("lrSendLink");
  const btnIn = qs("lrSignIn");
  const btnUp = qs("lrSignUp");
  const btnOut = qs("lrSignOut");

  const emailEl = qs("lrEmail");
  const passEl = qs("lrPass");

  const getEmail = () => (emailEl?.value || "").trim();
  const getPass = () => (passEl?.value || "").trim();

  if (btnLink) btnLink.onclick = async () => {
    if (!SB) return;
    setAuthMsg("");
    const email = getEmail();
    if (!email) return setAuthMsg("Enter your email first.");

    try {
      const { error } = await SB.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) return setAuthMsg("❌ " + error.message);
      setAuthMsg("✅ Magic link sent. Check your email.");
    } catch (e) {
      setAuthMsg("❌ Magic link error.");
      console.error(e);
    }
  };

  if (btnIn) btnIn.onclick = async () => {
    if (!SB) return;
    setAuthMsg("");
    const email = getEmail();
    const password = getPass();
    if (!email || !password) return setAuthMsg("Email + password required for Sign In.");

    try {
      const { error } = await SB.auth.signInWithPassword({ email, password });
      if (error) return setAuthMsg("❌ " + error.message);
      setAuthMsg("✅ Signed in.");
      closeAuth();
    } catch (e) {
      setAuthMsg("❌ Sign in error.");
      console.error(e);
    }
  };

  if (btnUp) btnUp.onclick = async () => {
    if (!SB) return;
    setAuthMsg("");
    const email = getEmail();
    const password = getPass();
    if (!email || !password) return setAuthMsg("Email + password required for Create Account.");

    try {
      const { error } = await SB.auth.signUp({ email, password });
      if (error) return setAuthMsg("❌ " + error.message);
      setAuthMsg("✅ Account created. If email confirmation is on, check your inbox.");
    } catch (e) {
      setAuthMsg("❌ Sign up error.");
      console.error(e);
    }
  };

  if (btnOut) btnOut.onclick = async () => {
    if (!SB) return;
    setAuthMsg("");
    try {
      const { error } = await SB.auth.signOut();
      if (error) return setAuthMsg("❌ " + error.message);
      setAuthMsg("✅ Signed out.");
      closeAuth();
    } catch (e) {
      setAuthMsg("❌ Sign out error.");
      console.error(e);
    }
  };
}
await initSupabaseAuth();

if (!window.LR_USER_ID) {
  openAuth();

  window.addEventListener("lr:user", (e) => {
    if (e.detail?.userId) location.reload();
  }, { once: true });

  return;
}


// ==================================================
// PAID-APP BOOT GATE (WHOLE APP = PRO)
// - If Stripe returned with session_id, verify and unlock
// - If already Pro, silently re-verify using last known session_id
// ==================================================
async function stripeReturnCheckAndUnlock() {
  const params = new URLSearchParams(window.location.search);
  const sessionIdFromUrl = params.get("session_id");

  const getLS = (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  };
  const setLS = (k, v) => {
    try { localStorage.setItem(k, v); } catch {}
  };
  const delLS = (k) => {
    try { localStorage.removeItem(k); } catch {}
  };

  const hasProFlag = isProActive();
  const cachedSid = getLS("LR_SID");
  const sidToVerify = sessionIdFromUrl || (hasProFlag ? cachedSid : null);

  // 1) No session id anywhere -> nothing to verify
  if (!sidToVerify) return false;

  // 2) Verify with server
  let j = null;
  try {
    const r = await fetch(`/api/stripe/verify?session_id=${encodeURIComponent(sidToVerify)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    j = await r.json().catch(() => ({}));

    // VERIFIED PRO ✅
    if (r.ok && j?.ok && j?.pro) {
      setLS("LR_PRO", "1");
      setLS("lr_pro", "1");
      setLS("LR_SID", sidToVerify);
      setLS("LR_PRO_TS", String(Date.now()));
      console.log("✅ PRO VERIFIED");

      // If we came back from Stripe with session_id in URL, clean it once (no reload needed)
      if (sessionIdFromUrl) {
        history.replaceState({}, "", "/");
      }
      return true;
    }

    // VERIFIED NOT PRO ❌ (or canceled / unpaid)
    if (r.ok && j?.ok && !j?.pro) {
      console.warn("🔒 PRO VERIFY: NOT PRO (clearing flags)");
      delLS("LR_PRO");
      delLS("lr_pro");
      delLS("LR_SID");
      delLS("LR_PRO_TS");

      if (sessionIdFromUrl) history.replaceState({}, "", "/");
      return false;
    }

    // If server returned something unexpected, don't blow up boot; just log.
    console.warn("⚠️ PRO VERIFY: unexpected response", j);
    if (sessionIdFromUrl) history.replaceState({}, "", "/");
    return false;
  } catch (e) {
    // Network hiccup: do NOT hard-lock paid users.
    console.warn("⚠️ PRO VERIFY: network error (keeping current state)", e?.message || e);
    if (sessionIdFromUrl) history.replaceState({}, "", "/");
    return hasProFlag; // keep pro if already pro
  }
}

function isProActive() {
  try {
    const v = localStorage.getItem("LR_PRO") || localStorage.getItem("lr_pro");
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

function showPaywallAndLockPage() {
  const appRoot =
    document.getElementById("app") ||
    document.getElementById("appRoot") ||
    document.querySelector("main") ||
    document.body;

  if (appRoot) appRoot.classList.add("lr-locked");

  const pw = document.getElementById("lrPaywall");
  if (pw) {
    pw.classList.remove("hidden");
    pw.style.display = "flex";
    pw.setAttribute("aria-hidden", "false");
  } else {
    console.warn("lrPaywall missing in HTML");
    alert("Paywall missing in HTML (#lrPaywall).");
  }
}


  // ---- RUN THE GATE ----
  await stripeReturnCheckAndUnlock();

  if (!isProActive()) {
    // Keep the app usable, but lock PRO features via LR_PRO_LOCK + paywall
    showPaywallAndLockPage();
    console.log("🔒 APP LOCKED (not pro) — continuing boot (pro features gated)");
  } else {
    console.log("🔓 APP UNLOCKED (pro) — continuing boot");
  }


// ==================================================
// STRIPE SUCCESS HANDLER (sets LR_PRO after checkout)
// ==================================================
(async function LR_STRIPE_SUCCESS() {
  try {
    const u = new URL(window.location.href);
    const sid = u.searchParams.get("session_id");
    const paid = u.searchParams.get("paid");

    if (paid === "1") {
      localStorage.setItem("LR_PRO", "1");
      u.searchParams.delete("paid");
      window.history.replaceState({}, "", u.toString());
      console.log("✅ PRO ACTIVATED (paid=1)");
      return;
    }

    if (!sid) return;

    const r = await fetch(`/api/stripe/verify?session_id=${encodeURIComponent(sid)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok && j?.pro) {
      localStorage.setItem("LR_PRO", "1");
      u.searchParams.delete("session_id");
      window.history.replaceState({}, "", u.toString());
      console.log("✅ PRO ACTIVATED (verified)");
    }
  } catch (e) {
    console.warn("Stripe success handler error:", e);
  }
})();

  // ==================================================
  // LOT ROCKET — PRO LOCK + PAYWALL (v2 CLEAN)
  // - Blocks any element with data-pro="1"
  // - Shows #lrPaywall
  // - Upgrade buttons POST /api/stripe/checkout (expects {ok,url}) OR fallback GET redirect
  // - Pro flag uses localStorage "LR_PRO" (also supports legacy "lr_pro")
  // ==================================================
  (function LR_PRO_LOCK() {
    if (window.__LR_PRO_LOCK__) return;
    window.__LR_PRO_LOCK__ = true;

    const byId = (id) => DOC.getElementById(id);

    const paywall = byId("lrPaywall");
    const closeBtn = byId("lrClosePaywall");
    const upgradeNowBtn = byId("lrUpgradeNow");
    const upgradeBtn = byId("upgradeBtn");

    const CHECKOUT_ENDPOINT = "/api/stripe/checkout";
    const STORAGE_KEY = "LR_PRO";

    function isProActiveLocal() {
      try {
        const v = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("lr_pro");
        return v === "1" || v === "true";
      } catch {
        return false;
      }
    }

    function lockAppRoot() {
      const appRoot =
        document.getElementById("app") ||
        document.getElementById("appRoot") ||
        document.querySelector("main") ||
        document.body;

      if (appRoot) appRoot.classList.add("lr-locked");
      DOC.documentElement.classList.add("lr-locked");
      DOC.body.classList.add("lr-locked");
    }

    function openPaywall() {
      if (!paywall) return console.warn("lrPaywall missing in HTML");

      if (!isProActiveLocal()) lockAppRoot();

      paywall.classList.remove("hidden");
      paywall.style.display = "flex";
      paywall.setAttribute("aria-hidden", "false");
    }

    function closePaywall() {
      if (!paywall) return;

      paywall.classList.add("hidden");
      paywall.style.display = "none";
      paywall.setAttribute("aria-hidden", "true");

      // NEVER unlock the app here
      if (!isProActiveLocal()) lockAppRoot();
    }

    async function goCheckout() {
      try {
        const userId = String(window.LR_USER_ID || "").trim();
        if (!userId) {
          openAuth();
          return;
        }

        // Try POST first (JSON response)
        const r = await fetch(CHECKOUT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            returnUrl: window.location.origin,
            userId,
          }),
        });

        if (r.ok) {
          const data = await r.json().catch(() => ({}));
          const url = data.url || data.checkoutUrl;
          if (url) {
            window.location.href = url;
            return;
          }
        }

        // Fallback: GET route (server redirects to Stripe)
        window.location.href = CHECKOUT_ENDPOINT;
      } catch (e) {
        console.error("❌ Checkout error:", e);
        window.location.href = CHECKOUT_ENDPOINT;
      }
    }

    // Close button
    if (closeBtn && !closeBtn.__LR_BOUND__) {
      closeBtn.__LR_BOUND__ = true;
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closePaywall();
      });
    }

    // Upgrade buttons
    [upgradeNowBtn, upgradeBtn].forEach((btn) => {
      if (!btn || btn.__LR_BOUND__) return;
      btn.__LR_BOUND__ = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        closePaywall();
        goCheckout();
      });
    });

    // Gate clicks for data-pro="1"
    DOC.addEventListener(
      "click",
      (e) => {
        // never block clicks inside paywall
        if (e.target?.closest?.("#lrPaywall")) return;

        const el = e.target?.closest?.("[data-pro]");
        if (!el) return;

        const needsPro = el.getAttribute("data-pro") === "1";
        if (!needsPro) return;

        if (!isProActiveLocal()) {
          e.preventDefault();
          e.stopPropagation();
          openPaywall();
        }
      },
      true
    );

    DOC.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePaywall();
    });

    window.LR_PRO = {
      isProActive: isProActiveLocal,
      openPaywall,
      closePaywall,
      goCheckout,
    };
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
  // FINAL INIT
  // ==================================================
  wireSocialNav();
  wireZipButton();
  renderSocialStrip();
  wireAiFollowups();

  (function initToolsOnce() {
    if (window.__LR_TOOLS_INIT__) return;
    window.__LR_TOOLS_INIT__ = true;

    if (window.LR_TOOLS && typeof window.LR_TOOLS.closeAll === "function") window.LR_TOOLS.closeAll();

    wirePaymentCalculator();
    wireIncomeCalcDirect();
  })();

  console.log("✅ APP READY");
})();
