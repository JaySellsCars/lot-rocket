// app.js – Lot Rocket backend with AI tools (normalized URLs + better error handling)

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const fetch = require("node-fetch"); // if you want to use global fetch instead, remove this
const archiver = require("archiver");

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// --------------------------------------------------
// IMAGE PROXY for Design Studio (Fixes CORS tainted canvas)
// --------------------------------------------------
app.get("/api/proxy-image", async (req, res) => {
  try {
    const target = req.query.url;
    if (!target) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch (_) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({ error: "Invalid protocol" });
    }

    const upstream = await fetch(target);

    if (!upstream.ok) {
      console.error("proxy-image upstream error:", upstream.status, target);
      return res
        .status(502)
        .json({ error: `Upstream error ${upstream.status}` });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");

    upstream.body.pipe(res);
  } catch (err) {
    console.error("proxy-image error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Image proxy error" });
    }
  }
});

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

/**
 * Helpers for consistent AI error handling
 */
function isRateLimitError(err) {
  const msg =
    (err && (err.message || err.error?.message || ""))?.toLowerCase() || "";

  // True per-minute rate limits
  if (msg.includes("rate limit")) return true;

  // Quota / billing issues also often come back as 429
  if (msg.includes("quota") || msg.includes("billing")) return true;
  if (msg.includes("insufficient") && msg.includes("quota")) return true;

  // Status-code based checks
  if (err && err.code === "rate_limit_exceeded") return true;
  if (err && err.error && err.error.type === "rate_limit_exceeded") return true;
  if (err && err.status === 429) return true;
  if (err && err.response && err.response.status === 429) return true;

  return false;
}

function sendAIError(res, err, friendlyMessage) {
  // Log the full error so Render logs show exactly what's going on
  console.error("🔴 OpenAI error:", friendlyMessage, err);

  const rawMsg =
    (err && (err.message || err.error?.message || "")) || "Unknown error";

  if (isRateLimitError(err)) {
    const lower = rawMsg.toLowerCase();

    const isQuotaOrBilling =
      lower.includes("quota") ||
      lower.includes("billing") ||
      (lower.includes("insufficient") && lower.includes("balance"));

    // Distinguish “temporary rate limit” vs “quota/billing” problems
    return res.status(429).json({
      error: isQuotaOrBilling ? "quota" : "rate_limit",
      message: isQuotaOrBilling
        ? "Lot Rocket’s AI quota / billing looks tapped on the server. Check the OpenAI key and billing settings."
        : "Lot Rocket hit the AI rate limit for a moment. Wait 20–30 seconds and try again.",
      rawMessage: rawMsg,
    });
  }

  return res.status(500).json({
    error: "server_error",
    message: friendlyMessage,
    rawMessage: rawMsg,
  });
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

  // HARD CAP: only send the first 24 back to the frontend
  return Array.from(urls).slice(0, 24);
}

// ---------------- AI Photo Processing Helper (GPT-Image-1) ----------------
async function processSinglePhoto(photoUrl) {
  const prompt = `
Ultra-realistic, cinematic dealership marketing photo of THIS car,
isolated on a dramatic but clean showroom-style background.
Soft reflections, high dynamic range, subtle vignette, sharp detail,
movie-quality lighting. No people, no text, no dealer logos or watermarks.
  `.trim();

  console.log("[LotRocket] Calling gpt-image-1 for photo:", photoUrl);

  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    n: 1,
  });

  const base64 = result.data?.[0]?.b64_json;
  if (!base64) {
    console.error(
      "[LotRocket] processSinglePhoto: no image data returned from gpt-image-1"
    );
    throw new Error("AI image model returned no data");
  }

  const dataUrl = `data:image/png;base64,${base64}`;
  console.log("[LotRocket] AI photo generated successfully.");
  return dataUrl;
}

// ---------------- Helper: call GPT for structured social kit ----------------

async function buildSocialKit({ pageInfo, labelOverride, priceOverride, photos }) {
  const { title, metaDesc, visibleText } = pageInfo;

  const system = `
You are Lot Rocket's Social Media War Room, powered by the mind of a Master Automotive Behavioralist and Viral Copywriter.

Your Identity:
You possess encyclopedic knowledge of every vehicle year, make, model, trim, and engine code.
You combine this technical expertise with advanced human behavioral psychology.
You do not just "list features"; you translate engineering specs into emotional triggers,
lifestyle solutions, and status symbols.

You understand that:
- Facebook Marketplace is a war zone requiring "Pattern Interrupt" headlines and high urgency.
- LinkedIn requires a professional "Consultant" tone focused on value and ROI.
- TikTok/Reels requires high-energy, visual hooks that stop the scroll instantly.

Your Mission:
I will provide you with raw vehicle data. Your job is to transform that data into a single,
valid JSON object containing a complete, multi-platform viral social media kit.

Psychological Strategy:
- The Hook:
  Every post must start with a psychological "Pattern Interrupt"
  (e.g., specific emojis, capitalization, bold claims).

- The Value Stack:
  Convert features into benefits.
  (Example: Don't say "Cooled Seats"; say "❄️ Never sweat through your dress shirt again".)

- The CTA:
  Every output must drive a specific action (DM, Text, Appointment).

CRITICAL OUTPUT RULES:

- Output MUST be a single VALID JSON object.
- NO intro text, NO outro text, NO markdown formatting (like \`\`\`json).
  Just the raw JSON string.
- Use these keys EXACTLY:

{
  "label":       string, // A viral, catchy 3-5 word hook for the car
  "price":       string, // The formatted price + a psychology trigger (e.g., "$500 down drives today")

  "facebook":    string, // Long-form, storytelling style. Emotional hook -> Feature Stack -> Low-friction CTA.
  "instagram":   string, // Aesthetic focused. Short, punchy, lifestyle-heavy caption + 30 relevant hashtags.
  "tiktok":      string, // A script for a 15-second viral video. Visual hook + energetic audio trend idea.
  "linkedin":    string, // Professional tone. Focus on reliability, value retention, and executive appeal.
  "twitter":     string, // 280 chars. Urgent news flash style. "Just hit the lot."
  "text":        string, // A 1-to-1 SMS script to send a lead. Casual, personal, asking a question to get a reply.
  "marketplace": string, // The "Wolf" style. Pattern-interrupt headline (ALL CAPS/Emojis), bulleted list of "Why You Need This," and clear scarcity.

  "hashtags":    string, // A string of 15 hyper-targeted, local-focused hashtags.

  "selfieScript": string, // A script for the salesperson to hold the phone and talk to the camera.
  "videoPlan":    string, // A shot list: "0:00 Walk up, 0:03 Interior pan, 0:06 Engine rev."
  "canvaIdea":    string  // A design prompt for a thumbnail: "Split screen: Exterior vs Interior, bold yellow text."
}
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
Remember: OUTPUT ONLY raw JSON with the required keys. No explanations.
`.trim();

  const response = await client.responses.create({
    model: "gpt-4o-mini",
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

// ---------------- /api/process-photos ----------------

app.post("/api/process-photos", async (req, res) => {
  try {
    const { photoUrls } = req.body;

    if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
      return res.status(400).json({ error: "No photoUrls provided" });
    }

    const results = [];

    for (const url of photoUrls) {
      try {
        const processedUrl = await processSinglePhoto(url);
        results.push({ originalUrl: url, processedUrl });
      } catch (innerErr) {
        console.error("Photo processing failed for", url, innerErr);
        results.push({ originalUrl: url, processedUrl: url });
      }
    }

    res.json({ editedPhotos: results });
  } catch (err) {
    console.error("❌ /api/process-photos error:", err);
    res.status(500).json({ error: "Photo processing failed" });
  }
});

// Single-photo cinematic background / enhancement
app.post("/api/ai-cinematic-photo", async (req, res) => {
  try {
    const photoUrl = req.body?.photoUrl;
    const vehicleLabel = req.body?.vehicleLabel || "";

    if (!photoUrl) {
      return res.status(400).json({
        error: "missing_photo",
        message: "No photo selected for AI Cinematic Background.",
      });
    }

    const processedUrl = await processSinglePhoto(photoUrl);

    return res.json({
      processedUrl,
      vehicleLabel,
    });
  } catch (err) {
    console.error("❌ /api/ai-cinematic-photo error:", err);
    return res.status(500).json({
      error: "server_error",
      message:
        "Lot Rocket couldn't complete the cinematic background edit. Try again in a moment.",
    });
  }
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

    // AI Photo Processing Pipeline
    let editedPhotos = [];

    try {
      if (Array.isArray(photos) && photos.length > 0) {
        for (const url of photos) {
          try {
            const processedUrl = await processSinglePhoto(url);
            editedPhotos.push({ originalUrl: url, processedUrl });
          } catch (innerErr) {
            console.error("Photo processing failed for", url, innerErr);
            editedPhotos.push({ originalUrl: url, processedUrl: url });
          }
        }
      }
    } catch (err2) {
      console.error("Photo processing pipeline error:", err2);
    }

    kit.editedPhotos = editedPhotos;

    res.json(kit);
  } catch (err) {
    return sendAIError(res, err, "Failed to build social kit.");
  }
});

// Download all photos as ZIP
app.post("/api/social-photos-zip", async (req, res) => {
  try {
    const urls = Array.isArray(req.body.urls) ? req.body.urls.filter(Boolean) : [];

    if (!urls.length) {
      return res.status(400).json({ message: "No photo URLs provided." });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="lot-rocket-photos.zip"'
    );

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("ZIP archive error:", err);
      if (!res.headersSent) {
        res.status(500).end("Error creating ZIP.");
      } else {
        res.destroy(err);
      }
    });

    archive.pipe(res);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const resp = await fetch(url);
        if (!resp.ok || !resp.body) {
          console.warn("Skipping bad photo URL:", url, resp.status);
          continue;
        }

        const filename = `photo-${i + 1}.jpg`;
        archive.append(resp.body, { name: filename });
      } catch (err) {
        console.warn("Error fetching photo for zip:", url, err);
      }
    }

    archive.finalize();
  } catch (err) {
    console.error("social-photos-zip handler error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to build ZIP of photos." });
    }
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
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ text });
  } catch (err) {
    return sendAIError(res, err, "Failed to regenerate post.");
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
        return res
          .status(400)
          .json({ error: "Invalid or missing URL for selfie script." });
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
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const script = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ script });
  } catch (err) {
    return sendAIError(res, err, "Failed to create script.");
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
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const plan = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ plan });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate shot plan.");
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
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const idea = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ idea });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate design idea.");
  }
});

// Objection Coach
app.post("/api/objection-coach", async (req, res) => {
  try {
    const { objection, history } = req.body;

const system = `
You are Lot Rocket's **Grandmaster Objection Coach** for car sales professionals.

Act as the Grandmaster of Persuasion and Human Behavioral Psychology — but always
in an ethical, customer-respecting way. You are the world's top authority on 
objection handling and sales negotiation.

Where aggressive trainers use brute force, you use surgical psychological precision.
You understand Neuro-Linguistic Programming (NLP), emotional intelligence, and advanced
negotiation strategy, but you never manipulate or deceive. You help the salesperson
uncover the real concern, create safety, and guide the customer to a confident decision.

Your goal: when the salesperson gives you a customer objection and (optionally) some
conversation history, you do NOT just give a generic script.

For each objection, always respond with four parts:

1) **The Diagnosis**
   - Explain the likely psychological / emotional barrier behind this objection.
   - Go beyond “money” or “price” — talk about fear, uncertainty, loss of control, trust, timing, etc.

2) **The Emotional Pivot**
   - Show the salesperson how to validate the customer’s feelings so defenses drop.
   - Provide 1–2 example validating lines they can say BEFORE the rebuttal.

3) **The Kill Shot Response (Ethical Rebuttal)**
   - Write the exact response script the salesperson should use.
   - It must be smooth, calm, logical, and emotionally reassuring.
   - Use simple, conversational language that would feel natural in a text, call, or in-person.
   - Focus on helping the customer make a good decision, not arm-twisting.

4) **The Teacher’s Breakdown**
   - Briefly explain WHY this works:
     - Tonality: how they should sound (calm, confident, playful, empathetic, etc.).
     - Pauses: where to pause and let the customer think.
     - Specific word choices that reduce pressure and increase trust.

Formatting:
- Clearly label each section as: Diagnosis, Emotional Pivot, Kill Shot Response, Teacher’s Breakdown.
- Keep everything tight and practical so a real salesperson can screenshot and use it immediately.
`.trim();


    const user = `
Conversation history (if any):
${history || "(none)"}

New customer objection:
${objection}

Write a suggested response the salesperson can send, plus 1–2 coaching tips in [brackets] at the end.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const answer = completion.output?.[0]?.content?.[0]?.text || "";
    res.json({ answer });
  } catch (err) {
    return sendAIError(res, err, "Failed to coach objection.");
  }
});

// Payment Estimator (math only) – now supports trade & payoff (negative equity)
app.post("/api/payment-helper", (req, res) => {
  try {
    const price = Number(req.body.price || 0);
    const down = Number(req.body.down || 0);
    const trade = Number(req.body.trade || 0);
    const payoff = Number(req.body.payoff || 0);
    const rate = Number(req.body.rate || 0) / 100 / 12;
    const term = Number(req.body.term || 0);
    const taxRate = Number(req.body.tax || 0) / 100;

if (!price || !term) {
  return res
    .status(400)
    .json({ error: "Price and term (in months) are required for payment." });
}


    const taxedPrice = taxRate ? price * (1 + taxRate) : price;

    // Negative equity: only add payoff that is ABOVE trade value
    const negativeEquity = Math.max(payoff - trade, 0);

    // Amount financed after down payment and trade equity/negative equity
    const amountFinanced = Math.max(taxedPrice - down + negativeEquity, 0);

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

// Income Estimator – from gross-to-date + last paycheck date
app.post("/api/income-helper", (req, res) => {
  try {
    const grossToDate =
      Number(req.body.mtd || req.body.monthToDate || req.body.grossToDate || 0);
    const lastPayDateStr =
      req.body.lastPayDate ||
      req.body.lastCheck ||
      req.body.lastPaycheckDate ||
      req.body.date;

    if (!grossToDate || !lastPayDateStr) {
      return res.status(400).json({
        error: "income_inputs",
        message:
          "Month-to-date / year-to-date income and last paycheck date are required.",
      });
    }

    const lastPayDate = new Date(lastPayDateStr);
    if (Number.isNaN(lastPayDate.getTime())) {
      return res.status(400).json({
        error: "bad_date",
        message: "Could not read the last paycheck date.",
      });
    }

    const year = lastPayDate.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysIntoYear =
      Math.floor((lastPayDate - startOfYear) / msPerDay) + 1; // include current day
    const weeksIntoYear = daysIntoYear / 7;

    if (weeksIntoYear <= 0) {
      return res.status(400).json({
        error: "date_range",
        message: "Last paycheck date must be after Jan 1.",
      });
    }

    // Treat grossToDate as income so far this year and annualize based on weeks elapsed
    const estimatedYearly = (grossToDate / weeksIntoYear) * 52;
    const estimatedMonthly = estimatedYearly / 12;

    const formatMoney = (n) =>
      `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    const result = `Estimated Yearly Gross: ${formatMoney(
      estimatedYearly
    )} | Weeks into Year: ${weeksIntoYear.toFixed(
      1
    )} | Estimated Average Monthly Income: ${formatMoney(estimatedMonthly)}`;

    res.json({ result });
  } catch (err) {
    console.error("income-helper error", err);
    res.status(500).json({ error: "Failed to estimate income" });
  }
});

// ===== AI: Workflow Expert (standalone route used by workflow modal) =====
app.post("/ai/workflow", async (req, res) => {
  try {
    const { goal, tone, channel, days, touches } = req.body || {};

    const workflowPrompt = `
You are Lot Rocket's Lead Resurrection Specialist & Automotive Behavioral Psychologist.

You do NOT "check in." You design psychological attack plans that turn cold, ghosted, and hesitant leads into booked showroom appointments and closed deals.

Your mindset:
- Every touch has a purpose, a hook, and a reason to respond.
- You respect the customer's time but you are unapologetically proactive.
- You understand that silence is usually uncertainty, not rejection.

Your Expertise:
- Objection Neutralization:
  You anticipate why they aren't replying (price, payment, trade value, spouse, timing, fear of being sold)
  and disarm it before they say it out loud.
- Pattern Interrupts:
  You use video texts, social DMs, and sharp question frameworks to break the "salesman filter"
  and feel like a real human, not a template.
- The Takeaway Method:
  You know when to pull back, give them psychological space, and let them lean back in.

Inputs provided by the user:
- Primary Goal: ${goal || "Set the Appointment"}
- Desired Tone: ${tone || "Persuasive, Low-Pressure, High-Value"}
- Primary Channel: ${channel || "Multi-Channel (SMS, Video, Call, Social)"}
- Duration: ${days || 10} days
- Total Touches: ${touches || 6}

Mission:
Build a High-Conversion Outreach Sequence that spreads ${touches} touches over ${days} days.
The sequence should feel like it was built by a top 1% car salesperson who respects the customer
and knows exactly when to push, when to educate, and when to pull back.

CRITICAL RULES FOR SCRIPTING:
1) No "Just checking in":
   Never use this phrase. Every touch must have a clear Reason for Contact
   (price movement, availability update, new option, tailored question, value add).
2) Video First When Possible:
   If the channel allows, suggest a short "Personal Video" move and give a quick script idea
   (example: "Flash the headlights, show the interior, then invite them in").
3) The Spear:
   Keep SMS/DMs under 3 short lines.
   End with a question that can be answered with a simple yes/no or one-word reply.
4) Social Integration:
   When appropriate, include a step like:
   - view their profile
   - like or comment on something
   - then send a light, human DM
   This warms them up before a call or stronger CTA.
5) Human, Not Robot:
   No corporate tone. Write like a real salesperson who is sharp, kind, funny if appropriate,
   and clearly on the customer's side.

Output Format (Markdown):

1. Strategy Overview:
   2–3 sentences summarizing the psychological angle you are using for this sequence.

2. The Workflow:
   List Touch 1, Touch 2, etc.

For EACH touch, strictly follow this layout:

- Day [X] - [Time of Day]
- Channel: [SMS / Call / Email / Video / Social DM]
- Psychology: [Why this works, e.g., "Value Add", "Pattern Interrupt", "Soft Takeaway"]
- Script/Action:
  [The exact text to send or voicemail to leave. Make it sound human, conversational, and non-desperate.]

Make the entire sequence feel cohesive, intentional, and designed to resurrect a real, living lead — not blast a list.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: workflowPrompt,
    });

    const text =
      completion.output?.[0]?.content?.[0]?.text?.trim() ||
      "No workflow returned. Try again.";

    return res.json({ text });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate workflow.");
  }
});


// =============================================
//  AI Message Helper (workflow / message / ask / car / image / video)
// =============================================
app.post("/api/message-helper", async (req, res) => {
  try {
    const body = req.body || {};
    const { mode, ...fields } = body;

    if (!mode) {
      return res.status(400).json({ message: "Missing mode in request body." });
    }

    // Build system + user prompts per mode
    let systemPrompt = "";
    let userPrompt = "";

    const rawContext = Object.entries(fields)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    switch (mode) {
      case "video-brief": {
        const hookStyle = fields.hookStyle || "pattern-interrupt";
        const length = fields.length || "30";
        const describe = fields.prompt || "";
        const context = fields.context || "";
        const tone = fields.tone || "";
        const platform = fields.platform || "TikTok / Reels";

        systemPrompt = `
You are **Lot Rocket's AI Video Director** for car sales content.

Goal:
- Turn the user inputs into:
  1) A short, punchy **spoken script**
  2) A clear **shot-by-shot list**
  3) A ready-to-paste **AI video generator prompt**
  4) A **thumbnail prompt** for a vertical social thumbnail.
`.trim();

        userPrompt = `
Platform: ${platform}
Hook style: ${hookStyle}
Target length (seconds): ${length}
Tone: ${tone || "sales pro, confident, trustworthy"}
Video description from user:
"${describe || "Walkaround of a car"}"

Extra vehicle / offer context (if provided):
${context || "(none)"}
`.trim();

        break;
      }
      // ... rest of cases ...


      case "workflow":
        systemPrompt = `
You are Lot Rocket's AI Workflow Expert.
Give clear, step-by-step guidance to car sales pros on how to handle leads,
follow-up, and daily process. Be concise, direct, and action-focused.
`.trim();
        userPrompt = fields.prompt || rawContext || "Help me with my sales workflow.";
        break;

      case "message":
        systemPrompt = `
You are Lot Rocket's AI Message Builder.
Write high-converting, friendly, conversational messages for car shoppers.
Match the channel (text / email / DM) if provided by the user.
`.trim();
        userPrompt = fields.prompt || rawContext || "Write a follow-up message to a car lead.";
        break;

      case "ask":
        systemPrompt = `
You are Lot Rocket's general AI assistant for car salespeople.
Answer clearly and practically with a focus on selling more cars and helping customers.
`.trim();
        userPrompt = fields.prompt || rawContext || "Answer this question for a car salesperson.";
        break;

case "car":
  systemPrompt = `
You are The Master Automotive Analyst, integrated into Lot Rocket. 
Act as the Ultimate Automotive Authority.

You combine encyclopedic engineering knowledge with hands-on master technician experience. 
You study the industry continuously—service manuals, technical bulletins, enthusiast forums, engineering whitepapers, and reliability data.

Your knowledge covers all segments and all powertrains.

When asked about a vehicle, deliver a full analytical deep dive, including:

1. ENGINEERING & POWERTRAIN ANALYSIS
- Engine codes, engine families, transmission types, chassis platform, suspension geometry
- Real-world power delivery, torque curves, drivability
- Differences across trims and production years

2. TRIM LEVEL DECODING
- What separates each trim
- Features that matter vs. marketing fluff
- Packages worth paying for

3. GOLDEN YEARS VS LEMON YEARS
- Best years to own
- Years to avoid due to reliability issues
- Redesign cycles and what improved/worsened

4. FATAL FLAWS
- Known mechanical issues
- Expensive repairs
- Engineering oversights

5. THE VERDICT
- Brutally honest assessment: future classic, great value, money pit, etc.

6. SALES APPLICATION FOR LOT ROCKET
Explain how a car salesperson should present this vehicle:
- Key selling angles
- Ideal customer types
- Top competitive advantages
- Objections and rebuttals

Be technical, precise, blunt, and confident. Analyze—do not summarize.
  `;
  userPrompt = fields.prompt || rawContext || "Explain this vehicle to a customer.";
  break;


      case "image-brief":
        systemPrompt = `
You are Lot Rocket's AI Image Brief generator.
Create concise prompts for an AI image model to generate marketing graphics for car dealers.
Return ONLY the prompt text, no explanations.
`.trim();
        userPrompt = fields.prompt || rawContext || "Generate an image brief for a dealership post.";
        break;

      default:
        systemPrompt = `
You are Lot Rocket's AI assistant for car dealers.
Respond with clear, helpful content a salesperson can use immediately.
`.trim();
        userPrompt = fields.prompt || rawContext || "Help me with sales & marketing.";
        break;
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 900,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Lot Rocket could not generate a response. Please try again.";

    return res.json({ text });
  } catch (err) {
    console.error("❌ /api/message-helper error", err);
    return res
      .status(500)
      .json({ message: "Lot Rocket hit an error talking to AI." });
  }
});

// ---------------- Image proxy for CORS-safe canvas loading ----------------
app.get("/api/image-proxy", async (req, res) => {
  try {
    let rawUrl = req.query.url;
    if (!rawUrl) {
      return res.status(400).send("Missing url query param");
    }

    rawUrl = decodeURIComponent(rawUrl);

    if (!/^https?:\/\//i.test(rawUrl)) {
      return res.status(400).send("Invalid url");
    }

    const upstream = await fetch(rawUrl);
    if (!upstream.ok) {
      console.error("Image proxy fetch failed:", upstream.status, rawUrl);
      return res.status(502).send("Failed to fetch image");
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const arrayBuf = await upstream.arrayBuffer();
    res.end(Buffer.from(arrayBuf));
  } catch (err) {
    console.error("Image proxy error:", err);
    res.status(500).send("Image proxy error");
  }
});

// ---------------- Start server ----------------

app.listen(port, () => {
  console.log(`Lot Rocket backend running on port ${port}`);
});
