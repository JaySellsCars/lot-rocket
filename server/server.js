// /server/server.js — LOT ROCKET (FINAL / LAUNCH READY) ✅
// Fixes: ✅ /api/boost always returns JSON (no more HTML 200)
// Adds: ✅ /api/boost (scrape) ✅ /api/proxy (ZIP images) ✅ /api/payment-helper
// Adds: ✅ /api/ai/workflow ✅ /api/ai/car
// Fixes: ✅ objection/message payload compatibility
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
   SMALL UTILS
================================ */
const s = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const takeText = (...vals) => vals.map(s).map((t) => t.trim()).find(Boolean) || "";

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
    const s = String(maybe).trim();
    if (!s) return "";
    if (s.startsWith("data:")) return ""; // ignore huge data urls
    if (s.startsWith("//")) return "https:" + s;
    return new URL(s, base).toString();
  } catch {
    return "";
  }
}
const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

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
  // fallback if environment doesn't expose fetch
  const mod = await import("node-fetch");
  return mod.default;
}

/* ===============================
   HEALTH
================================ */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "lot-rocket-1", ts: Date.now() });
});
app.post("/api/ai/ping", (req, res) => {
  res.json({ ok: true, got: req.body || null, ts: Date.now() });
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
    // not fatal: we can still return something, but scraping will be weak
    cheerio = null;
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

    // If dealer blocks us / returns non-html, we still respond JSON
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return res.status(200).json({
        ok: false,
        error: `Dealer returned non-HTML (${ct || "unknown"})`,
        url,
        status: r.status,
      });
    }

    let title = "";
    let description = "";
    let images = [];

    if (cheerio) {
      const $ = cheerio.load(html);

      title =
        takeText(
          $("meta[property='og:title']").attr("content"),
          $("meta[name='twitter:title']").attr("content"),
          $("title").text(),
          $("h1").first().text()
        ) || "";

      description =
        takeText(
          $("meta[property='og:description']").attr("content"),
          $("meta[name='description']").attr("content"),
          $("meta[name='twitter:description']").attr("content")
        ) || "";

      // Images: og:image first, then all imgs (filtered)
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
        // keep likely photos, skip icons/svgs
        const lower = abs.toLowerCase();
        if (lower.endsWith(".svg")) return;
        if (lower.includes("logo")) return;
        if (lower.includes("sprite")) return;

        images.push(abs);
      });

      images = uniq(images).slice(0, 60);

      // Light attempt to find price/mileage/vin/stock if present
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
        title: title || "",
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
        ...(debug ? { debug: { status: r.status, contentType: ct, imageCount: images.length } } : {}),
      });
    }

    // No cheerio available (still JSON)
    return res.status(200).json({
      ok: false,
      error: "cheerio not installed. Run: npm i cheerio",
      url,
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

    // stream
    const buf = Buffer.from(await r.arrayBuffer());
    res.status(200).send(buf);
  } catch (e) {
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
   OPENAI HELPER
================================ */
async function callOpenAI({ system, user, temperature = 0.8 }) {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "Missing OPENAI_API_KEY" };
  }

  const f = await getFetch();
  const r = await f("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const j = await r.json().catch(() => null);
  const text = j?.choices?.[0]?.message?.content?.trim();
  return text ? { ok: true, text } : { ok: false, error: j?.error?.message || "Empty AI response" };
}

/* ===============================
   AI: SOCIAL POSTS (CORE VALUE — ANTI-STALE + SEEDED) ✅
   - Seeded variation (changes every request)
   - Enforces angle + structure + CTA rotation
   - Works for Boost + per-box "New Post" buttons
================================ */
app.post("/api/ai/social", async (req, res) => {
  try {
    const vehicle = req.body.vehicle || {};
    const platform = normPlatform(req.body.platform || "facebook");

    // Variation seed (changes every request)
    // Helps force different hooks + structure + angle even for same car.
    const seed =
      String(req.body.seed || "").trim() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // Optional but killer context helpers (safe, non-breaking)
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
   D) Winter/Michigan lifestyle fit
   E) Space/utility/family practicality
   F) Sporty/fun/driver feel
   G) Rare deal/value vs market
4) Rotate structure each time. Pick ONE structure:
   S1) Hook → proof → bullets → CTA
   S2) Hook → who it’s for → bullets → CTA
   S3) Hook → story micro-scenario → bullets → CTA
   S4) Hook → “3 reasons” → CTA
   S5) Hook → objection killer → CTA
5) Rotate CTA phrasing every time (DM me / comment “INFO” / text me / “want numbers?” / “want to see it today?”)

HOOK RULE (MANDATORY):
Start with a scroll-stopping hook that is NOT generic.
No repeating hooks. No “STOP SCROLLING” every time.
Hooks should be short and different:
• curiosity • payment • scarcity • challenge • identity • mistake-to-avoid • “this is the smart buy”

BUYER PSYCHOLOGY:
• Identify WHO it’s perfect for
• Reduce fear early (certified/clean history/reliability when applicable)
• Translate features into real-life benefits
• Control urgency without fake hype
• Frame hesitation as regret (without pressure)

VEHICLE INTELLIGENCE:
• Adjust language by vehicle type:
  – Truck = capability, strength, work + lifestyle
  – SUV = family, winter, versatility, value
  – Car = commute, affordability, MPG
  – EV = savings, tech, simplicity
• If location exists, reference weather/lifestyle subtly

PLATFORM RULES:
Facebook / Marketplace:
• 2–3 short sections
• Emojis used with intent (not spam)
• Bullet features people actually care about
• Strong DM CTA

Instagram:
• Punchy lines
• White space
• Emotion + identity
• Light urgency

TikTok:
• Short aggressive hook
• Skimmable bullets
• Fast pacing

LinkedIn:
• Cleaner tone
• Professional confidence
• Still sales-driven

X (Twitter):
• Max 280 chars
• One idea
• Curiosity + CTA

STRICT BANS:
• No generic openings
• No “Ready to elevate your driving experience”
• No dealership language
• No website links
• No fake hype

HASHTAGS:
• Platform-appropriate
• Geo-aware if location exists
• Never excessive

OUTPUT:
Return ONLY the final ${platform} post.
No explanations.
No markdown.
`.trim();

    // "Both": seed + optional killer context (still uses full JSON)
    const user = `
PLATFORM: ${platform}

VARIATION SEED (do not mention this): ${seed}
Use the seed to ensure hook + structure + angle are DIFFERENT each time.

OPTIONAL CONTEXT (use if helpful, do not mention as labels):
- Label: ${label || "—"}
- Price: ${price || "—"}
- Miles: ${miles || "—"}
- Color: ${ext || "—"}
- VIN: ${vin ? vin.slice(-6) : "—"} (last 6 only)

VEHICLE DATA:
${JSON.stringify(vehicle, null, 2)}
`.trim();

    const out = await callOpenAI({
      system,
      user,
      temperature: 0.95, // higher = more variation
    });

    return res.json(out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
});



app.post("/api/ai/objection", async (req, res) => {
  const objection = takeText(req.body.objection, req.body.input, req.body.text);

  const system = `
You are an elite automotive objection handler and closer.

You respond like a real human sales professional who has handled thousands of deals.
You are calm, confident, financially realistic, and in control of the conversation.

STYLE RULES:
- No numbered lists
- No labels like "ACKNOWLEDGE" or "FRAME"
- No scripts
- No corporate tone
- No over-apologizing

BEHAVIOR:
- Address the objection directly
- Normalize it without validating indecision
- Explain the reality simply and confidently
- Move the conversation forward naturally
- Teach while closing
- If the user replies, continue the SAME conversation — do not reset

IMPORTANT:
- Do NOT always ask a question
- Only ask a question if it advances the deal
- If a follow-up is provided, respond to it directly
- Assume this is a real customer conversation

Your goal is to reduce hesitation and guide the customer to a decision without pressure.
`.trim();

  const out = await callOpenAI({
    system,
    user: objection,
    temperature: 0.55
  });

  res.json(out.ok ? { ok: true, text: out.text } : out);
});




/* ===============================
   AI: MESSAGE BUILDER (COMPAT)
   Accepts: {details} OR {input} OR {text}
================================ */
app.post("/api/ai/message", async (req, res) => {
  const input = takeText(req.body.details, req.body.input, req.body.text);

  const system = `
You write high-reply car sales messages.
Short. Human. Direct.
Always include CTA.
`.trim();

  const out = await callOpenAI({ system, user: input, temperature: 0.45 });
  res.json(out.ok ? { ok: true, text: out.text } : out);
});

/* ===============================
   AI: WORKFLOW (Campaign Builder)
   Accepts: {scenario}
================================ */
const system = `
You are an elite automotive campaign strategist.

You build campaigns that do EXACTLY what is asked.
Nothing more. Nothing less.

RULES:
- Follow the timeframe exactly (1 day = 1 day)
- Follow the channel exactly (text = text only)
- Follow the quantity exactly (4 messages = 4 messages)
- Do NOT add extra platforms
- Do NOT add follow-up days unless asked

STYLE:
- Urgent but human
- Short, punchy, appointment-focused
- No filler explanations
- Output ONLY the campaign

If the user asks:
"1 day, 4 text blast"
You deliver exactly:
4 texts for the same day.

If the user asks:
"5 day Facebook campaign"
You deliver exactly:
5 days of Facebook content.

Precision matters more than creativity.
`.trim();


  const out = await callOpenAI({ system, user: scenario, temperature: 0.55 });
  res.json(out.ok ? { ok: true, text: out.text } : out);
});

/* ===============================
   AI: ASK AI
================================ */
app.post("/api/ai/ask", async (req, res) => {
  const q = takeText(req.body.question, req.body.input);

  const system = `
You are the Lot Rocket helper.
Answer clearly, fast, and practical.
No fluff. No long lectures.
If missing details, ask ONE question max.
`.trim();

  const out = await callOpenAI({ system, user: q, temperature: 0.4 });
  res.json(out.ok ? { ok: true, text: out.text } : out);
});

/* ===============================
   AI: CAR EXPERT
   Accepts: {vehicle, question}
================================ */
app.post("/api/ai/car", async (req, res) => {
  const vehicle = takeText(req.body.vehicle);
  const question = takeText(req.body.question, req.body.input, req.body.text);

  const system = `
You are the Nameless Vehicle Oracle.
No guessing. Be specific.
Compare trims/years/packages. Explain "invisible" differences.
If you need ONE missing detail to be accurate, ask it once.
`.trim();

  const user = `
VEHICLE CONTEXT:
${vehicle || "(none provided)"}

QUESTION:
${question}
`.trim();

  const out = await callOpenAI({ system, user, temperature: 0.35 });
  res.json(out.ok ? { ok: true, text: out.text } : out);
});

/* ===============================
   STATIC FRONTEND (AFTER API ROUTES) ✅
================================ */
app.use(express.static(path.join(__dirname, "../public")));

/* ===============================
   SPA FALLBACK (LAST) ✅
================================ */
app.get("*", (_, res) => res.sendFile(path.join(__dirname, "../public/index.html")));

app.listen(PORT, () => console.log("🚀 LOT ROCKET LIVE ON PORT", PORT));
