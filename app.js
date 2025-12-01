// app.js – Lot Rocket backend with AI tools (normalized URLs)

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const fetch = require("node-fetch"); // if you want to use global fetch instead, remove this

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/**
 * Normalize whatever the user pasted into a *real* absolute URL.
 * - adds https:// if missing
 * - returns null if it's still not a valid URL
 */
function normalizeUrl(raw) {
  if (!raw) return null;
  let url = String(raw).trim();
  if (!url) return null;

  // allow "www..." or "dealer.com/vehicle/123"
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url.replace(/^\/+/, "");
  }

  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

// ---------------- Helper: scrape page text ----------------

async function scrapePage(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  // Title + meta
  const title = $("title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") || "";

  // Visible text chunks (simple)
  let visibleText = "";
  $("body *")
    .not("script, style, noscript")
    .each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 40 && text.length < 500) {
        visibleText += text + "\n";
      }
    });

  return { title, metaDesc, visibleText, $ };
}

// ---------------- Helper: scrape vehicle photos ----------------

function scrapeVehiclePhotosFromCheerio($, baseUrl) {
  const urls = new Set();
  const base = new URL(baseUrl);

  $("img").each((_, el) => {
    let src = $(el).attr("data-src") || $(el).attr("src");
    if (!src) return;
    src = src.trim();

    const lower = src.toLowerCase();
    if (
      lower.includes("logo") ||
      lower.includes("icon") ||
      lower.includes("sprite") ||
      lower.endsWith(".svg")
    ) {
      return;
    }

    try {
      const abs = new URL(src, base).href;
      urls.add(abs);
    } catch {
      // ignore bad urls
    }
  });

  return Array.from(urls);
}

// ---------------- Helper: call GPT for structured social kit ----------------

async function buildSocialKit({ pageInfo, labelOverride, priceOverride, photos }) {
  const { title, metaDesc, visibleText } = pageInfo;

  const system = `
You are Lot Rocket, an elite automotive social media copywriter for car salespeople.
You produce a high-converting, multi-platform social media kit as a single JSON object.
Return ONLY valid JSON, no extra text, no backticks.
The JSON must use these keys exactly:
- label                (vehicle title)
- price                (price / offer)
- facebook
- instagram
- tiktok
- linkedin
- twitter
- text                 (generic text blurb)
- marketplace
- hashtags
- selfieScript
- videoPlan
- canvaIdea
`.trim();

  const user = `
Dealer page data:
TITLE: ${title}
META: ${metaDesc}
TEXT SNIPPET:
${visibleText.slice(0, 3000)}

Optional custom label: ${labelOverride || "none"}
Optional custom price: ${priceOverride || "none"}

If label/price overrides are provided, prefer those in the copy.
Create persuasive, trustworthy, high-energy copy that feels like a real salesperson.
Include emojis where appropriate but don't overdo it.
Remember: output MUST be strict JSON for the keys listed above.
`.trim();

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = response.output?.[0]?.content?.[0]?.text || "{}";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse social kit JSON:", e, raw.slice(0, 200));
    parsed = {};
  }

  const kit = {
    vehicleLabel: labelOverride || parsed.label || "",
    priceInfo: priceOverride || parsed.price || "",
    facebook: parsed.facebook || "",
    instagram: parsed.instagram || "",
    tiktok: parsed.tiktok || "",
    linkedin: parsed.linkedin || "",
    twitter: parsed.twitter || "",
    text: parsed.text || "",
    marketplace: parsed.marketplace || "",
    hashtags: parsed.hashtags || "",
    selfieScript: parsed.selfieScript || "",
    shotPlan: parsed.videoPlan || "",
    designIdea: parsed.canvaIdea || "",
    photos: photos || [],
  };

  return kit;
}

// ---------------- ROUTES ----------------

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Full social kit from dealer URL
app.post("/api/social-kit", async (req, res) => {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    const labelOverride = req.body?.labelOverride || "";
    const priceOverride = req.body?.priceOverride || "";

    if (!pageUrl) {
      return res
        .status(400)
        .json({ error: "Invalid or missing URL. Please paste a full dealer link." });
    }

    const pageInfo = await scrapePage(pageUrl);
    const photos = scrapeVehiclePhotosFromCheerio(pageInfo.$, pageUrl);

    const kit = await buildSocialKit({
      pageInfo,
      labelOverride,
      priceOverride,
      photos,
    });

    res.json(kit);
  } catch (err) {
    console.error("social-kit error", err);
    res.status(500).json({ error: "Failed to build social kit" });
  }
});

// New content for a single platform (regen buttons)
app.post("/api/new-post", async (req, res) => {
  try {
    const platform = req.body?.platform;
    const pageUrl = normalizeUrl(req.body?.url);
    const label = req.body?.label || req.body?.labelOverride || "";
    const price = req.body?.price || req.body?.priceOverride || "";

    if (!platform || !pageUrl) {
      return res
        .status(400)
        .json({ error: "Missing platform or URL for new post." });
    }

    const pageInfo = await scrapePage(pageUrl);
    const { title, metaDesc, visibleText } = pageInfo;

    const system = `
You are Lot Rocket, an elite automotive copywriter.
Return ONLY the copy for the requested platform, no labels, no JSON, no explanation.
`.trim();

    const user = `
Dealer page:
TITLE: ${title}
META: ${metaDesc}
TEXT:
${visibleText.slice(0, 3000)}

Platform: ${platform}
Optional custom label: ${label || "none"}
Optional custom price: ${price || "none"}

Write ONE high-performing piece of content for this platform.
Include a call-to-action to DM or message the salesperson.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ text });
  } catch (err) {
    console.error("new-post error", err);
    res.status(500).json({ error: "Failed to regenerate post" });
  }
});

// New video script for selfie or idea
app.post("/api/new-script", async (req, res) => {
  try {
    const { kind, url, vehicle, hook, style, length } = req.body;

    let system;
    let user;

    if (kind === "selfie") {
      const pageUrl = normalizeUrl(url);
      if (!pageUrl) {
        return res.status(400).json({ error: "Invalid or missing URL for selfie script." });
      }

      const pageInfo = await scrapePage(pageUrl);
      const { title, metaDesc, visibleText } = pageInfo;

      system = `
You are Lot Rocket, an expert vertical video script writer for car salespeople.
Write natural sounding, selfie-style walkaround scripts.
`.trim();

      user = `
Dealer page:
TITLE: ${title}
META: ${metaDesc}
TEXT:
${visibleText.slice(0, 2500)}

Write a 30–60 second selfie video script the salesperson can record.
Use short, spoken lines and a clear CTA to DM or message.
Return plain text only.
`.trim();
    } else {
      // Creative Lab idea mode
      system = `
You are Lot Rocket, an expert short-form car video script writer.
Write scripts that feel natural for Reels / TikTok / Shorts.
`.trim();

      user = `
Vehicle / Offer: ${vehicle || "(not specified)"}
Hook (optional): ${hook || "none"}
Style: ${style || "hype"}
Length: about ${length || 30} seconds

Write:
- A grabber hook
- 3–6 short bullet points (spoken lines)
- A closing CTA inviting viewers to DM or message the salesperson

Return plain text only.
`.trim();
    }

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const script = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ script });
  } catch (err) {
    console.error("new-script error", err);
    res.status(500).json({ error: "Failed to create script" });
  }
});

// Shot plan from URL
app.post("/api/video-from-photos", async (req, res) => {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    if (!pageUrl) {
      return res.status(400).json({ error: "Invalid or missing URL" });
    }

    const pageInfo = await scrapePage(pageUrl);
    const photos = scrapeVehiclePhotosFromCheerio(pageInfo.$, pageUrl);

    const system = `
You are Lot Rocket, a video director for car salespeople.
You design shot lists / storyboards for short vertical videos.
`.trim();

    const user = `
Dealer page title: ${pageInfo.title}
Meta: ${pageInfo.metaDesc}

You have ${photos.length} exterior/interior still photos.
Create a shot plan for a 30–45 second vertical video that uses these photos
with text overlays and pacing notes.

Return plain text with bullet points or numbered steps.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const plan = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ plan });
  } catch (err) {
    console.error("video-from-photos error", err);
    res.status(500).json({ error: "Failed to generate shot plan" });
  }
});

// Canva-style layout idea
app.post("/api/design-idea", async (req, res) => {
  try {
    const { type, creativeType, headline, cta, vibe, label } = req.body;

    const system = `
You are Lot Rocket, a senior marketing designer.
You output clear bullet-point layout blueprints for Canva or similar tools.
`.trim();

    const user = `
Creative type: ${creativeType || type || "story / feed post"}
Vehicle / headline context: ${label || headline || "(you decide a strong one)"}
CTA: ${cta || "(you decide a strong one)"}
Brand vibe: ${vibe || "bold, trustworthy, premium"}

Describe:
- Overall layout (top / middle / bottom)
- Where the vehicle photo(s) should go
- Where headline & CTA sit
- Any supporting text or badges
- Suggested color / style notes

Return plain text in bullet format.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const idea = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ idea });
  } catch (err) {
    console.error("design-idea error", err);
    res.status(500).json({ error: "Failed to generate design idea" });
  }
});

// Objection Coach
app.post("/api/objection-coach", async (req, res) => {
  try {
    const { objection, history } = req.body;

    const system = `
You are Lot Rocket's Objection Coach, helping a car salesperson respond to customer objections.
Be empathetic, honest, and sales-savvy.
`.trim();

    const user = `
Conversation history (if any):
${history || "(none)"}

New customer objection:
${objection}

Write a suggested response the salesperson can send, plus 1–2 coaching tips in [brackets] at the end.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const answer = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ answer });
   } catch (err) {
    console.error("objection-coach error", err);
    res.status(500).json({
      error: "Failed to coach objection",
      detail: err.message || String(err),
    });
  }
});


// Payment Estimator (math only)
app.post("/api/payment-helper", (req, res) => {
  try {
    const price = Number(req.body.price || 0);
    const down = Number(req.body.down || 0);
    const rate = Number(req.body.rate || 0) / 100 / 12;
    const term = Number(req.body.term || 0);
    const taxRate = Number(req.body.tax || 0) / 100;

    if (!price || !term) {
      return res
        .status(400)
        .json({ error: "Price and term are required for payment." });
    }

    const taxedPrice = taxRate ? price * (1 + taxRate) : price;
    const amountFinanced = Math.max(taxedPrice - down, 0);

    let payment;
    if (!rate) {
      payment = amountFinanced / term;
    } else {
      payment =
        (amountFinanced * rate * Math.pow(1 + rate, term)) /
        (Math.pow(1 + rate, term) - 1);
    }

    const result = `~$${payment.toFixed(
      2
    )} per month (rough estimate only, not a binding quote).`;

    res.json({ result });
  } catch (err) {
    console.error("payment-helper error", err);
    res.status(500).json({ error: "Failed to estimate payment" });
  }
});

// Income Estimator (math only)
app.post("/api/income-helper", (req, res) => {
  try {
    const payment = Number(req.body.payment || 0);
    const dti = Number(req.body.dti || 0);

    if (!payment || !dti) {
      return res
        .status(400)
        .json({ error: "Payment and DTI are required for income." });
    }

    const incomeMonthly = payment / (dti / 100);
    const incomeYearly = incomeMonthly * 12;

    const result = `
To keep this payment at about ${dti}% of gross income,
the customer would need roughly:

- ~${incomeMonthly.toFixed(0)} per month
- ~${incomeYearly.toFixed(0)} per year

This is a very rough guideline, not financial advice.
`.trim();

    res.json({ result });
  } catch (err) {
    console.error("income-helper error", err);
    res.status(500).json({ error: "Failed to estimate income" });
  }
});

// Generic message helper (workflow, message, ask, car, image-brief, video-brief)
app.post("/api/message-helper", async (req, res) => {
  try {
    const {
      mode,
      prompt,
      type,
      goal,
      details,
      question,
      tone,
      channel,
    } = req.body;

    let system;
    let user;

    switch (mode) {
      case "workflow":
        system = `
You are Lot Rocket's Workflow Architect.
You design step-by-step workflows and playbooks for car salespeople.
Return clear numbered steps and optional templates.
`.trim();

        user = `
Situation:
${prompt || "(none)"}
`.trim();
        break;

      case "message":
        system = `
You are Lot Rocket's AI Message Builder.
Write ready-to-send messages for car shoppers via text, email, or social DM.
`.trim();

        user = `
Message type: ${type || "(not specified)"}
Goal: ${goal || "(not specified)"}
Details / context:
${details || "(none)"}

Tone: ${tone || "friendly, professional"}
Channel: ${channel || "text / DM"}
`.trim();
        break;

      case "ask":
        system = `
You are Lot Rocket, a helpful sales and business assistant for car salespeople.
Answer clearly and practically. Use examples where helpful.
`.trim();

        user = `
Question:
${question || prompt || "(none)"}
`.trim();
        break;

      case "car":
        system = `
You are Lot Rocket's automotive product expert.
Explain trims, features, comparisons, and recommendations like a pro salesperson.
Avoid made-up technical specs; keep it realistic.
`.trim();

        user = `
Car-related question:
${question || prompt || "(none)"}
`.trim();
        break;

      case "image-brief":
        system = `
You are Lot Rocket's image prompt helper.
You write detailed prompts for AI image generators to create car marketing images.
`.trim();

        user = `
Raw idea from user:
${prompt || "(none)"}

Write a single, detailed prompt suitable for an AI image generator
(e.g., composition, lighting, angle, style, background, mood).
`.trim();
        break;

      case "video-brief":
        system = `
You are Lot Rocket's video brief helper.
You write detailed briefs for AI video tools to create car marketing videos.
`.trim();

        user = `
Raw idea from user:
${prompt || "(none)"}

Write a detailed video brief: scenes, pacing, visual style, on-screen text,
and music/energy suggestions.
`.trim();
        break;

      default:
        system = `
You are Lot Rocket, a helpful assistant for car salespeople.
`.trim();

        user = `
Context:
${prompt || "(none)"}
`.trim();
    }

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ text });
  } catch (err) {
    console.error("message-helper error", err);
    res.status(500).json({
      error: "Failed to generate message",
      detail: err.message || String(err),
    });
  }
});

// ---------------- Start server ----------------

app.listen(port, () => {
  console.log(`Lot Rocket backend running on port ${port}`);
});
