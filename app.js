// app.js – Lot Rocket backend with AI tools (fixed URL handling)

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cheerio = require("cheerio");
const OpenAI = require("openai");

// Use Node's built-in fetch if available; fall back to node-fetch dynamically
const fetchFn =
  global.fetch ||
  ((...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args)));

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
 * Normalize whatever the frontend sends into a real absolute URL
 * - trims
 * - adds https:// if user pasted without protocol
 * - returns null if still invalid
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
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") || "";

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

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Full social kit from dealer URL
app.post("/api/social-kit", async (req, res) => {
  try {
    const rawUrl = req.body?.url;
    const pageUrl = normalizeUrl(rawUrl);

    if (!pageUrl) {
      return res.status(400).json({ error: "Invalid or missing URL" });
    }

    console.log("social-kit for URL:", pageUrl);

    const pageInfo = await scrapePage(pageUrl);
    const photos = scrapeVehiclePhotosFromCheerio(pageInfo.$, pageUrl);

    const kit = await buildSocialKit({
      pageInfo,
      labelOverride: req.body.labelOverride,
      priceOverride: req.body.priceOverride,
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
    const { url, platform, label, price, labelOverride, priceOverride } = req.body;
    const pageUrl = normalizeUrl(url);

    if (!pageUrl || !platform) {
      return res.status(400).json({ error: "Missing or invalid url or platform" });
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
Optional custom label: ${label || labelOverride || "none"}
Optional custom price: ${price || priceOverride || "none"}

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

// New video script
app.post("/api/new-script", async (req, res) => {
  try {
    const { kind, url, vehicle, hook, style, length } = req.body;

    let system;
    let user;

    if (kind === "selfie" && url) {
      const pageUrl = normalizeUrl(url);
      if (!pageUrl) {
        return res.status(400).json({ error: "Invalid URL for selfie script" });
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

// Shot plan using photos
app.post("/api/video-from-photos", async (req, res) => {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    if (!pageUrl) return res.status(400).json({ error: "Invalid url" });

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
    res.status(500).json({ error: "Failed to coach objection" });
  }
});

// Payment & income helpers stay as you had them
// (I won’t rewrite here for length – your existing versions are fine)

// Message Helper (workflow, message, ask, car, image-brief, video-brief)
// ... keep your existing implementation here unchanged ...

// ---------------- Start server ----------------

app.listen(port, () => {
  console.log(`Lot Rocket backend running on port ${port}`);
});
