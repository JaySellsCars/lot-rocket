// app.js – Lot Rocket backend with AI tools

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const fetch = require("node-fetch");

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

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

    // crude filter
    const lower = src.toLowerCase();
    if (
      lower.includes("logo") ||
      lower.includes("icon") ||
      lower.includes("sprite") ||
      lower.endsWith(".svg")
    ) {
      return;
    }

    // make absolute
    try {
      const abs = new URL(src, base).href;
      urls.add(abs);
    } catch (e) {
      // ignore bad urls
    }
  });

  return Array.from(urls);
}

// ---------------- Helper: call GPT for structured social kit ----------------

async function buildSocialKit({
  pageInfo,
  labelOverride,
  priceOverride,
  photos,
}) {
  const { title, metaDesc, visibleText } = pageInfo;

  const system = `
You are Lot Rocket, an elite automotive social media copywriter for car salespeople.
You must produce high-converting content for multiple platforms.
Return JSON only, no extra text.
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
Create persuasive, trustworthy, and high-energy copy.
Include emojis where appropriate but don't overdo it.
  `.trim();

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: system,
      },
      {
        role: "user",
        content: user,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "lot_rocket_social_kit",
        schema: {
          type: "object",
          properties: {
            label: { type: "string" },
            price: { type: "string" },
            facebook: { type: "string" },
            instagram: { type: "string" },
            tiktok: { type: "string" },
            linkedin: { type: "string" },
            twitter: { type: "string" },
            text: { type: "string" },
            marketplace: { type: "string" },
            hashtags: { type: "string" },
            selfieScript: { type: "string" },
            videoPlan: { type: "string" },
            canvaIdea: { type: "string" },
          },
          required: [
            "label",
            "price",
            "facebook",
            "instagram",
            "tiktok",
            "linkedin",
            "twitter",
            "text",
            "marketplace",
            "hashtags",
            "selfieScript",
            "videoPlan",
            "canvaIdea",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const toolContent = response.output[0]?.content[0]?.json || {};
  const kit = toolContent || {};

  // Prefer overrides if present
  if (labelOverride) kit.label = labelOverride;
  if (priceOverride) kit.price = priceOverride;

  // attach photos we scraped
  kit.photos = photos || [];

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
    const { url, labelOverride, priceOverride } = req.body;
    if (!url) return res.status(400).json({ error: "Missing URL" });

    const pageInfo = await scrapePage(url);
    const photos = scrapeVehiclePhotosFromCheerio(pageInfo.$, url);

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

// New content for a single platform
app.post("/api/new-post", async (req, res) => {
  try {
    const { url, platform, labelOverride, priceOverride } = req.body;
    if (!url || !platform) {
      return res.status(400).json({ error: "Missing url or platform" });
    }

    const pageInfo = await scrapePage(url);
    const { title, metaDesc, visibleText } = pageInfo;

    const system = `
You are Lot Rocket, an elite automotive copywriter.
Return ONLY the copy for the requested platform, no labels, no JSON.
  `.trim();

    const user = `
Dealer page:
TITLE: ${title}
META: ${metaDesc}
TEXT:
${visibleText.slice(0, 3000)}

Platform: ${platform}
Optional custom label: ${labelOverride || "none"}
Optional custom price: ${priceOverride || "none"}

Write a single best-performing piece of content for this platform.
Include call-to-action to DM or message the salesperson.
    `.trim();

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = completion.output[0]?.content[0]?.text || "";
    res.json({ content });
  } catch (err) {
    console.error("new-post error", err);
    res.status(500).json({ error: "Failed to regenerate post" });
  }
});

// New video script for Creative Lab quick video
app.post("/api/new-script", async (req, res) => {
  try {
    const { vehicle, hook, aspect, style, length } = req.body;

    const system = `
You are Lot Rocket, an expert short-form car video script writer.
Write scripts that feel natural for Reels / TikTok / Shorts.
  `.trim();

    const user = `
Vehicle / Offer: ${vehicle}
Hook (optional): ${hook || "none"}
Aspect: ${aspect || "9:16"}
Style: ${style || "hype"}
Length: about ${length || 30} seconds

Write:
- A hook line
- 3–6 short bullet points (spoken lines)
- A closing CTA that invites viewers to DM or message the salesperson
Return plain text only.
  `.trim();

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const script = completion.output[0]?.content[0]?.text || "";
    res.json({ script });
  } catch (err) {
    console.error("new-script error", err);
    res.status(500).json({ error: "Failed to create script" });
  }
});

// Canva-style layout idea
app.post("/api/design-idea", async (req, res) => {
  try {
    const { creativeType, headline, cta, vibe } = req.body;

    const system = `
You are Lot Rocket, a senior marketing designer.
You output clear bullet-point layout blueprints for Canva or similar tools.
  `.trim();

    const user = `
Creative type: ${creativeType}
Headline: ${headline || "(you decide a strong one)"}
CTA: ${cta || "(you decide a strong one)"}
Brand vibe: ${vibe || "bold, trustworthy"}

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

    const idea = completion.output[0]?.content[0]?.text || "";
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

Write a suggested response the salesperson can send, plus 1-2 coaching tips in brackets.
  `.trim();

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const reply = completion.output[0]?.content[0]?.text || "";
    res.json({ reply });
  } catch (err) {
    console.error("objection-coach error", err);
    res.status(500).json({ error: "Failed to coach objection" });
  }
});

// Payment Estimator (math, no AI needed)
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

// Income Estimator (math, no AI needed)
app.post("/api/income-helper", (req, res) => {
  try {
    const payment = Number(req.body.payment || 0);
    const dti = Number(req.body.dti || 0); // percent of income

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

// Message Helper: workflow, message, ask, car
app.post("/api/message-helper", async (req, res) => {
  try {
    const { mode, context, tone, channel } = req.body;

    let system;
    switch (mode) {
      case "workflow":
        system = `
You are Lot Rocket's Workflow Architect.
You design step-by-step workflows and playbooks for car salespeople.
Return clear numbered steps and optional templates.
        `.trim();
        break;
      case "message":
        system = `
You are Lot Rocket's AI Message Builder.
Write ready-to-send messages for car shoppers via text, email, or social DM.
        `.trim();
        break;
      case "ask":
        system = `
You are Lot Rocket, a helpful sales and business assistant.
Answer clearly and practically. Use examples where helpful.
        `.trim();
        break;
      case "car":
        system = `
You are Lot Rocket's automotive product expert.
Explain trims, features, comparisons, and recommendations like a pro salesperson.
Avoid made-up technical specs; keep it realistic.
        `.trim();
        break;
      default:
        system = `
You are Lot Rocket, a helpful assistant for car salespeople.
        `.trim();
    }

    const extra = [];
    if (tone) extra.push(`Tone: ${tone}`);
    if (channel) extra.push(`Channel: ${channel}`);

    const user = `
Context / Question:
${context || "(none)"}

${extra.join("\n")}
    `.trim();

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const result = completion.output[0]?.content[0]?.text || "";
    res.json({ result });
  } catch (err) {
    console.error("message-helper error", err);
    res.status(500).json({ error: "Failed to generate message" });
  }
});

// ---------------- Start server ----------------

app.listen(port, () => {
  console.log(`Lot Rocket backend running on port ${port}`);
});
