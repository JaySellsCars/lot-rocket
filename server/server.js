// /server/server.js  (REPLACE ENTIRE FILE)
// LOT ROCKET — FINAL / LAUNCH READY ✅ (BOOT-SAFE / DEDUPED)
// ✅ API routes BEFORE static + SPA fallback
// ✅ /api/* never returns HTML (prevents "AI returned non-JSON")
// ✅ Webhook uses express.raw() BEFORE express.json()
// ✅ One Stripe instance (no duplicates) + /api/netcheck probe
// ✅ Boost/Proxy/Payment Helper stable + ALWAYS JSON where appropriate
// ✅ AI routes wired to OpenAI Chat Completions (boot-safe)

"use strict";

const express = require("express");
const path = require("path");
const https = require("https");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// Render is behind a proxy
app.set("trust proxy", 1);

/* ===============================
   STRIPE (SINGLE SAFE INIT)
================================ */
let __stripe = null;

function getStripe() {
  if (__stripe) return __stripe;

  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key || !key.startsWith("sk_")) return null;

  const Stripe = require("stripe");
  __stripe = new Stripe(key, {
    apiVersion: "2024-06-20",
    timeout: 60000,
    maxNetworkRetries: 2,
  });

  return __stripe;
}

function stripeModeLabel() {
  const k = String(process.env.STRIPE_SECRET_KEY || "");
  if (k.startsWith("sk_test")) return "TEST";
  if (k.startsWith("sk_live")) return "LIVE";
  return k ? "UNKNOWN" : "MISSING";
}

function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https")
    .toString()
    .split(",")[0]
    .trim();
  const host = (req.headers["x-forwarded-host"] || req.get("host") || "")
    .toString()
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

/* ===============================
   SUPABASE ADMIN (SERVER)
================================ */
function getSupabaseAdmin() {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const raw = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !raw) return null;

  // Optional log (safe-ish): role only
  try {
    const payload = JSON.parse(Buffer.from(raw.split(".")[1], "base64").toString("utf8"));
    console.log("🔐 SUPABASE KEY ROLE:", payload?.role || "(unknown)");
  } catch {
    console.log("🔐 SUPABASE KEY ROLE:", "(unknown)");
  }

  return createClient(url, raw, { auth: { persistSession: false } });
}

async function upsertProfilePro({
  userId,
  isPro,
  customerId,
  subscriptionId,
  subscriptionStatus = null,
}) {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Missing SUPABASE admin env");

  // ✅ Guard: only write profiles if the auth user exists
  const { data: authUser, error: authErr } = await sb.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user?.id) {
    console.warn("⚠️ upsertProfilePro skipped (no auth user):", {
      userId,
      message: authErr?.message || "missing auth user",
    });
    return;
  }

  const payload = {
    id: userId,
    is_pro: !!isPro,
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    subscription_status: subscriptionStatus,
    updated_at: new Date().toISOString(),
  };

  // ✅ only stamp this when turning pro ON
  if (isPro) payload.pro_activated_at = new Date().toISOString();

  const { error } = await sb.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw new Error("Supabase upsert failed: " + error.message);
}

/* ===============================
   STRIPE WEBHOOK (RAW BODY REQUIRED)
   NOTE: Must be defined BEFORE express.json()
================================ */
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.status(500).send("Stripe not configured");

    const sig = req.headers["stripe-signature"];
    if (!sig) return res.status(400).send("Missing Stripe-Signature header");

    const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    if (!secret) return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("❌ Stripe webhook signature failed:", err?.message || err);
      return res.status(400).send("Webhook Error");
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;

          const userId = String(
            session?.metadata?.userId || session?.client_reference_id || ""
          ).trim();

          const customerId =
            typeof session?.customer === "string"
              ? session.customer
              : session?.customer?.id || null;

          const subscriptionId =
            typeof session?.subscription === "string"
              ? session.subscription
              : session?.subscription?.id || null;

          console.log("✅ PAID ON:", {
            id: session?.id || null,
            userId,
            customerId,
            subscriptionId,
            email: session?.customer_details?.email || null,
          });

          if (userId) {
            await upsertProfilePro({
              userId,
              isPro: true,
              customerId,
              subscriptionId,
              subscriptionStatus: "active",
            });
          }
          break;
        }
case "customer.subscription.created": {
  const sub = event.data.object;

  const customerId =
    typeof sub.customer === "string"
      ? sub.customer
      : sub.customer?.id || null;

  console.log("🆕 SUBSCRIPTION CREATED:", {
    subscriptionId: sub.id,
    customerId,
    status: sub.status,
  });

  if (customerId) {
    const sb = getSupabaseAdmin();
    if (!sb) throw new Error("Missing SUPABASE admin env");

    const { data, error } = await sb
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (error) throw new Error("Supabase lookup failed: " + error.message);

    if (data?.id) {
      await upsertProfilePro({
        userId: data.id,
        isPro: true,
        customerId,
        subscriptionId: sub.id,
        subscriptionStatus: sub.status || "active",
      });
    } else {
      console.warn("⚠️ subscription.created but no profile matched customer:", customerId);
    }
  }

  break;
}

        case "customer.subscription.updated": {
          const sub = event.data.object;

          const customerId =
            typeof sub?.customer === "string"
              ? sub.customer
              : sub?.customer?.id || null;

          const status = String(sub?.status || "");
          const active = status === "active" || status === "trialing";

          console.log("🔁 SUBSCRIPTION UPDATED:", {
            subscriptionId: sub?.id || null,
            customerId,
            status,
            active,
          });

          if (customerId) {
            const sb = getSupabaseAdmin();
            if (!sb) throw new Error("Missing SUPABASE admin env");

            const { data, error } = await sb
              .from("profiles")
              .select("id")
              .eq("stripe_customer_id", customerId)
              .maybeSingle();

            if (error) throw new Error("Supabase lookup failed: " + error.message);

            if (data?.id) {
              await upsertProfilePro({
                userId: data.id,
                isPro: active,
                customerId,
                subscriptionId: sub?.id || null,
                subscriptionStatus: sub?.status || null,
              });
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object;

          const customerId =
            typeof sub?.customer === "string"
              ? sub.customer
              : sub?.customer?.id || null;

          console.log("🛑 PAID OFF:", {
            subscriptionId: sub?.id || null,
            customerId,
            status: sub?.status || null,
          });

          if (customerId) {
            const sb = getSupabaseAdmin();
            if (!sb) throw new Error("Missing SUPABASE admin env");

            const { data, error } = await sb
              .from("profiles")
              .select("id")
              .eq("stripe_customer_id", customerId)
              .maybeSingle();

            if (error) throw new Error("Supabase lookup failed: " + error.message);

            if (data?.id) {
              await upsertProfilePro({
                userId: data.id,
                isPro: false,
                customerId,
                subscriptionId: null,
                subscriptionStatus: "canceled",
              });
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const inv = event.data.object;
          console.log("⚠️ invoice.payment_failed:", {
            invoiceId: inv?.id || null,
            customerId: inv?.customer || null,
            subscriptionId: inv?.subscription || null,
          });
          break;
        }

        default:
          break;
      }

      return res.json({ received: true });
    } catch (e) {
      console.error("❌ Webhook handler error:", e?.message || e);
      return res.status(500).json({ ok: false, error: e?.message || "webhook failed" });
    }
  }
);

/* ===============================
   BODY PARSING
================================ */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* ===============================
   OPTIONAL DEP: CHEERIO
================================ */
let cheerio = null;
try {
  // eslint-disable-next-line global-require
  cheerio = require("cheerio");
} catch {
  cheerio = null;
}

/* ===============================
   SMALL UTILS
================================ */
const s = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const takeText = (...vals) =>
  vals
    .map(s)
    .map((t) => t.trim())
    .find(Boolean) || "";

function safeUrl(u) {
  try {
    return new URL(String(u)).toString();
  } catch {
    return "";
  }
}

function absUrl(base, maybe) {
  try {
    if (!maybe) return "";
    const v = String(maybe).trim();
    if (!v) return "";
    if (v.startsWith("data:")) return "";
    if (v.startsWith("//")) return "https:" + v;
    return new URL(v, base).toString();
  } catch {
    return "";
  }
}

const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

function jsonOk(res, payload) {
  return res.status(200).json(payload);
}
function jsonErr(res, error, extra = {}) {
  return res.status(200).json({ ok: false, error, ...extra });
}

/* ===============================
   API: CONFIG (frontend-safe)
================================ */
app.get("/api/config", (req, res) => {
  res.json({
    ok: true,
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  });
});

/* ===============================
   PLATFORM NORMALIZER
================================ */
const normPlatform = (p) =>
  ({
    fb: "facebook",
    facebook: "facebook",
    ig: "instagram",
    instagram: "instagram",
    tt: "tiktok",
    tiktok: "tiktok",
    li: "linkedin",
    linkedin: "linkedin",
    twitter: "x",
    x: "x",
    dm: "dm",
    sms: "dm",
    text: "dm",
    marketplace: "marketplace",
    hashtags: "hashtags",
    all: "all",
  }[String(p || "").toLowerCase()] || "facebook");

/* ===============================
   AI HIT LOGGER (debug)
================================ */
app.use((req, _res, next) => {
  if (req.path.startsWith("/api/ai")) {
    console.log("✅ AI HIT:", req.method, req.path, "keys:", Object.keys(req.body || {}));
  }
  next();
});

/* ===============================
   FETCH HELPER (Node 20+ safe, NO node-fetch)
================================ */
async function getFetch() {
  if (typeof fetch === "function") return fetch;
  throw new Error("Global fetch missing. Set Render runtime to Node 20+.");
}

/* ===============================
   HEALTH + API ROOT
================================ */
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "lot-rocket-1", ts: Date.now() }));
app.get("/api", (_req, res) => res.json({ ok: true, note: "api root alive" }));

/* ===============================
   NETCHECK (RENDER -> STRIPE PROBE)
================================ */
app.get("/api/netcheck", async (_req, res) => {
  try {
    const req2 = https.request(
      {
        method: "GET",
        host: "api.stripe.com",
        path: "/",
        timeout: 8000,
        headers: { "User-Agent": "lot-rocket-netcheck" },
      },
      (r) => {
        res.json({
          ok: true,
          status: r.statusCode,
          server: r.headers?.server || null,
          date: r.headers?.date || null,
        });
      }
    );

    req2.on("timeout", () => req2.destroy(new Error("timeout")));
    req2.on("error", (e) => res.status(500).json({ ok: false, error: e.message }));
    req2.end();
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===============================
   STRIPE STATUS + PING
================================ */
app.get("/api/stripe/status", async (_req, res) => {
  console.log("⚡ /api/stripe/status HIT");

  const hasKey = !!String(process.env.STRIPE_SECRET_KEY || "").trim();
  const keyPrefix = hasKey ? String(process.env.STRIPE_SECRET_KEY).slice(0, 7) : "";
  const hasPrice = !!String(process.env.STRIPE_PRICE_ID || "").trim();

  const stripe = getStripe();
  if (!stripe) {
    return res.status(200).json({
      ok: false,
      bucket: "NO_STRIPE_INSTANCE",
      hasKey,
      keyPrefix,
      hasPrice,
    });
  }

  try {
    const acct = await stripe.accounts.retrieve();
    return res.status(200).json({
      ok: true,
      bucket: "STRIPE_OK_PING",
      hasKey,
      keyPrefix,
      hasPrice,
      accountId: acct?.id || null,
      country: acct?.country || null,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      bucket: "STRIPE_CALL_FAILED",
      hasKey,
      keyPrefix,
      hasPrice,
      type: err?.type || null,
      code: err?.code || null,
      message: err?.message || String(err),
    });
  }
});

// lightweight ping
app.get("/api/stripe/ping", async (_req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ ok: false, error: "Missing STRIPE_SECRET_KEY" });

    const prices = await stripe.prices.list({ limit: 1 });
    return res.json({
      ok: true,
      reachable: true,
      priceCount: Array.isArray(prices?.data) ? prices.data.length : 0,
      ts: Date.now(),
    });
  } catch (err) {
    console.error("❌ STRIPE PING FAIL:", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
      raw: err?.raw?.message,
    });

    return res.status(500).json({
      ok: false,
      error: err?.message || err?.raw?.message || "Stripe ping failed",
      type: err?.type || null,
      code: err?.code || err?.raw?.code || null,
    });
  }
});

/* ===============================
   STRIPE CHECKOUT
================================ */
async function createCheckoutSession(req) {
  const stripe = getStripe();
  if (!stripe) {
    const e = new Error("Missing STRIPE_SECRET_KEY");
    e.status = 500;
    throw e;
  }

  const priceId = String(process.env.STRIPE_PRICE_ID || "").trim();
  if (!priceId) {
    const e = new Error("Missing STRIPE_PRICE_ID");
    e.status = 500;
    throw e;
  }

  // 🔐 REQUIRE USER
  const userId = String(req.body?.userId || req.query?.userId || "").trim();
  if (!userId) {
    const e = new Error("Missing userId");
    e.status = 400;
    throw e;
  }

  const baseUrl = getBaseUrl(req);
  console.log("💳 STRIPE checkout:", { priceId, mode: stripeModeLabel(), baseUrl, userId });

const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${baseUrl}/?canceled=1`,
  allow_promotion_codes: true,

  client_reference_id: userId,
  metadata: { userId },
});


  // 🔎 HARD PROOF LOG
  const acct = await stripe.accounts.retrieve();
  console.log("✅ CHECKOUT SESSION CREATED:", {
    id: session?.id,
    url: session?.url,
    account: acct?.id || null,
  });

  return session;
}

// POST: returns JSON {ok,url}
app.post("/api/stripe/checkout", async (req, res) => {
  try {
    const session = await createCheckoutSession(req);
    return res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("❌ Stripe checkout (POST) error:", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      param: err?.param,
      statusCode: err?.statusCode || err?.status,
      raw: err?.raw?.message,
    });

    return res.status(err?.statusCode || err?.status || 500).json({
      ok: false,
      error: err?.message || err?.raw?.message || "Stripe checkout failed",
      code: err?.code || err?.raw?.code || null,
      type: err?.type || null,
      param: err?.param || null,
    });
  }
});

// GET: redirects
app.get("/api/stripe/checkout", async (req, res) => {
  try {
    const session = await createCheckoutSession(req);
    return res.redirect(303, session.url);
  } catch (err) {
    console.error("❌ Stripe checkout (GET) error:", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      param: err?.param,
      statusCode: err?.statusCode || err?.status,
      raw: err?.raw?.message,
    });

    return res.status(err?.statusCode || err?.status || 500).json({
      ok: false,
      error: err?.message || err?.raw?.message || "Stripe checkout failed",
      code: err?.code || err?.raw?.code || null,
      type: err?.type || null,
      param: err?.param || null,
    });
  }
});

/* ===============================
   STRIPE VERIFY (SINGLE ROUTE)
   GET /api/stripe/verify?session_id=...
   ✅ Verifies Stripe checkout session
   ✅ If paid, server-side fallback writes profiles.is_pro=true
================================ */
app.get("/api/stripe/verify", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ ok: false, error: "Stripe not configured" });

    const session_id = String(req.query.session_id || "").trim();
    if (!session_id) return res.status(400).json({ ok: false, error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription", "customer"],
    });

    const paid =
      !!session && (session.payment_status === "paid" || session.status === "complete");

    // ✅ FALLBACK: if paid, ensure Supabase profile is marked pro
    if (paid) {
      const userId = String(
        session?.metadata?.userId || session?.client_reference_id || ""
      ).trim();

      const customerId =
        typeof session?.customer === "string"
          ? session.customer
          : session?.customer?.id || null;

      const subscriptionId =
        typeof session?.subscription === "string"
          ? session.subscription
          : session?.subscription?.id || null;

      const subscriptionStatus =
        typeof session?.subscription === "object" && session?.subscription
          ? session.subscription.status || null
          : null;

      if (userId) {
        await upsertProfilePro({
          userId,
          isPro: true,
          customerId,
          subscriptionId,
          subscriptionStatus: subscriptionStatus || "active",
        });
      }
    }

    return res.json({
      ok: true,
      pro: !!paid,
      payment_status: session?.payment_status || null,
      status: session?.status || null,
      mode: session?.mode || null,
      customer_email: session?.customer_details?.email || null,
      // optional debug fields (safe)
      customer_id:
        typeof session?.customer === "string"
          ? session.customer
          : session?.customer?.id || null,
      subscription_id:
        typeof session?.subscription === "string"
          ? session.subscription
          : session?.subscription?.id || null,
    });
  } catch (e) {
    console.error("stripe verify error:", {
      type: e?.type || null,
      code: e?.code || null,
      message: e?.message || String(e),
    });
    return res.status(500).json({ ok: false, error: e?.message || "verify failed" });
  }
});

/* ===============================
   STRIPE CUSTOMER PORTAL (MANAGE BILLING)
   POST /api/stripe/portal
   ✅ Server derives user from Supabase JWT (NO userId in body)
   ✅ Reads profiles.stripe_customer_id (server-side)
   ✅ Returns {ok:true,url}
================================ */
app.post("/api/stripe/portal", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ ok: false, error: "Stripe not configured" });

    const sb = getSupabaseAdmin();
    if (!sb) return res.status(500).json({ ok: false, error: "Missing SUPABASE admin env" });

    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing Authorization Bearer token" });

    // Server-side user from JWT
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const userId = userData.user.id;

    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("stripe_customer_id,is_pro")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) return res.status(500).json({ ok: false, error: profErr.message });
    if (!prof) return res.status(404).json({ ok: false, error: "Profile not found" });

    // Paid app safety: only PRO users can open portal
    if (!prof.is_pro) return res.status(403).json({ ok: false, error: "Not pro" });

    const customerId = String(prof.stripe_customer_id || "").trim();
    if (!customerId) return res.status(400).json({ ok: false, error: "No stripe_customer_id on profile" });

    const baseUrl = getBaseUrl(req);
    const returnUrl = String(process.env.STRIPE_PORTAL_RETURN_URL || `${baseUrl}/`).trim();

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return res.json({ ok: true, url: portal.url });
  } catch (e) {
    console.error("❌ stripe portal error:", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "portal failed" });
  }
});

/* ===============================
   PRO SUCCESS (NO localStorage pro flag)
================================ */
app.get("/pro-success", (req, res) => {
  const sid = String(req.query.session_id || "").trim();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Lot Rocket</title></head>
<body style="font-family:system-ui;background:#0b1020;color:#fff;padding:24px;">
  <h1>✅ Payment Complete</h1>
  <p>Sending you back…</p>
  <script>
    const sid = ${JSON.stringify(sid)};
    const u = sid ? "/?session_id=" + encodeURIComponent(sid) : "/";
    window.location.href = u;
  </script>
</body>
</html>`);
});

/* ===============================
   AI PING (GET + POST)
================================ */
app.get("/api/ai/ping", (req, res) => res.json({ ok: true, got: req.query || null, ts: Date.now() }));
app.post("/api/ai/ping", (req, res) => res.json({ ok: true, got: req.body || null, ts: Date.now() }));

/* ==================================================
   BOOST (SCRAPE) - ALWAYS JSON
   GET /api/boost?url=...&debug=1
================================================== */
app.get("/api/boost", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const url = safeUrl(req.query.url || "");
  const debug = String(req.query.debug || "") === "1";

  if (!url) return res.status(400).json({ ok: false, error: "Missing or invalid url" });

  if (!cheerio) {
    return res.status(200).json({
      ok: false,
      error: "cheerio not installed. Run: npm i cheerio",
      url,
      vehicle: { url, title: "", description: "", price: "", mileage: "", vin: "", stock: "" },
      images: [],
    });
  }

  try {
    const f = await getFetch();

    const r = await f(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const html = await r.text();
    const ct = (r.headers.get("content-type") || "").toLowerCase();

    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return res.status(200).json({
        ok: false,
        error: `Dealer returned non-HTML (${ct || "unknown"})`,
        url,
        status: r.status,
        vehicle: { url, title: "", description: "", price: "", mileage: "", vin: "", stock: "" },
        images: [],
      });
    }

    const $ = cheerio.load(html);

    const title =
      takeText(
        $("meta[property='og:title']").attr("content"),
        $("meta[name='twitter:title']").attr("content"),
        $("title").text(),
        $("h1").first().text()
      ) || "";

    const description =
      takeText(
        $("meta[property='og:description']").attr("content"),
        $("meta[name='description']").attr("content"),
        $("meta[name='twitter:description']").attr("content")
      ) || "";

    function pick(obj, keys) {
      for (const k of keys) {
        const v = obj && obj[k];
        if (v !== undefined && v !== null && String(v).trim() !== "") return v;
      }
      return "";
    }

    function parseJsonLdVehicles() {
      const out = { price: "", mileage: "", vin: "", stock: "" };

      const scripts = [];
      $("script[type='application/ld+json']").each((_, el) => {
        const t = ($(el).text() || "").trim();
        if (t) scripts.push(t);
      });

      for (const raw of scripts) {
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          continue;
        }

        const items = Array.isArray(data) ? data : [data];
        for (const it of items) {
          const node = it && it["@graph"] ? it["@graph"] : [it];
          for (const x of node) {
            const type = x && x["@type"] ? String(x["@type"]).toLowerCase() : "";
            if (!type.includes("vehicle") && !type.includes("product")) continue;

            const offers = x.offers || {};
            const offer0 = Array.isArray(offers) ? offers[0] : offers;

            const rawPrice = String(pick(offer0, ["price", "lowPrice", "highPrice"]) || "");
            if (!out.price && rawPrice) out.price = rawPrice.replace(/[^\d.]/g, "");

            const odo = x.mileageFromOdometer || x.mileage || x.odo || {};
            if (!out.mileage) {
              if (typeof odo === "number") out.mileage = String(odo);
              else if (odo && typeof odo === "object") out.mileage = String(pick(odo, ["value"]) || "");
            }

            out.vin = out.vin || String(pick(x, ["vehicleIdentificationNumber", "vin"]) || "");
            out.stock = out.stock || String(pick(x, ["sku", "stockNumber", "stock"]) || "");
          }
        }
      }

      out.price = out.price ? `$${Number(out.price).toLocaleString()}` : "";
      out.mileage = out.mileage ? `${Number(out.mileage).toLocaleString()} mi` : "";
      return out;
    }

    const ld = parseJsonLdVehicles();

    let images = [];
    const ogImg = absUrl(url, $("meta[property='og:image']").attr("content"));
    if (ogImg) images.push(ogImg);

    $("img").each((_, el) => {
      const src =
        $(el).attr("data-src") ||
        $(el).attr("data-lazy") ||
        $(el).attr("data-original") ||
        $(el).attr("src") ||
        "";
      const abs = absUrl(url, src);
      if (!abs) return;

      const lower = abs.toLowerCase();
      if (lower.endsWith(".svg")) return;
      if (lower.includes("logo")) return;
      if (lower.includes("sprite")) return;

      images.push(abs);
    });

    images = uniq(images).slice(0, 60);

    const textBlob = $("body").text().replace(/\s+/g, " ").trim();
    const find = (re) => (textBlob.match(re) ? textBlob.match(re)[0] : "");

    const rxPrice = find(/\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?/);
    const rxVin = find(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    const rxMileage = find(/\b\d{1,3}(?:,\d{3})+\s?(?:miles|mi)\b/i);
    const rxStock = find(/\bStock\s*#?\s*[:\-]?\s*[A-Za-z0-9\-]+\b/i);

    const vehicle = {
      url,
      title,
      description,
      price: ld.price || rxPrice || "",
      mileage: ld.mileage || rxMileage || "",
      vin: ld.vin || rxVin || "",
      stock: ld.stock || (rxStock ? rxStock.replace(/^Stock\s*#?\s*[:\-]?\s*/i, "") : ""),
    };

    return res.status(200).json({
      ok: true,
      vehicle,
      images,
      ...(debug ? { debug: { status: r.status, contentType: ct, imageCount: images.length } } : {}),
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: e?.message || String(e),
      url,
      vehicle: { url, title: "", description: "", price: "", mileage: "", vin: "", stock: "" },
      images: [],
    });
  }
});

/* ==================================================
   PROXY (for ZIP downloads)
   GET /api/proxy?url=...
================================================== */
app.get("/api/proxy", async (req, res) => {
  const url = safeUrl(req.query.url);
  if (!url) return res.status(400).send("Missing url");

  try {
    const f = await getFetch();
    const r = await f(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!r.ok) return res.status(502).send("Proxy fetch failed");

    const ct = r.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "no-store");

    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(200).send(buf);
  } catch (_e) {
    return res.status(500).send("Proxy error");
  }
});

/* ==================================================
   PAYMENT HELPER
   POST /api/payment-helper
================================================== */
app.post("/api/payment-helper", (req, res) => {
  const num = (v) => {
    const n = Number(String(v ?? "").replace(/[$,%\s,]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const money = (n) =>
    `$${Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  try {
    const price = num(req.body.price);
    const down = num(req.body.down);
    const trade = num(req.body.trade);
    const payoff = num(req.body.payoff);
    const rate = num(req.body.rate); // APR %
    const term = Math.max(0, Math.round(num(req.body.term))); // months
    const tax = num(req.body.tax); // %
    const fees = num(req.body.fees);
    const rebate = num(req.body.rebate);

    const equity = trade - payoff;
    const taxable = Math.max(0, price - rebate);
    const taxAmt = (taxable * tax) / 100;

    const amountFinanced = Math.max(0, price + taxAmt + fees - down - equity - rebate);

    const monthlyRate = rate > 0 ? rate / 100 / 12 : 0;
    let payment = 0;

    if (term <= 0) payment = 0;
    else if (monthlyRate === 0) payment = amountFinanced / term;
    else {
      const pow = Math.pow(1 + monthlyRate, term);
      payment = amountFinanced * ((monthlyRate * pow) / (pow - 1));
    }

    return res.status(200).json({
      ok: true,
      input: { price, down, trade, payoff, rate, term, tax, fees, rebate },
      calc: { equity, taxable, taxAmt, amountFinanced, payment },
      pretty: {
        equity: money(equity),
        taxAmt: money(taxAmt),
        amountFinanced: money(amountFinanced),
        payment: money(payment),
      },
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e?.message || String(e) });
  }
});

/* ===============================
   OPENAI HELPER (FETCH-BASED)
================================ */
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20000);

async function callOpenAI({ system, user, temperature = 0.6, max_tokens = 900 }) {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) return { ok: false, error: "Missing OPENAI_API_KEY" };

  const f = await getFetch();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const r = await f("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature,
        max_tokens,
        messages: [
          { role: "system", content: String(system || "") },
          { role: "user", content: String(user || "") },
        ],
      }),
    });

    const raw = await r.text().catch(() => "");
    let j = null;
    try {
      j = raw ? JSON.parse(raw) : null;
    } catch {
      j = null;
    }

    if (!r.ok) {
      return {
        ok: false,
        error: j?.error?.message || `OpenAI HTTP ${r.status}`,
      };
    }

    const text = j?.choices?.[0]?.message?.content?.trim();
    return text ? { ok: true, text } : { ok: false, error: "Empty AI response" };
  } catch (e) {
    return {
      ok: false,
      error: e?.name === "AbortError" ? "OpenAI timeout" : (e?.message || String(e)),
    };
  } finally {
    clearTimeout(t);
  }
}




const APP_KB = [
  "LOT ROCKET — APP MANUAL",
  "",
  "STEP 1 — Dealer URL Scraper",
  "- Paste dealer vehicle URL",
  "- Click Boost This Listing",
  "- Server scrapes title/description + image URLs",
  "",
  "STEP 2 — Social Media Kit",
  "- Platform textareas + New Post / Copy / Remove Emojis",
  "",
  "STEP 3 — Creative Lab",
  "- Holding Zone (up to 24) + Social Ready strip + ZIP via /api/proxy",
  "",
  "TOOLS:",
  "- Objection Coach, Message Builder, Campaign Builder, Ask A.I., Car Expert",
].join("\n");

/* ===============================
   AI ROUTES
================================ */

// ----------------------------
// SYSTEM PROMPTS
// ----------------------------
const HELP_SYSTEM = [
  "You are Lot Rocket Help.",
  "Answer ONLY about the Lot Rocket app: how it works and how to fix issues.",
  "Use the app manual as truth:",
  APP_KB,
  "",
  "Output: 3–7 bullets max. If code: file + exact snippet.",
].join("\n");

const PROMPT_CREATOR_SYSTEM = [
  "ROLE: LOT ROCKET PROMPT CREATOR",
  "You create copy/paste prompts the user can reuse anywhere (ChatGPT, Claude, etc.).",
  "",
  "RULES:",
  "- Be practical and fast. No lectures.",
  "- If the request is missing details: ask ONLY 3 tight questions max, then ALSO provide a best-guess prompt anyway.",
  "- Prompts must be plug-and-play with clear placeholders like {VEHICLE}, {PRICE}, {LOCATION}, {CTA}.",
  "- Prompts must be written for car sales pros and real-world selling.",
  "",
  "OUTPUT FORMAT (always):",
  "1) QUICK PROMPT (short, punchy, paste-ready)",
  "2) POWER PROMPT (detailed, best results, paste-ready)",
  "3) FIELDS TO FILL (bullets of the placeholders used)",
  "4) EXAMPLE (same prompt filled with realistic example values)",
  "",
  "DEFAULT STYLE (unless user says otherwise):",
  "- Human, confident, energetic. Short lines. Strong CTA to book appointment/test drive TODAY.",
  "- Include emojis + trending hashtags when writing social prompts.",
  "- If user requests a specific persona (ex: Andy Elliott vibe), bake it into the prompt cleanly.",
].join("\n");

const OBJECTION_COACH_SYSTEM = `
You are Lot Rocket's Objection Coach: a high-conviction, modern car-sales closer.
Your vibe: confident, direct, upbeat, slightly intense, but never rude or robotic.
You sound like a real top producer: short sentences, contractions, natural talk.
Goal: move the customer forward TODAY (appointment, deposit, credit app, test drive).

Rules:
- Never lecture. No generic "I understand" paragraphs.
- Ask 1-2 sharp questions to regain control.
- Use simple language. No buzzwords. No corporate tone.
- No manipulation. No lying. No pressure tactics. No guilt.
- If info is missing, ask for it in a tight way.
- If there’s a money objection, isolate it before solving it.
- Always end with a CLOSE question.

When responding:
1) One-liner acknowledge + take control (1 sentence).
2) 2-4 sentences that reframe + solve the objection using the context (vehicle/price/trade/terms if provided).
3) A "Close Today" question (appointment/deposit/credit app/test drive).
4) Optional: a short "Text Message Version" (1-2 lines).

Output must be plain text, no headings, no bullets unless they help clarity.
`.trim();

// ----------------------------
// ASK: AI PROMPT GENERATOR (PROMPT-ONLY)
// ----------------------------
app.post("/api/ai/ask", async (req, res) => {
  try {
    const question = String(req.body?.question || req.body?.text || req.body?.input || "").trim();
    if (!question) return res.json({ ok: false, error: "Missing question" });

    const ctx = req.body?.context || {};
    const system = [
      "You are Lot Rocket's A.I Prompt Generator.",
      "You generate a copy/paste-ready HIGH QUALITY prompt the user can use in ChatGPT/Claude/etc.",
      "",
      "RULES:",
      "- Do NOT refuse normal requests.",
      "- Do NOT redirect to Lot Rocket troubleshooting.",
      "- Output ONLY the finished prompt (no preamble, no commentary).",
      "- Make it specific, structured, and reusable.",
      "",
      "PROMPT FORMAT (use this):",
      "TITLE:",
      "ROLE:",
      "GOAL:",
      "CONTEXT:",
      "INPUTS (what user must provide):",
      "CONSTRAINTS:",
      "OUTPUT FORMAT:",
      "EXAMPLES (optional if helpful):",
      "",
      "If the user is vague, make reasonable assumptions and produce the best prompt anyway.",
    ].join("\n");

    const user = [
      "USER REQUEST:",
      question,
      "",
      "OPTIONAL CONTEXT (may be empty):",
      JSON.stringify(ctx, null, 2),
    ].join("\n");

    const out = await callOpenAI({ system, user, temperature: 0.7, max_tokens: 900 });
    return res.json(out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return res.json({ ok: false, error: e?.message || String(e) });
  }
});


// ----------------------------
// HELP: LOT ROCKET APP HELP / TROUBLESHOOTING ONLY
// ----------------------------
app.post("/api/ai/help", async (req, res) => {
  try {
    const question = String(req.body?.question || req.body?.text || req.body?.input || "").trim();
    if (!question) return res.json({ ok: false, error: "Missing question" });

    const system = [
      "You are Lot Rocket's in-app Help & Troubleshooting assistant.",
      "Only answer questions about using Lot Rocket, its features, or diagnosing issues inside the app.",
      "",
      "RULES:",
      "- Be concise and practical.",
      "- If the question is unrelated to Lot Rocket, redirect back to Lot Rocket usage.",
    ].join("\n");

    const out = await callOpenAI({ system, user: question, temperature: 0.3, max_tokens: 700 });
    return res.json(out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return res.json({ ok: false, error: e?.message || String(e) });
  }
});




app.post("/api/ai/social", async (req, res) => {
  const vehicle = req.body.vehicle || {};
  const platform = normPlatform(req.body.platform || "facebook");
  const seed = String(req.body.seed || "").trim() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const locRaw = req.body.location || req.body.geo || req.body.userLocation || req.body.context?.location || "";
  const location =
    typeof locRaw === "string"
      ? locRaw.trim()
      : locRaw && typeof locRaw === "object"
      ? takeText(locRaw.city, locRaw.state, locRaw.metro, locRaw.zip, locRaw.region)
      : "";

  const audience = req.body.audience || req.body.context?.audience || {};
  const audienceText = typeof audience === "string" ? audience.trim() : JSON.stringify(audience || {}, null, 2);

  const rawTitle = takeText(
    vehicle.model,
    vehicle.title,
    vehicle.trim,
    vehicle.year && vehicle.make && vehicle.model ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : ""
  );

  const keyword =
    (rawTitle || "INFO")
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(" ") || "INFO";

  const toneRaw = String(req.body.tone || req.body.style || req.body.voice || "viral").trim().toLowerCase();

  const TONE_PRESETS = {
    closer: ["TONE PRESET: CLOSER", "- High intent. Strong urgency.", "- Short lines. Firm CTA."].join("\n"),
    chill: ["TONE PRESET: CHILL", "- Friendly, conversational.", "- No pressure. Still DM-driven."].join("\n"),
    viral: ["TONE PRESET: VIRAL", "- Scroll-stopping hooks.", "- Emojis used as anchors."].join("\n"),
    luxe: ["TONE PRESET: LUXE", "- Clean, premium.", "- Fewer emojis."].join("\n"),
    marketplace: ["TONE PRESET: MARKETPLACE", "- Price early. Bullet facts.", "- Minimal emojis."].join("\n"),
  };

  const toneBlock = TONE_PRESETS[toneRaw] ? `\n${TONE_PRESETS[toneRaw]}\n` : "";

  const system = [
    "YOU ARE LOT ROCKET — VIRAL CAR SALES COPY ENGINE.",
    "Generate a scroll-stopping, DM-generating post for ONE individual salesperson.",
    "",
    toneBlock || "",
    "VOICE (NON-NEGOTIABLE):",
    "- First-person singular (I/me). Confident. Direct.",
    "- No dealership language. No links. No disclaimers. No paragraphs.",
    "",
    "STRUCTURE:",
    "1) HOOK (1–2 lines)",
    "2) PROOF (3–6 bullets)",
    "3) URGENCY (1 line)",
    `4) CTA: DM me "${keyword}"`,
    "",
    "OUTPUT: Return ONLY the final post text.",
    `PLATFORM = ${platform}`,
    `LOCATION = ${location || "(not provided)"}`,
    `AUDIENCE = ${audienceText || "(none)"}`,
    `SEED (do not print) = ${seed}`,
  ].join("\n");

  const user = JSON.stringify(vehicle, null, 2);
  const out = await callOpenAI({ system, user, temperature: 0.95 });
  return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
});

app.post("/api/ai/objection", async (req, res) => {
  const objection = takeText(req.body.objection, req.body.input, req.body.text);
  const followup = takeText(req.body.followup);
  const history = Array.isArray(req.body.history) ? req.body.history : [];

  if (!objection) return jsonErr(res, "Missing objection/input");

  const stitchedHistory = history.length
    ? "\nHISTORY:\n" +
      history
        .slice(-10)
        .map((m) => `${m.role || "user"}: ${String(m.content || "").trim()}`)
        .join("\n")
    : "";

  const user = [
    "CUSTOMER OBJECTION:",
    objection,
    "",
    "CUSTOMER FOLLOW-UP (if any):",
    followup || "(none)",
    stitchedHistory,
  ].join("\n");

  const out = await callOpenAI({
    system: OBJECTION_COACH_SYSTEM,
    user,
    temperature: 0.55,
  });

  return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
});

app.post("/api/ai/message", async (req, res) => {
  const input = takeText(req.body.input, req.body.text);
  const channel = takeText(req.body.channel);
  const goal = takeText(req.body.goal);
  const ctx = req.body.context || {};

  if (!input && !goal) return jsonErr(res, "Missing input/text");

  const system = [
    "You are Lot Rocket — AI Message Builder.",
    "Write concise, human, momentum-driven messages for car sales.",
    "No dealership voice. No filler. No placeholders.",
    "If email: output Subject: and Body:. Otherwise output only the message.",
  ].join("\n");

  const user = [
    `CHANNEL: ${channel || "(none)"}`,
    `GOAL: ${goal || "(none)"}`,
    "",
    "INPUT:",
    input || "",
    "",
    "CONTEXT:",
    JSON.stringify(ctx, null, 2),
  ].join("\n");

  const out = await callOpenAI({ system, user, temperature: 0.4 });
  return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
});

app.post("/api/ai/workflow", async (req, res) => {
  const scenario = takeText(req.body.scenario, req.body.objective, req.body.input, req.body.text);
  if (!scenario) return jsonErr(res, "Missing scenario/objective");

  const system = [
    "You are Lot Rocket’s Campaign Builder.",
    "Return ONLY the campaign messages, one per line. No labels.",
  ].join("\n");

  const out = await callOpenAI({ system, user: scenario, temperature: 0.65 });
  return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
});

app.post("/api/ai/car", async (req, res) => {
  const vehicle = takeText(req.body.vehicle);
  const question = takeText(req.body.question, req.body.input, req.body.text);
  if (!question) return jsonErr(res, "Missing question/input");

  const system = [
    "You are the Nameless Vehicle Oracle.",
    "Be specific. Compare trims/years/packages. No guessing.",
    "Return ONLY the answer.",
  ].join("\n");

  const user = ["VEHICLE CONTEXT:", vehicle || "(none)", "", "QUESTION:", question].join("\n");
  const out = await callOpenAI({ system, user, temperature: 0.35 });
  return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
});


/* ===============================
   API 404 JSON (MUST BE LAST API HANDLER)
================================ */
app.use("/api", (req, res) => {
  return res.status(404).json({
    ok: false,
    error: "Unknown API route",
    path: req.path,
  });
});

/* ===============================
   STATIC FRONTEND (AFTER API ROUTES)
================================ */
app.use(express.static(path.join(__dirname, "../public")));

/* ===============================
   SPA FALLBACK (LAST)
================================ */
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));

/* ===============================
   START
================================ */
app.listen(PORT, () => {
  console.log("🚀 LOT ROCKET LIVE ON PORT", PORT);
  console.log("STRIPE MODE:", stripeModeLabel());
  console.log("STRIPE KEY PRESENT?", Boolean(process.env.STRIPE_SECRET_KEY));
  console.log("STRIPE PRICE ID:", process.env.STRIPE_PRICE_ID || "(missing)");
  console.log("OPENAI KEY PRESENT?", Boolean(process.env.OPENAI_API_KEY));
  console.log("OPENAI MODEL:", OPENAI_MODEL);
  console.log("OPENAI TIMEOUT MS:", OPENAI_TIMEOUT_MS);
});
