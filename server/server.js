// /server/server.js  (REPLACE ENTIRE FILE)
// LOT ROCKET — FINAL / LAUNCH READY ✅ (BOOT-SAFE)
// Fixes: ✅ API routes BEFORE static + SPA fallback
// Fixes: ✅ /api/* never returns HTML (prevents "AI returned non-JSON")
// Adds: ✅ /api (root) JSON
// Adds: ✅ /api/boost ✅ /api/proxy ✅ /api/payment-helper
// Adds: ✅ /api/ai/ping + /api/ai/ask/social/objection/message/workflow/car
// Stripe fixes:
// ✅ Safe Stripe init (won’t crash if env missing)
// ✅ Webhook is safe even if Stripe not configured (returns clean error)
// ✅ Raw webhook body parsed BEFORE json()
// ✅ GET /api/stripe/checkout redirects to Stripe
// ✅ POST /api/stripe/checkout returns {ok,url}
// ✅ Logs Stripe mode (TEST/LIVE) + price id
// ✅ Uses absolute baseUrl that works behind Render proxy

"use strict";

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ===============================
   STRIPE (SAFE INIT)
================================ */
const https = require("https");
const Stripe = require("stripe");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      httpAgent: new https.Agent({
        keepAlive: true,
        maxSockets: 10,
        timeout: 60000,
      }),
      timeout: 60000,
    })
  : null;


function stripeModeLabel() {
  const k = process.env.STRIPE_SECRET_KEY || "";
  if (k.startsWith("sk_test")) return "TEST";
  if (k.startsWith("sk_live")) return "LIVE";
  return k ? "UNKNOWN" : "MISSING";
}

/* ===============================
   STRIPE WEBHOOK (RAW BODY REQUIRED)
   NOTE: Must be defined BEFORE express.json()
================================ */
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) {
    return res.status(500).send("Stripe not configured (missing STRIPE_SECRET_KEY)");
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing Stripe-Signature header");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("❌ Stripe webhook signature failed:", err?.message || err);
    return res.status(400).send("Webhook Error");
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session?.metadata?.userId || null;
      const customerId = session?.customer || null;
      const subscriptionId = session?.subscription || null;

      // TODO: Replace with DB update:
      // set isPaid true + store stripeCustomerId/subscriptionId
      console.log("✅ PAID ON:", { userId, customerId, subscriptionId });
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      // TODO: set isPaid false by stripeSubscriptionId
      console.log("🛑 PAID OFF:", { subscriptionId: sub?.id || null });
    }

    return res.json({ received: true });
  } catch (e) {
    console.error("❌ Webhook handler error:", e);
    return res.status(500).json({ ok: false });
  }
});

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
   FETCH HELPER (Node 20 safe)
================================ */
async function getFetch() {
  if (typeof fetch === "function") return fetch;
  const mod = await import("node-fetch");
  return mod.default;
}

/* ===============================
   HEALTH + API ROOT
================================ */
app.get("/api/health", (_req, res) => {
  return res.json({ ok: true, service: "lot-rocket-1", ts: Date.now() });
});
app.get("/api/stripe/ping", async (_req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "Missing STRIPE_SECRET_KEY" });
    const b = await stripe.balance.retrieve();
    return res.json({ ok: true, available: b.available?.[0]?.amount ?? null, currency: b.available?.[0]?.currency ?? null });
  } catch (err) {
    console.error("❌ STRIPE PING FAIL:", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      raw: err?.raw?.message,
    });
    return res.status(500).json({ ok: false, error: err?.message || "Stripe ping failed", type: err?.type || null, code: err?.code || null });
  }
});

app.get("/api", (_req, res) => res.json({ ok: true, note: "api root alive" }));

/* ===============================
   STRIPE CHECKOUT
   - MUST be above express.static + SPA fallback
================================ */

// Render is behind a proxy. This makes baseUrl correct.
app.set("trust proxy", 1);

function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").toString().split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.get("host") || "").toString().split(",")[0].trim();
  return `${proto}://${host}`;
}

// POST: returns JSON {ok,url}
app.post("/api/stripe/checkout", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "Missing STRIPE_SECRET_KEY" });

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) return res.status(500).json({ ok: false, error: "Missing STRIPE_PRICE_ID" });

    const baseUrl = getBaseUrl(req);

    console.log("💳 STRIPE checkout (POST):", { priceId, mode: stripeModeLabel(), baseUrl });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/pro-success`,
      cancel_url: `${baseUrl}/`,
      allow_promotion_codes: true,
    });

    return res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("❌ Stripe checkout (POST) error:", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      param: err?.param,
      statusCode: err?.statusCode,
      raw: err?.raw?.message,
    });

    return res.status(500).json({
      ok: false,
      error: err?.message || err?.raw?.message || "Stripe checkout failed",
      code: err?.code || err?.raw?.code || null,
      type: err?.type || null,
      param: err?.param || null,
    });
  }
});

// GET: redirects to Stripe (your frontend uses this)
app.get("/api/stripe/checkout", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "Missing STRIPE_SECRET_KEY" });

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) return res.status(500).json({ ok: false, error: "Missing STRIPE_PRICE_ID" });

    const baseUrl = getBaseUrl(req);

    console.log("💳 STRIPE checkout (GET):", { priceId, mode: stripeModeLabel(), baseUrl });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/pro-success`,
      cancel_url: `${baseUrl}/`,
      allow_promotion_codes: true,
    });

    return res.redirect(303, session.url);
  } catch (err) {
    console.error("❌ Stripe checkout (GET) error:", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      param: err?.param,
      statusCode: err?.statusCode,
      raw: err?.raw?.message,
    });

    return res.status(500).json({
      ok: false,
      error: err?.message || err?.raw?.message || "Stripe checkout failed",
      code: err?.code || err?.raw?.code || null,
      type: err?.type || null,
      param: err?.param || null,
    });
  }
});

// PRO SUCCESS: set LR_PRO=1 then back to app
app.get("/pro-success", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Lot Rocket Pro</title></head>
<body style="font-family:system-ui;background:#0b1020;color:#fff;padding:24px;">
  <h1>✅ Pro Activated</h1>
  <p>Sending you back…</p>
  <script>
    try { localStorage.setItem("LR_PRO","1"); } catch(e) {}
    window.location.href = "/";
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
   BOOST (SCRAPE) — ALWAYS JSON
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
    `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  try {
    const price = num(req.body.price);
    const down = num(req.body.down);
    const trade = num(req.body.trade);
    const payoff = num(req.body.payoff);
    const rate = num(req.body.rate);
    const term = Math.max(0, Math.round(num(req.body.term)));
    const tax = num(req.body.tax);
    const fees = num(req.body.fees);
    const rebate = num(req.body.rebate);

    if (!price || !term) {
      return res.status(400).json({ ok: false, message: "Enter at least Price and Term (months)." });
    }

    const tradeNet = trade - payoff;
    const taxable = Math.max(0, price - Math.max(0, tradeNet) - rebate) + fees;
    const taxAmt = taxable * (Math.max(0, tax) / 100);
    const amountFinanced = Math.max(0, taxable + taxAmt - down);

    const monthlyRate = Math.max(0, rate) / 100 / 12;

    let payment = 0;
    if (monthlyRate === 0) payment = amountFinanced / term;
    else payment = (amountFinanced * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term));

    const breakdownText = [
      `Estimated Payment: ${money(payment)} / mo`,
      "",
      `Amount Financed: ${money(amountFinanced)}`,
      `Price: ${money(price)}`,
      `Fees/Add-ons: ${money(fees)}`,
      `Rebate: -${money(rebate)}`,
      `Trade: ${money(trade)}  •  Payoff: ${money(payoff)}  •  Net: ${money(tradeNet)}`,
      `Down: ${money(down)}`,
      `Tax (${tax.toFixed(2)}%): ${money(taxAmt)}`,
      "",
      `APR: ${rate.toFixed(2)}%  •  Term: ${term} months`,
      "",
      "Note: Estimate only. Exact figures depend on lender, taxes, fees, rebates, and approval structure.",
    ].join("\n");

    return res.json({ ok: true, breakdownText });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message || String(e) });
  }
});

/* ===============================
   OPENAI HELPER
================================ */
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20000);

async function callOpenAI({ system, user, temperature = 0.6 }) {
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: "Missing OPENAI_API_KEY" };

  const f = await getFetch();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const r = await f("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature,
        messages: [
          { role: "system", content: String(system || "") },
          { role: "user", content: String(user || "") },
        ],
      }),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: j?.error?.message || `OpenAI HTTP ${r.status}` };

    const text = j?.choices?.[0]?.message?.content?.trim();
    return text ? { ok: true, text } : { ok: false, error: "Empty AI response" };
  } catch (e) {
    return { ok: false, error: e?.name === "AbortError" ? "OpenAI timeout" : (e?.message || String(e)) };
  } finally {
    clearTimeout(t);
  }
}

/* ===============================
   APP KB
================================ */
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
app.post("/api/ai/ask", async (req, res) => {
  const q = takeText(req.body.question, req.body.input, req.body.text);
  const ctx = req.body.context || {};
  if (!q) return jsonErr(res, "Missing question/input");

  const system = [
    "You are Lot Rocket Help.",
    "Answer ONLY about the Lot Rocket app: how it works and how to fix issues.",
    "Use the app manual as truth:",
    APP_KB,
    "",
    "Output: 3–7 bullets max. If code: file + exact snippet.",
  ].join("\n");

  const user = ["USER QUESTION:", q, "", "UI CONTEXT:", JSON.stringify(ctx, null, 2)].join("\n");
  const out = await callOpenAI({ system, user, temperature: 0.25 });
  return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
});

app.post("/api/ai/social", async (req, res) => {
  const vehicle = req.body.vehicle || {};
  const platform = normPlatform(req.body.platform || "facebook");
  const seed = String(req.body.seed || "").trim() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const locRaw = req.body.location || req.body.geo || req.body.userLocation || req.body.context?.location || "";
  const location =
    typeof locRaw === "string"
      ? locRaw.trim()
      : (locRaw && typeof locRaw === "object")
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
    closer: ["TONE PRESET: CLOSER", "- High intent. Strong urgency. Assume buyer is ready.", "- Short lines. Firm CTA. No soft language."].join("\n"),
    chill: ["TONE PRESET: CHILL", "- Friendly, conversational, car-guy energy.", "- No pressure. Still DM-driven."].join("\n"),
    viral: ["TONE PRESET: VIRAL", "- Scroll-stopping hooks. Bold questions. High energy.", "- Emojis used as anchors (within platform limits)."].join("\n"),
    luxe: ["TONE PRESET: LUXE", "- Clean, premium, confident.", "- Fewer emojis. Focus on experience and quality."].join("\n"),
    marketplace: ["TONE PRESET: MARKETPLACE", "- Price early. Bullet facts. Zero fluff.", "- Minimal emojis. Direct availability."].join("\n"),
  };

  const toneBlock = TONE_PRESETS[toneRaw] ? `\n${TONE_PRESETS[toneRaw]}\n` : "";

  const system = [
    "YOU ARE LOT ROCKET — VIRAL CAR SALES COPY ENGINE.",
    "",
    "MISSION:",
    "Generate a scroll-stopping, DM-generating post for ONE individual salesperson.",
    "It must feel human, fast, and native to the platform — not a dealership ad.",
    "",
    toneBlock || "",
    "VOICE (NON-NEGOTIABLE):",
    "- First-person singular (I/me). Confident. Direct. No corporate fluff.",
    "- NEVER say: 'Ready to elevate your drive', 'Check out', 'Stop by', 'Come on in', 'Visit our website', 'Call the dealership'.",
    "- No dealership language. No links. No disclaimers. No paragraphs.",
    "",
    "CORE CONVERSION STRUCTURE (ALWAYS):",
    "1) HOOK (1–2 lines): pattern interrupt (price shock, bold question, 'be honest…', scarcity).",
    "2) PROOF (3–6 bullets): only the BEST features + 1 trust signal if available (Clean Carfax / One owner / Certified / No accidents).",
    "3) URGENCY (1 line): scarcity/timeframe without begging.",
    `4) CTA (1 line): DM me "${keyword}" to claim it / get details / lock it down.`,
    "",
    "EMOJI RULES (FIRE, NOT SPAM):",
    "- Use emojis as visual bullets/anchors, not decoration.",
    "- Facebook/IG: 5–10 total emojis max. TikTok: up to 12. LinkedIn: 0–3. X: 0–2. Marketplace: 0–4.",
    "- Allowed vibe emojis: 🚨🔥✅💰🚗🧊🛞📲👀⚡️💎 (use tastefully).",
    "",
    "HASHTAG RULES (TREND-ALIGNED + GEO):",
    "- Include hashtags ONLY when platform supports it:",
    "  * facebook/instagram/tiktok: YES (12–18 tags)",
    "  * marketplace: light (4–8 tags)",
    "  * x: 0–3 tags",
    "  * linkedin: 0–6 tags (professional)",
    "- Use the STAIRCASE METHOD:",
    "  * 3–5 broad high-volume (ex: #CarForSale #SUV #Chevy)",
    "  * 5–8 niche (model/trim/features/used/certified)",
    "  * 3–6 GEO tags based on user location (city/metro/state/area codes if provided)",
    "- If location is missing, use: 2–3 generic geo tags (ex: #Michigan #DetroitArea #MetroDetroit) ONLY if the vehicle context hints it.",
    "",
    "PLATFORM FORMAT:",
    `- PLATFORM = ${platform}`,
    "- facebook: 6–12 short lines + bullets + hashtags at bottom.",
    "- instagram: tighter, punchier, vibe, hashtags at bottom.",
    "- tiktok: hooky, edgy, 5–9 lines, end with DM keyword or comment keyword, hashtags at bottom.",
    "- linkedin: credibility-first, minimal emojis, still DM CTA, limited hashtags.",
    "- x: ultra short, max ~280 chars, minimal hashtags.",
    "- marketplace: factual + fast, price early, bullets, direct CTA, light hashtags.",
    "",
    "PAYMENT RULE:",
    "- DO NOT mention monthly payments unless payment info is explicitly provided in input.",
    "",
    "OUTPUT RULE:",
    "- Return ONLY the final post text. No labels. No analysis. No markdown.",
    "",
    `LOCATION (use for GEO hashtags + local phrasing): ${location || "(not provided)"}`,
    `AUDIENCE/DEMOGRAPHICS (if present, adapt tone & tags): ${audienceText || "(none)"}`,
    `SEED (do not print): ${seed}`,
  ].join("\n");

  const user = JSON.stringify(vehicle, null, 2);
  const out = await callOpenAI({ system, user, temperature: 0.95 });

  return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
});

app.post("/api/ai/objection", async (req, res) => {
  const objection = takeText(req.body.objection, req.body.input, req.body.text);
  const followup = takeText(req.body.followup);
  const history = Array.isArray(req.body.history) ? req.body.history : [];

  const stitchedHistory = history.length
    ? "\nHISTORY:\n" +
      history
        .slice(-10)
        .map((m) => `${m.role || "user"}: ${String(m.content || "").trim()}`)
        .join("\n")
    : "";

  const user = [
    "CUSTOMER OBJECTION:",
    objection || "(missing)",
    "",
    "CUSTOMER FOLLOW-UP (if any):",
    followup || "(none)",
    stitchedHistory,
  ].join("\n");

  if (!takeText(user)) return jsonErr(res, "Missing objection/input");

  const system = [
    "You are LOT ROCKET’S OBJECTION COACH — a high-level automotive closer.",
    "Today only. No delays. No think-about-it. No fluff.",
    "Short, spoken, controlled. Leader energy.",
    "BANS: 'I understand', 'that makes sense', 'investing', feature lists, long paragraphs.",
    "",
    "METHOD (mandatory):",
    "1) One-line agree with the PERSON (not the objection).",
    "2) Isolate with ONE question.",
    "3) Reframe with simple money logic (monthly to daily when useful).",
    "4) Close TODAY with two options (A/B).",
    "",
    "OUTPUT FORMAT (exact):",
    "CLOSER:",
    "<4–9 short lines>",
    "",
    "WHY IT WORKS:",
    "- <bullet>",
    "- <bullet>",
    "- <bullet>",
    "",
    "No emojis. No markdown.",
  ].join("\n");

  const out = await callOpenAI({ system, user, temperature: 0.45 });
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
    "Default: appointment-first. No price/payments unless explicitly asked.",
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
   STRIPE STATUS (DEBUG) — CHEAP PING
   MUST BE ABOVE API 404
================================ */
app.get("/api/stripe/status", async (_req, res) => {
  console.log("⚡ /api/stripe/status HIT");

  const hasKey = !!process.env.STRIPE_SECRET_KEY;
  const keyPrefix = hasKey ? String(process.env.STRIPE_SECRET_KEY).slice(0, 7) : "";
  const hasPrice = !!process.env.STRIPE_PRICE_ID;

  if (!stripe) {
    console.log("❌ STRIPE: NO INSTANCE");
    return res.status(200).json({
      ok: false,
      bucket: "NO_STRIPE_INSTANCE",
      hasKey,
      keyPrefix,
      hasPrice,
    });
  }

  try {
    // ✅ cheapest auth/connectivity call
    const acct = await stripe.accounts.retrieve();

    console.log("✅ STRIPE OK:", acct?.id || "(no id)");
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
    console.error("❌ STRIPE STATUS FAIL:", {
      type: err?.type || null,
      code: err?.code || null,
      message: err?.message || String(err),
    });

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
// ✅ Verify Stripe session after redirect back from Stripe
app.get("/api/stripe/verify", async (req, res) => {
  try {
    const sid = String(req.query.session_id || "").trim();
    if (!sid) return res.status(400).json({ ok: false, error: "missing session_id" });

    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(sid);

    const paid =
      session &&
      (session.payment_status === "paid" || session.status === "complete");

    return res.json({
      ok: true,
      pro: !!paid,
      payment_status: session.payment_status,
      status: session.status,
    });
  } catch (e) {
    console.error("stripe verify error:", e);
    return res.status(500).json({ ok: false, error: e.message || "verify failed" });
  }
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
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "../public/index.html"))
);

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
