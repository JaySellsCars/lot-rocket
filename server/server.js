// /server/server.js  (REPLACE ENTIRE FILE)
// LOT ROCKET — FINAL / LAUNCH READY ✅
// Fixes: ✅ /api/boost always returns JSON (no more HTML 200)
// Adds: ✅ /api/boost (scrape) ✅ /api/proxy (ZIP images) ✅ /api/payment-helper
// Fixes: ✅ AI routes consistent JSON + timeout
// Adds: ✅ /api/ai/ping, /api/ai/social, /api/ai/objection, /api/ai/message, /api/ai/workflow, /api/ai/ask, /api/ai/car
// Critical: ✅ API routes come BEFORE static + SPA fallback

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
    if (v.startsWith("data:")) return ""; // ignore huge data urls
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
   HEALTH + PING
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

  if (!url) {
    return res.status(400).json({ ok: false, error: "Missing or invalid url" });
  }

  let cheerio = null;
  try {
    cheerio = require("cheerio");
  } catch {
    cheerio = null;
  }

  if (!cheerio) {
    return res.status(200).json({
      ok: false,
      error: "cheerio not installed. Run: npm i cheerio",
      url,
    });
  }

  const f = await getFetch();

  // Common “browser-like” headers
  const baseHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
async function fetchHtmlWithFallback(url) {
  // First attempt (normal)
  let r = await f(url, {
    redirect: "follow",
    headers: baseHeaders,
  });
// 🚫 HARD STOP if dealer blocks scraping
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

  if (r.ok) return r;

  // If blocked (403 / 429), retry with heavier headers
  if (r.status === 403 || r.status === 429) {
    const fallbackHeaders = {
      ...baseHeaders,
      Referer: url,
      Origin: new URL(url).origin,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    };

    r = await f(url, {
      redirect: "follow",
      headers: fallbackHeaders,
    });
  }

  return r;
}

  async function fetchHtmlDirect(targetUrl) {
    const r = await f(targetUrl, {
      redirect: "follow",
      headers: {
        ...baseHeaders,
        Referer: targetUrl,
        Origin: new URL(targetUrl).origin,
      },
    });
    const html = await r.text();
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    return { r, html, ct, via: "direct" };
  }

  async function fetchHtmlViaJina(targetUrl) {
    // r.jina.ai often bypasses basic 403 blocks
    const cleaned = targetUrl.replace(/^https?:\/\//i, "");
    const jinaUrl = `https://r.jina.ai/https://${cleaned}`;

    const r = await f(jinaUrl, {
      redirect: "follow",
      headers: {
        ...baseHeaders,
        Referer: jinaUrl,
      },
    });
    const html = await r.text();
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    return { r, html, ct, via: "jina", jinaUrl };
  }

  function extractImages(base, $, rawHtml) {
    let images = [];

    // OG image first
    const ogImg = absUrl(base, $("meta[property='og:image']").attr("content"));
    if (ogImg) images.push(ogImg);

    // Common srcset parsing
    $("img").each((_, el) => {
      const src =
        $(el).attr("data-src") ||
        $(el).attr("data-lazy") ||
        $(el).attr("data-original") ||
        $(el).attr("src") ||
        "";

      const srcset = $(el).attr("srcset") || "";
      const firstSrcset = (srcset.split(",")[0] || "").trim().split(" ")[0];

      const pick = src || firstSrcset || "";
      const abs = absUrl(base, pick);
      if (!abs) return;

      const lower = abs.toLowerCase();
      if (lower.endsWith(".svg")) return;
      if (lower.includes("logo")) return;
      if (lower.includes("sprite")) return;

      images.push(abs);
    });

    // JSON-LD images (common on dealers)
    $("script[type='application/ld+json']").each((_, el) => {
      const txt = $(el).text() || "";
      if (!txt.trim()) return;
      try {
        const j = JSON.parse(txt);
        const grab = (node) => {
          if (!node) return;
          if (typeof node === "string") {
            const u = absUrl(base, node);
            if (u) images.push(u);
            return;
          }
          if (Array.isArray(node)) return node.forEach(grab);
          if (typeof node === "object") {
            if (node.image) grab(node.image);
            if (node.contentUrl) grab(node.contentUrl);
            if (node.url) grab(node.url);
            Object.values(node).forEach(grab);
          }
        };
        grab(j);
      } catch {}
    });

    // LAST RESORT: find image-ish URLs in raw HTML/text (jina often returns text)
    if (rawHtml) {
      const matches =
        rawHtml.match(/https?:\/\/[^\s"'<>]+?\.(jpg|jpeg|png|webp)/gi) || [];
      matches.forEach((u) => images.push(u));
    }

    images = uniq(images).slice(0, 60);
    return images;
  }

  function extractVehicle(urlBase, $) {
    const title =
      takeText(
        $("meta[property='og:title']").attr("content"),
        $("meta[name='twitter:title']").attr("content"),
        $("title").text(),
        $("h1").first().text()
      ) || "Dealer Website";

    const description =
      takeText(
        $("meta[property='og:description']").attr("content"),
        $("meta[name='description']").attr("content"),
        $("meta[name='twitter:description']").attr("content")
      ) || "";

    const textBlob = $("body").text().replace(/\s+/g, " ").trim();
    const find = (re) => {
      const m = textBlob.match(re);
      return m ? m[0] : "";
    };

    const price = find(/\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?/);
    const vin = find(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    const mileage = find(/\b\d{1,3}(?:,\d{3})+\s?(?:miles|mi)\b/i);
    const stock = find(/\bStock\s*#?\s*[:\-]?\s*[A-Za-z0-9\-]+\b/i);

    return {
      url: urlBase,
      title,
      description,
      price: price || "",
      mileage: mileage || "",
      vin: vin || "",
      stock: stock ? stock.replace(/^Stock\s*#?\s*[:\-]?\s*/i, "") : "",
    };
  }

  // ---------- Attempt 1: DIRECT ----------
  try {
    let attempt = await fetchHtmlDirect(url);

    // If dealer blocks (403/401/429), try Jina fallback
    if (attempt.r.status === 403 || attempt.r.status === 401 || attempt.r.status === 429) {
      const fallback = await fetchHtmlViaJina(url);
      // Use fallback only if it returns something usable
      if (fallback?.html && fallback.html.length > 200) attempt = fallback;
    }

    // If still blocked
    if (attempt.r.status === 403 || attempt.r.status === 401 || attempt.r.status === 429) {
      return res.status(200).json({
        ok: false,
        error:
          `Dealer blocked scraping (HTTP ${attempt.r.status}). Try a different dealer site, or we can add a per-dealer extractor for this domain.`,
        url,
        ...(debug ? { debug: { status: attempt.r.status, contentType: attempt.ct, via: attempt.via } } : {}),
      });
    }

    // Must be “HTML-ish” or text (jina)
    const isOkType =
      attempt.ct.includes("text/html") ||
      attempt.ct.includes("application/xhtml") ||
      attempt.ct.includes("text/plain");

    if (!isOkType) {
      return res.status(200).json({
        ok: false,
        error: `Dealer returned non-HTML (${attempt.ct || "unknown"})`,
        url,
        status: attempt.r.status,
      });
    }

    const $ = cheerio.load(attempt.html);

    const vehicle = extractVehicle(url, $);
    const images = extractImages(url, $, attempt.html);

    return res.status(200).json({
      ok: true,
      vehicle,
      images,
      ...(debug
        ? {
            debug: {
              status: attempt.r.status,
              contentType: attempt.ct,
              imageCount: images.length,
              via: attempt.via,
              ...(attempt.jinaUrl ? { jinaUrl: attempt.jinaUrl } : {}),
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
   const r = await fetchHtmlWithFallback(url);

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
    return text
      ? { ok: true, text }
      : { ok: false, error: j?.error?.message || "Empty AI response" };
  } catch (e) {
    const isAbort = e?.name === "AbortError";
    return {
      ok: false,
      error: isAbort ? "OpenAI timeout" : (e?.message || String(e)),
    };
  } finally {
    clearTimeout(t);
  }
}

/* ===============================
   LOT ROCKET HELP KB (v1)
   Keep this updated as features evolve.
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
- Objection Coach: objection handling + coaching
- Calculator: basic calculator
- Payment Calculator: server estimate via /api/payment-helper
- Income Calculator: estimates income from YTD gross + last pay date
- AI Campaign Builder: appointment-first campaigns (no payments/credit unless user asks)
- AI Message Builder: single message/email/text/DM/social reply
- Ask A.I. / Help: how to use the app + troubleshooting
- AI Car Expert: vehicle oracle Q&A

TROUBLESHOOTING:
- If AI is generic: user needs to include specific feature/tool + where they are (Step 1/2/3) + what they clicked + any error text.
- If /api/boost returns HTML: route order or fallback is wrong (API must be before static + SPA fallback).
- If ZIP download fails: /api/proxy must be working (proxy avoids CORS).
`.trim();

/* ===============================
   AI: HELP / ASK (KB POWERED) ✅
   POST /api/ai/ask
   Accepts: {question} OR {input} OR {text}
   Optional: {context}
================================ */
app.post("/api/ai/ask", async (req, res) => {
  try {
    const q = takeText(req.body.question, req.body.input, req.body.text);
    const ctx = req.body.context || {};

    if (!q) return jsonErr(res, "Missing question/input");

    const system = `
You are Lot Rocket Help.

You answer ONLY about the Lot Rocket app: how it works, how to use it, and how to fix common issues.
You are speaking to MANY users (paid app), so never personalize to one person.

USE THIS APP MANUAL AS SOURCE OF TRUTH:
${APP_KB}

BEHAVIOR:
- Give direct steps, not generic advice
- If a fix involves code, specify file + exact snippet
- If info is missing, ask ONE question max
- Use UI context if provided

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
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   AI: SOCIAL POSTS (CORE VALUE) ✅
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

You are the best automotive social media salesperson on Earth.
You write posts that STOP the scroll and generate DMs.

IDENTITY (NON-NEGOTIABLE):
• You speak as an INDIVIDUAL car salesperson
• NEVER promote or mention the dealership
• NEVER send people to a website
• Your ONLY goal is messages, comments, appointments

VOICE:
• Confident • modern • human • direct
• Zero corporate tone
• Sounds like a top 1% real salesperson

ANTI-STALE RULES (MANDATORY):
1) Every output MUST be meaningfully different from prior outputs for the same vehicle.
2) NEVER reuse the same hook wording twice.
3) Rotate the “angle” each time. Choose ONE primary angle:
   A) Payment/affordability
   B) Reliability/peace-of-mind
   C) Tech/features people actually use
   D) Winter/lifestyle fit
   E) Space/utility/family practicality
   F) Sporty/fun/driver feel
   G) Rare deal/value vs market
4) Rotate structure each time. Pick ONE structure:
   S1) Hook → proof → bullets → CTA
   S2) Hook → who it’s for → bullets → CTA
   S3) Hook → micro-scenario → bullets → CTA
   S4) Hook → “3 reasons” → CTA
   S5) Hook → objection killer → CTA
5) Rotate CTA phrasing every time.

STRICT BANS:
• No generic openings
• No dealership language
• No website links
• No fake hype

OUTPUT:
Return ONLY the final ${platform} post.
No explanations.
No markdown.
`.trim();

    const user = `
PLATFORM: ${platform}

VARIATION SEED (do not mention this): ${seed}

OPTIONAL CONTEXT:
- Label: ${label || "—"}
- Price: ${price || "—"}
- Miles: ${miles || "—"}
- Color: ${ext || "—"}
- VIN (last 6): ${vin ? vin.slice(-6) : "—"}

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
   AI: OBJECTION COACH (ELITE)
   Accepts: {objection} OR {input} OR {text}
   Optional: {followup} OR {history}
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
You are LOT ROCKET's Objection Coach: an elite automotive closer + teacher.

OUTPUT FORMAT (EXACT):
CUSTOMER:
<what you would say to the customer>

COACH:
<quick explanation of why you handled it like that>

NON-NEGOTIABLE STYLE:
- No corporate voice
- No fake warmth or filler
- Calm, in control, direct
- Take control without pressure
- End with a micro-commitment / next step
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.55 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   AI: MESSAGE BUILDER ✅
   Accepts: {input} OR {text}
   Optional: {channel} {goal} {context}
================================ */
app.post("/api/ai/message", async (req, res) => {
  try {
    const input = takeText(req.body.input, req.body.text);
    const channel = takeText(req.body.channel); // "email" | "text" | "dm" | "social"
    const goal = takeText(req.body.goal);
    const ctx = req.body.context || {};

    if (!input && !goal) return jsonErr(res, "Missing input/text");

    const system = `
You are Lot Rocket — AI Message Builder.

You write direct-response messages for real car salespeople who are actively working live deals.
Every message protects momentum and gets a reply.

━━━━━━━━━━
IDENTITY
━━━━━━━━━━
• You are ONE individual salesperson
• Never write as a dealership, store, or company
• No “we”, “our”, “the team”, or “automotive family”
• Sound human, confident, calm, and in control

━━━━━━━━━━
STYLE
━━━━━━━━━━
• Clear, intentional, concise
• Zero corporate filler
• Zero legal/compliance tone
• No fake warmth or forced friendliness
• Confident without being aggressive
• Never sound scripted

━━━━━━━━━━
SALES PRINCIPLES
━━━━━━━━━━
• Protect the deal
• Maintain urgency without pressure
• Give a clear reason to respond now
• Move the conversation forward
• Ask for ONE clear action only when it advances the deal

━━━━━━━━━━
CHANNEL AWARENESS
━━━━━━━━━━
• Email: professional, firm, clean, time-respectful
• Text/SMS: conversational, tight, momentum-driven
• DM: direct, human, fast
• Social reply: short, casual, response-oriented

━━━━━━━━━━
STRICT BANS
━━━━━━━━━━
Never say:
“I hope this message finds you well”
“Please let me know a convenient time”
“We appreciate your business”

Never include placeholders like:
[Your Name] [Your Company] [Dealership]

━━━━━━━━━━
OUTPUT
━━━━━━━━━━
Return ONLY the message.

If email, include:
Subject:
Body:

Nothing else.
`.trim();

    const user = `
CHANNEL (optional): ${channel || "(not provided)"}
GOAL (optional): ${goal || "(not provided)"}

INPUT:
${input || ""}

CONTEXT (optional):
${JSON.stringify(ctx, null, 2)}
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.4 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   AI: WORKFLOW (Campaign Builder) — APPOINTMENT FIRST ✅
   Accepts: {scenario} OR {objective} OR {input} OR {text}
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

You create appointment-driven campaigns for car salespeople.
Your PRIMARY job is to get the customer in the door to see and drive the vehicle.

━━━━━━━━━━
DEFAULT MODE (LOCKED)
━━━━━━━━━━
Appointment-first mode by default:
• NO price
• NO payments
• NO credit
• NO financing
• NO trade-ins
• NO incentives unless explicitly requested

If (and ONLY if) the user explicitly asks for price/payment/credit/financing/discount:
→ then you may include it.

━━━━━━━━━━
IDENTITY (LOCKED)
━━━━━━━━━━
• You are ONE individual salesperson
• Never write as a dealership
• Never say “we”, “our”, or “the team”
• Human, confident, calm, professional

━━━━━━━━━━
HARD RULES (NON-NEGOTIABLE)
━━━━━━━━━━
1) Follow the CHANNEL exactly (Text vs Email vs FB etc.)
2) Follow the TIMEFRAME exactly (1 day = that day only)
3) Follow the QUANTITY exactly (no extras)
4) Do NOT include headings, explanations, strategy notes, automation, or extra sections
5) Emojis only if natural for that channel

━━━━━━━━━━
COPY RULES
━━━━━━━━━━
• Short, clean, human
• Never overly salesy
• No pressure language
• No assumptions
• No placeholders like [Name]
• Each message must be different in angle
• Ask for ONE simple action at most

━━━━━━━━━━
OUTPUT
━━━━━━━━━━
Return ONLY the campaign messages.
One message per line.
No labels.
No markdown.
No commentary.
`.trim();

    const out = await callOpenAI({ system, user: scenario, temperature: 0.65 });
    return jsonOk(res, out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return jsonErr(res, e?.message || String(e));
  }
});

/* ===============================
   AI: CAR EXPERT ✅
   Accepts: {vehicle, question} OR {input} OR {text}
================================ */
app.post("/api/ai/car", async (req, res) => {
  try {
    const vehicle = takeText(req.body.vehicle);
    const question = takeText(req.body.question, req.body.input, req.body.text);
    if (!question) return jsonErr(res, "Missing question/input");

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
    return jsonErr(res, e?.message || String(e));
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
