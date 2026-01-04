// /server/server.js  (REPLACE ENTIRE FILE)
// LOT ROCKET — FINAL / LAUNCH READY ✅ (CLEANED)
// Fixes:
// ✅ API order correct (API before static + SPA fallback)
// ✅ /api/* never returns HTML (prevents "AI returned non-JSON")
// ✅ /api and /api/ return JSON (prevents "Unknown API route /")
// ✅ No duplicate routes / no duplicate static middleware
// ✅ /api/boost: HTML scrape + JSON-LD vehicle details (best-effort) + always JSON
// ✅ /api/proxy (ZIP images) ✅ /api/payment-helper
// ✅ AI routes: /api/ai/ping + /api/ai/* tools (consistent JSON + timeout)

"use strict";

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ===============================
   BODY PARSING
================================ */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* ===============================
   AI HIT LOGGER (debug)
================================ */
app.use((req, _res, next) => {
  if (req.path.startsWith("/api/ai")) {
    console.log(
      "✅ AI HIT:",
      req.method,
      req.path,
      "body keys:",
      Object.keys(req.body || {})
    );
  }
  next();
});

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
   FETCH HELPER (Render/Node safe)
================================ */
async function getFetch() {
  if (typeof fetch === "function") return fetch;
  const mod = await import("node-fetch");
  return mod.default;
}

/* ===============================
   OPTIONAL: CHEERIO (single load)
================================ */
let cheerio = null;
try {
  // eslint-disable-next-line global-require
  cheerio = require("cheerio");
} catch {
  cheerio = null;
}

/* ===============================
   HEALTH + API ROOT (prevents Unknown API route /)
================================ */
app.get("/api/health", (_req, res) => {
  return res.json({ ok: true, service: "lot-rocket-1", ts: Date.now() });
});

app.get("/api", (_req, res) => res.json({ ok: true, note: "api root alive" }));
app.get("/api/", (_req, res) => res.json({ ok: true, note: "api root alive" }));

/* ===============================
   AI PING (support GET + POST)
================================ */
app.get("/api/ai/ping", (req, res) => {
  return res.json({ ok: true, got: req.query || null, ts: Date.now() });
});
app.post("/api/ai/ping", (req, res) => {
  return res.json({ ok: true, got: req.body || null, ts: Date.now() });
});

/* ==================================================
   BOOST (SCRAPE) — MUST RETURN JSON ALWAYS ✅
   GET /api/boost?url=...&debug=1
================================================== */
app.get("/api/boost", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const raw = req.query.url;
  const url = safeUrl(raw);
  const debug = String(req.query.debug || "") === "1";

  if (!url) {
    return res.status(400).json({ ok: false, error: "Missing or invalid url" });
  }

  if (!cheerio) {
    return res.status(200).json({
      ok: false,
      error: "cheerio not installed. Run: npm i cheerio",
      url,
    });
  }

  try {
    const f = await getFetch();

    const r = await f(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const html = await r.text();
    const ct = (r.headers.get("content-type") || "").toLowerCase();

    // If dealer blocks or returns non-html, still return JSON (and do NOT crash UI)
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return res.status(200).json({
        ok: false,
        error: `Dealer returned non-HTML (${ct || "unknown"})`,
        url,
        status: r.status,
        images: [],
        vehicle: { url, title: "", description: "", price: "", mileage: "", vin: "", stock: "" },
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

    // -------- JSON-LD vehicle details (best-effort) --------
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

      for (const rawJson of scripts) {
        let data;
        try {
          data = JSON.parse(rawJson);
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

      // normalize
      out.price = out.price ? `$${Number(out.price).toLocaleString()}` : "";
      out.mileage = out.mileage ? `${Number(out.mileage).toLocaleString()} mi` : "";

      return out;
    }

    const ld = parseJsonLdVehicles();

    // -------- Images --------
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

    // -------- Fallback regex scan (if JSON-LD missing) --------
    const textBlob = $("body").text().replace(/\s+/g, " ").trim();
    const find = (re) => {
      const m = textBlob.match(re);
      return m ? m[0] : "";
    };

    const rxPrice = find(/\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?/);
    const rxVin = find(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    const rxMileage = find(/\b\d{1,3}(?:,\d{3})+\s?(?:miles|mi)\b/i);
    const rxStock = find(/\bStock\s*#?\s*[:\-]?\s*[A-Za-z0-9\-]+\b/i);

    const vehicle = {
      url,
      title: title || "",
      description: description || "",
      price: ld.price || rxPrice || "",
      mileage: ld.mileage || rxMileage || "",
      vin: ld.vin || rxVin || "",
      stock:
        ld.stock ||
        (rxStock ? rxStock.replace(/^Stock\s*#?\s*[:\-]?\s*/i, "") : ""),
    };

    return res.status(200).json({
      ok: true,
      vehicle,
      images,
      ...(debug
        ? { debug: { status: r.status, contentType: ct, imageCount: images.length } }
        : {}),
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: e?.message || String(e),
      url,
      images: [],
      vehicle: { url, title: "", description: "", price: "", mileage: "", vin: "", stock: "" },
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
    res.status(200).send(buf);
  } catch (_e) {
    res.status(500).send("Proxy error");
  }
});

/* ==================================================
   PAYMENT HELPER (server calc)
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
    const rate = num(req.body.rate);
    const term = Math.max(0, Math.round(num(req.body.term)));
    const tax = num(req.body.tax);
    const fees = num(req.body.fees);
    const rebate = num(req.body.rebate);

    if (!price || !term) {
      return res.status(400).json({
        ok: false,
        message: "Enter at least Price and Term (months).",
      });
    }

    const tradeNet = trade - payoff;
    const taxable = Math.max(0, price - Math.max(0, tradeNet) - rebate) + fees;
    const taxAmt = taxable * (Math.max(0, tax) / 100);
    const amountFinanced = Math.max(0, taxable + taxAmt - down);

    const monthlyRate = Math.max(0, rate) / 100 / 12;

    let payment = 0;
    if (monthlyRate === 0) {
      payment = amountFinanced / term;
    } else {
      const p = amountFinanced;
      const n = term;
      const r = monthlyRate;
      payment = (p * r) / (1 - Math.pow(1 + r, -n));
    }

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
   OPENAI HELPER (timeout + consistent JSON)
================================ */
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20000);

async function callOpenAI({ system, user, temperature = 0.6 }) {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "Missing OPENAI_API_KEY" };
  }

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

    if (!r.ok) {
      const msg = j?.error?.message || `OpenAI HTTP ${r.status}`;
      return { ok: false, error: msg };
    }

    const text = j?.choices?.[0]?.message?.content?.trim();
    return text ? { ok: true, text } : { ok: false, error: "Empty AI response" };
  } catch (e) {
    const isAbort = e?.name === "AbortError";
    return { ok: false, error: isAbort ? "OpenAI timeout" : (e?.message || String(e)) };
  } finally {
    clearTimeout(t);
  }
}

/* ===============================
   LOT ROCKET HELP KB (v1)
================================ */
const APP_KB = `
LOT ROCKET — APP MANUAL

CORE IDEA:
Lot Rocket is for INDIVIDUAL car salespeople (not dealerships).
Goal: generate posts, messages, campaigns + creative assets fast.

MAIN FLOW:
STEP 1 — Dealer URL Scraper
- Paste dealer vehicle URL
- Click "Boost This Listing"
- Server scrapes title/description and extracts up to 60 image URLs (UI uses up to 24)
- Photos appear in Step 1 grid for selection
- "Send Selected Photos to Creative Lab" pushes selected photos to Step 3 holding zone

STEP 2 — Social Media Kit
- Platform textareas: Facebook, IG, TikTok, LinkedIn, X, DM, Marketplace, Hashtags
- Buttons per platform: New Post, Copy, Remove Emojis
- Output speaks as ONE salesperson, no dealership talk, no website links

STEP 3 — Creative Lab
- Holding Zone: up to 24 thumbnails, wraps (no scroll)
- Double-click a holding photo sends it to Social Ready Strip
- Social Ready Strip:
  - Large preview image
  - Left/right arrows to cycle
  - Thumbs with lock badge 🔒 for locked images
  - Download ZIP downloads Social Ready images via /api/proxy

TOOLS (Right Rail):
- Objection Coach
- Calculator
- Payment Calculator: server estimate via /api/payment-helper
- Income Calculator
- AI Campaign Builder
- AI Message Builder
- Ask A.I. / Help
- AI Car Expert
`.trim();

/* ===============================
   AI: HELP / ASK ✅
   POST /api/ai/ask
================================ */
app.post("/api/ai/ask", async (req, res) => {
  try {
    const q = takeText(req.body.question, req.body.input, req.body.text);
    const ctx = req.body.context || {};
    if (!q) return jsonErr(res, "Missing question/input");

    const system = `
You are Lot Rocket Help.

You answer ONLY about the Lot Rocket app: how it works, how to use it, and how to fix common issues.

USE THIS APP MANUAL AS SOURCE OF TRUTH:
${APP_KB}

OUTPUT:
- Short, actionable answer
- If steps: 3–7 bullets max
`.trim();

    const user = `
USER QUESTION:
${q}

UI CONTEXT:
${JSON.stringify(ctx, null, 2)}
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.25 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   AI: SOCIAL POSTS ✅
   POST /api/ai/social
================================ */
app.post("/api/ai/social", async (req, res) => {
  try {
    const vehicle = req.body.vehicle || {};
    const platform = normPlatform(req.body.platform || "facebook");

    const seed =
      String(req.body.seed || "").trim() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const label = String(vehicle.title || vehicle.label || "").trim();
    const price = String(vehicle.price || "").trim();
    const miles = String(vehicle.mileage || "").trim();
    const ext = String(vehicle.exterior || "").trim();
    const vin = String(vehicle.vin || "").trim();

    const system = `
YOU ARE LOT ROCKET.

You are an elite automotive social media salesperson.
You write posts that generate DMs.

NON-NEGOTIABLE:
• Speak as ONE salesperson (no dealership language)
• NO website links
• Primary goal is messages/appointments

ANTI-STALE:
Use variation seed to change hook + angle each time.
Return ONLY the final ${platform} post.
`.trim();

    const user = `
PLATFORM: ${platform}
SEED: ${seed}

LABEL: ${label || "—"}
PRICE: ${price || "—"}
MILES: ${miles || "—"}
COLOR: ${ext || "—"}
VIN(last6): ${vin ? vin.slice(-6) : "—"}

VEHICLE:
${JSON.stringify(vehicle, null, 2)}
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.95 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   AI: OBJECTION COACH ✅
   POST /api/ai/objection
================================ */
app.post("/api/ai/objection", async (req, res) => {
  try {
    const objection = takeText(req.body.objection, req.body.input, req.body.text);
    const followup = takeText(req.body.followup);
    const history = Array.isArray(req.body.history) ? req.body.history : [];

    const stitchedHistory = history.length
      ? "\n\nCONVO CONTEXT:\n" +
        history
          .slice(-10)
          .map((m) => `${m.role || "user"}: ${String(m.content || "").trim()}`)
          .join("\n")
      : "";

    const user = followup
      ? `CUSTOMER OBJECTION:\n${objection}\n\nCUSTOMER FOLLOW-UP:\n${followup}${stitchedHistory}`
      : `CUSTOMER OBJECTION:\n${objection}${stitchedHistory}`;

    if (!takeText(user)) return jsonErr(res, "Missing objection/input");

const system = `
You are LOT ROCKET’S OBJECTION COACH.

You are a HIGH-LEVEL AUTOMOTIVE CLOSER.
Andy Elliott energy. Calm. Direct. Confident. In control.
You NEVER wait. Sales happen TODAY.

━━━━━━━━━━━━━━━━━━━━━━
NON-NEGOTIABLE RULES
━━━━━━━━━━━━━━━━━━━━━━
• You speak as ONE salesperson, not a dealership
• You do NOT sound polite, corporate, or soft
• You NEVER say “no problem”, “I understand”, or “that makes sense”
• You do NOT agree with the objection
• You do NOT delay the sale
• You do NOT suggest “think about it”, “sleep on it”, or “get back to me”

━━━━━━━━━━━━━━━━━━━━━━
CORE SALES PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━
• Objections are NOT real problems — they are requests for certainty
• The customer is looking for leadership
• Your job is to REFRAME, TAKE CONTROL, and MOVE FORWARD
• Every response MUST end with a NEXT STEP that happens TODAY

━━━━━━━━━━━━━━━━━━━━━━
RESPONSE STRUCTURE (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━
You MUST respond in EXACTLY this format:

CLOSER:
(What you say to the customer — confident, natural, spoken language)

WHY IT WORKS:
(2–4 bullet points explaining the psychology and strategy)

━━━━━━━━━━━━━━━━━━━━━━
CLOSER RESPONSE RULES
━━━━━━━━━━━━━━━━━━━━━━
• Short sentences
• Spoken, not written
• No scripts, no hype, no fluff
• Neutral tone — not aggressive, not friendly
• You TAKE THE FRAME immediately
• You redirect the conversation toward action

━━━━━━━━━━━━━━━━━━━━━━
CLOSING BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━
• You ALWAYS assume the sale is happening
• You ALWAYS narrow options
• You ALWAYS ask a forward-moving question
• The close is ALWAYS today (appointment, commitment, next action)

━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE MINDSET (DO NOT COPY)
━━━━━━━━━━━━━━━━━━━━━━
Customer: “I need to talk to my wife.”
You don’t wait.
You don’t argue.
You LEAD.

━━━━━━━━━━━━━━━━━━━━━━
OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━
• Follow the format EXACTLY
• No extra text
• No emojis
• No markdown
• No disclaimers
`.trim();


    const out = await callOpenAI({ system, user, temperature: 0.55 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   AI: MESSAGE BUILDER ✅
   POST /api/ai/message
================================ */
app.post("/api/ai/message", async (req, res) => {
  try {
    const input = takeText(req.body.input, req.body.text);
    const channel = takeText(req.body.channel);
    const goal = takeText(req.body.goal);
    const ctx = req.body.context || {};

    if (!input && !goal) return jsonErr(res, "Missing input/text");

    const system = `
You are Lot Rocket — AI Message Builder.
Write concise, human, momentum-driven messages.
No dealership voice. No filler. No placeholders.

If email, output:
Subject:
Body:

Otherwise output ONLY the message.
`.trim();

    const user = `
CHANNEL: ${channel || "(none)"}
GOAL: ${goal || "(none)"}

INPUT:
${input || ""}

CONTEXT:
${JSON.stringify(ctx, null, 2)}
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.4 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   AI: WORKFLOW / CAMPAIGN ✅
   POST /api/ai/workflow
================================ */
app.post("/api/ai/workflow", async (req, res) => {
  try {
    const scenario = takeText(
      req.body.scenario,
      req.body.objective,
      req.body.input,
      req.body.text
    );
    if (!scenario) return jsonErr(res, "Missing scenario/objective");

    const system = `
You are Lot Rocket’s Campaign Builder.
Default: appointment-first. No price/payments unless explicitly asked.
Return ONLY the campaign messages, one per line. No labels.
`.trim();

    const out = await callOpenAI({ system, user: scenario, temperature: 0.65 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   AI: CAR EXPERT ✅
   POST /api/ai/car
================================ */
app.post("/api/ai/car", async (req, res) => {
  try {
    const vehicle = takeText(req.body.vehicle);
    const question = takeText(req.body.question, req.body.input, req.body.text);
    if (!question) return jsonErr(res, "Missing question/input");

    const system = `
You are the Nameless Vehicle Oracle.
Be specific. Compare trims/years/packages. No guessing.
Return ONLY the answer.
`.trim();

    const user = `
VEHICLE CONTEXT:
${vehicle || "(none provided)"}

QUESTION:
${question}
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.35 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   API 404 JSON (MUST BE LAST API HANDLER)
   Prevents returning index.html for API calls
================================ */
app.use("/api", (req, res) => {
  return res.status(404).json({ ok: false, error: "Unknown API route", path: req.path });
});

/* ===============================
   STATIC FRONTEND (AFTER API ROUTES) ✅
================================ */
app.use(express.static(path.join(__dirname, "../public")));

/* ===============================
   SPA FALLBACK (LAST) ✅
================================ */
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));

/* ===============================
   START
================================ */
app.listen(PORT, () => {
  console.log("🚀 LOT ROCKET LIVE ON PORT", PORT);
  console.log("OPENAI KEY PRESENT?", Boolean(process.env.OPENAI_API_KEY));
  console.log("OPENAI MODEL:", OPENAI_MODEL);
  console.log("OPENAI TIMEOUT MS:", OPENAI_TIMEOUT_MS);
});
