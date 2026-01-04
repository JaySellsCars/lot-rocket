// /server/server.js  (REPLACE ENTIRE FILE)
// LOT ROCKET — FINAL / LAUNCH READY ✅ (BOOT-SAFE)
// Fixes: ✅ SyntaxError: Unexpected end of input (guaranteed closed strings/braces)
// Fixes: ✅ API routes BEFORE static + SPA fallback
// Fixes: ✅ /api/* never returns HTML (prevents "AI returned non-JSON")
// Adds: ✅ /api (root) JSON
// Adds: ✅ /api/boost ✅ /api/proxy ✅ /api/payment-helper
// Adds: ✅ /api/ai/ping + /api/ai/ask/social/objection/message/workflow/car

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
app.get("/api", (_req, res) => res.json({ ok: true, note: "api root alive" }));
app.get("/api/", (_req, res) => res.json({ ok: true, note: "api root alive" }));

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

    // ---- JSON-LD vehicle parse (best-effort) ----
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

    // ---- Images ----
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

    // ---- Regex fallback scan ----
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
   APP KB (no backtick nesting)
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

  const system = [
    "YOU ARE LOT ROCKET.",
    "Write a high-converting social post that generates DMs.",
    "Speak as ONE salesperson. No dealership language. No website links.",
    "Return ONLY the final post. No commentary.",
    `PLATFORM: ${platform}`,
    `SEED: ${seed}`,
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
   API 404 JSON (MUST BE LAST API HANDLER)
================================ */
app.use("/api", (req, res) => {
  return res.status(404).json({ ok: false, error: "Unknown API route", path: req.path });
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
  console.log("OPENAI KEY PRESENT?", Boolean(process.env.OPENAI_API_KEY));
  console.log("OPENAI MODEL:", OPENAI_MODEL);
  console.log("OPENAI TIMEOUT MS:", OPENAI_TIMEOUT_MS);
});
