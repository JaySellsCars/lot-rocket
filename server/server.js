// /server/server.js — LOT ROCKET (FINAL / LAUNCH READY) ✅
// ✅ API routes BEFORE static + SPA fallback
// ✅ /api/boost always returns JSON (and fails clean on 403 blocks)
// ✅ /api/proxy for ZIP downloads
// ✅ /api/payment-helper server-side payment calc
// ✅ AI routes: /api/ai/ping, /api/ai/social, /api/ai/objection, /api/ai/message, /api/ai/workflow, /api/ai/ask, /api/ai/car
// ✅ Consistent JSON responses from AI (ok/text OR ok:false/error)

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
  if (req.path.startsWith("/api/ai/")) {
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
const s = (v) =>
  v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
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
  if (typeof fetch === "function") return fetch; // Node 18+ has fetch
  const mod = await import("node-fetch");
  return mod.default;
}

/* ===============================
   HEALTH + AI PING
================================ */
app.get("/api/health", (_req, res) => {
  return res.json({ ok: true, service: "lot-rocket-1", ts: Date.now() });
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

  if (!url)
    return res
      .status(400)
      .json({ ok: false, error: "Missing or invalid url" });

  let cheerio = null;
  try {
    cheerio = require("cheerio");
  } catch {
    cheerio = null;
  }

  try {
    const f = await getFetch();

    const baseHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    const r = await f(url, {
      redirect: "follow",
      headers: baseHeaders,
    });

    // ✅ OPTIONAL HARD STOP: dealer blocks (403/401/429/etc.)
    if (!r || !r.ok) {
      return res.status(200).json({
        ok: false,
        error: `Dealer blocked scraping (${r?.status || "no response"}).`,
        url,
        debug: {
          status: r?.status || null,
          contentType: r?.headers?.get("content-type") || null,
        },
      });
    }

    const html = await r.text();
    const ct = (r.headers.get("content-type") || "").toLowerCase();

    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return res.status(200).json({
        ok: false,
        error: `Dealer returned non-HTML (${ct || "unknown"})`,
        url,
        status: r.status,
      });
    }

    if (!cheerio) {
      return res.status(200).json({
        ok: false,
        error: "cheerio not installed. Run: npm i cheerio",
        url,
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
    const find = (re) => {
      const m = textBlob.match(re);
      return m ? m[0] : "";
    };

    const price = find(/\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?/);
    const vin = find(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    const mileage = find(/\b\d{1,3}(?:,\d{3})+\s?(?:miles|mi)\b/i);
    const stock = find(/\bStock\s*#?\s*[:\-]?\s*[A-Za-z0-9\-]+\b/i);

    const vehicle = {
      url,
      title: title || "Dealer Website",
      description: description || "",
      price: price || "",
      mileage: mileage || "",
      vin: vin || "",
      stock: stock ? stock.replace(/^Stock\s*#?\s*[:\-]?\s*/i, "") : "",
    };

    return res.status(200).json({
      ok: true,
      vehicle,
      images,
      ...(debug
        ? {
            debug: {
              status: r.status,
              contentType: ct,
              imageCount: images.length,
            },
          }
        : {}),
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: e?.message || String(e),
      url,
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
    return res
      .status(500)
      .json({ ok: false, message: e?.message || String(e) });
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
LOT ROCKET — APP MANUAL (PAID APP / MULTI-USER)

CORE IDEA:
Lot Rocket is for INDIVIDUAL car salespeople (not dealerships).
Goal: generate posts, messages, campaigns + creative assets fast.

MAIN FLOW:
STEP 1 — Dealer URL Scraper
- Paste a dealer vehicle URL
- Click "Boost This Listing"
- App scrapes title/desc and tries to extract photos
- Some dealer sites block scraping (403/401). In that case use a different source URL.

STEP 2 — Social Media Kit
- Platform textareas: Facebook, IG, TikTok, LinkedIn, X, DM, Marketplace, Hashtags
- Buttons per platform: New Post, Copy, Remove Emojis

STEP 3 — Creative Lab
- Holding Zone: up to 24 thumbnails (wrap, no scroll)
- Double-click a holding photo sends it to Social Ready Strip
- Social Ready Strip:
  - Large preview image
  - Lock badge 🔒 toggles locked/unlocked
  - Download ZIP downloads locked images via /api/proxy

TOOLS (Right Rail):
- Objection Coach
- Calculator
- Payment Calculator (/api/payment-helper)
- Income Calculator (client-side)
- AI Campaign Builder (/api/ai/workflow)
- AI Message Builder (/api/ai/message)
- Ask A.I. / Help (/api/ai/ask)
- AI Car Expert (/api/ai/car)

KNOWN FIXES:
- If Boost returns 403: that dealer blocks scraping. Try a different listing URL.
- If ZIP fails: /api/proxy must be working.
`.trim();

/* ===============================
   AI: ASK / HELP (uses KB) ✅
================================ */
app.post("/api/ai/ask", async (req, res) => {
  const q = takeText(req.body.question, req.body.input, req.body.text);
  const ctx = req.body.context || {};

  if (!q) return jsonOk(res, { ok: false, error: "Missing question/input" });

  const system = `
You are Lot Rocket Help.

You must answer ONLY about the Lot Rocket app: how it works, how to use it, and how to fix common issues.
You are speaking to MANY users (paid app), so never personalize to one person.

USE THIS APP MANUAL AS SOURCE OF TRUTH:
${APP_KB}

BEHAVIOR:
- Give direct steps, not generic advice
- If a fix involves code, specify file + exact snippet
- If info is missing, ask ONE question max

OUTPUT:
- Short, actionable answer
- If steps: 3–7 bullets max
`.trim();

  const user = `
USER QUESTION:
${q}

UI CONTEXT (may be empty):
${JSON.stringify(ctx, null, 2)}
`.trim();

  const out = await callOpenAI({ system, user, temperature: 0.25 });
  return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
});

/* ===============================
   AI: SOCIAL POSTS (core value)
================================ */
app.post("/api/ai/social", async (req, res) => {
  try {
    const vehicle = req.body.vehicle || {};
    const platform = normPlatform(req.body.platform || "facebook");

    const seed =
      String(req.body.seed || "").trim() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const system = `
YOU ARE LOT ROCKET.

You are the best automotive social media salesperson on Earth.
You write posts that STOP the scroll and generate DMs.

IDENTITY (NON-NEGOTIABLE):
• You speak as an INDIVIDUAL car salesperson
• NEVER promote or mention the dealership
• NEVER send people to a website
• Your ONLY goal is messages, comments, appointments

ANTI-STALE RULES (MANDATORY):
1) Every output MUST be meaningfully different.
2) NEVER reuse the same hook wording twice.
3) Rotate the “angle” each time (pick ONE): affordability, reliability, tech, lifestyle, family/utility, fun, value.
4) Rotate structure (pick ONE): Hook→proof→bullets→CTA, Hook→who it’s for→bullets→CTA, Hook→scenario→bullets→CTA, Hook→3 reasons→CTA, Hook→objection-killer→CTA.
5) Rotate CTA phrasing every time.

STRICT BANS:
• No generic openings
• No dealership language
• No website links
• No fake hype

OUTPUT:
Return ONLY the final ${platform} post.
No explanations. No markdown.
`.trim();

    const user = `
PLATFORM: ${platform}
VARIATION SEED (do not mention): ${seed}

VEHICLE DATA:
${JSON.stringify(vehicle, null, 2)}
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.95 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   AI: OBJECTION COACH
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

    if (!takeText(user)) return jsonOk(res, { ok: false, error: "Missing objection/input" });

    const system = `
You are LOT ROCKET's Objection Coach: an elite automotive closer + teacher.

PRIMARY OUTPUT: What to say to the customer (human, confident, no fluff).
SECONDARY OUTPUT: A quick coaching note explaining WHY you handled it that way.

NON-NEGOTIABLE STYLE:
- No numbered lists
- No headings like "ACKNOWLEDGE" / "FRAME"
- No corporate voice
- No soft filler
- Sound like a real top producer who is calm and in control

OUTPUT FORMAT (EXACT):
CUSTOMER:
<what you would say to the customer>

COACH:
<quick explanation of why you handled it like that>
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.55 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonOk(res, { ok: false, error: e?.message || String(e) });
  }
});

/* ===============================
   AI: MESSAGE BUILDER ✅
   Accepts: {details} OR {input} OR {text} OR {message}
================================ */
app.post("/api/ai/message", async (req, res) => {
  try {
    const input = takeText(
      req.body.details,
      req.body.message,
      req.body.input,
      req.body.text
    );
    if (!input) return jsonOk(res, { ok: false, error: "Missing message/details/input" });

    const system = `
You are Lot Rocket — AI Message Builder.

You write direct-response messages for real car salespeople working live deals.
Every message protects momentum and gets a reply.

IDENTITY:
• You are ONE individual salesperson
• Never write as a dealership, store, or company
• No “we”, “our”, or “the team”

STYLE:
• Clear, intentional, concise
• Zero corporate filler
• Confident without being aggressive
• Never sound scripted

RULES:
• Ask for ONE clear action only
• No placeholders like [Name]
• No explanations

OUTPUT:
Return ONLY the message.
If email, include:
Subject:
Body:
`.trim();

    const out = await callOpenAI({ system, user: input, temperature: 0.4 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonOk(res, { ok: false, error: e?.message || String(e) });
  }
});

/* ===============================
   AI: WORKFLOW (Campaign Builder)
================================ */
app.post("/api/ai/workflow", async (req, res) => {
  try {
    const scenario = takeText(
      req.body.scenario,
      req.body.objective,
      req.body.input,
      req.body.text
    );

    if (!scenario) return jsonOk(res, { ok: false, error: "Missing scenario/objective" });

    const system = `
You are Lot Rocket’s Campaign Builder.
You create appointment-driven campaigns for car salespeople.

HARD RULES:
1) Follow the CHANNEL exactly if specified
2) Follow the TIMEFRAME exactly if specified
3) Follow the QUANTITY exactly if specified
4) Do NOT include headings, explanations, strategy notes, or markdown

DEFAULT MODE:
Appointment-first. No pricing/payments/credit unless explicitly requested.

OUTPUT:
Return ONLY the campaign messages.
One message per line.
No labels.
`.trim();

    const out = await callOpenAI({ system, user: scenario, temperature: 0.65 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonOk(res, { ok: false, error: e?.message || String(e) });
  }
});

/* ===============================
   AI: CAR EXPERT (Nameless Oracle)
================================ */
app.post("/api/ai/car", async (req, res) => {
  try {
    const vehicle = takeText(req.body.vehicle);
    const question = takeText(req.body.question, req.body.input, req.body.text);
    if (!question) return jsonOk(res, { ok: false, error: "Missing question/input" });

    const system = `
You are the Nameless Vehicle Oracle.
No guessing. Be specific.
Compare trims/years/packages. Explain invisible differences.
If you need ONE missing detail to be accurate, ask it once.
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
    return jsonOk(res, { ok: false, error: e?.message || String(e) });
  }
});

/* ===============================
   STATIC FRONTEND (AFTER API ROUTES) ✅
================================ */
app.use(express.static(path.join(__dirname, "../public")));

/* ===============================
   SPA FALLBACK (LAST) ✅
================================ */
app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "../public/index.html"))
);

app.listen(PORT, () => {
  console.log("🚀 LOT ROCKET LIVE ON PORT", PORT);
  console.log("OPENAI KEY PRESENT?", Boolean(process.env.OPENAI_API_KEY));
  console.log("OPENAI MODEL:", OPENAI_MODEL);
  console.log("OPENAI TIMEOUT MS:", OPENAI_TIMEOUT_MS);
});
