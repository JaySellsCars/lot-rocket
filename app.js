// app.js — Lot Rocket backend (CLEANED + ORGANIZED)
// Purpose: scrape dealer page, generate social kit, process images, calculators, AI helper tools.

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const fetch = require("node-fetch"); // keep for Node 22 compatibility + consistency
const archiver = require("archiver");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------
// OpenAI Client
// -------------------------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -------------------------
// Middleware
// -------------------------
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// -------------------------
// Utilities
// -------------------------

/**
 * Normalize whatever the user pasted into a real absolute URL.
 * - adds https:// if missing
 * - returns null if invalid
 */
function normalizeUrl(raw) {
  if (!raw) return null;
  let url = String(raw).trim();
  if (!url) return null;

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
 * fetch with timeout (prevents hanging Render requests)
 */
async function fetchWithTimeout(url, ms = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * OpenAI error helpers (better logs + friendly error payload)
 */
function isRateLimitError(err) {
  const msg =
    (err && (err.message || err.error?.message || ""))?.toLowerCase() || "";

  if (msg.includes("rate limit")) return true;
  if (msg.includes("quota") || msg.includes("billing")) return true;
  if (msg.includes("insufficient") && msg.includes("quota")) return true;

  if (err && err.code === "rate_limit_exceeded") return true;
  if (err && err.error && err.error.type === "rate_limit_exceeded") return true;
  if (err && err.status === 429) return true;
  if (err && err.response && err.response.status === 429) return true;

  return false;
}

function sendAIError(res, err, friendlyMessage) {
  console.error("🔴 OpenAI error:", friendlyMessage, err);

  const rawMsg =
    (err && (err.message || err.error?.message || "")) || "Unknown error";

  if (isRateLimitError(err)) {
    const lower = rawMsg.toLowerCase();

    const isQuotaOrBilling =
      lower.includes("quota") ||
      lower.includes("billing") ||
      (lower.includes("insufficient") && lower.includes("balance"));

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

/**
 * One helper to call Responses API and return plain text.
 * Keeps your backend consistent.
 */
async function aiText({ system, user, model = "gpt-4o-mini", temperature }) {
  const input = [];
  if (system) input.push({ role: "system", content: system });
  if (user) input.push({ role: "user", content: user });

  const resp = await client.responses.create({
    model,
    input,
    ...(typeof temperature === "number" ? { temperature } : {}),
  });

  return resp.output?.[0]?.content?.[0]?.text || "";
}

// -------------------------
// Scraping Helpers
// -------------------------

async function scrapePage(url) {
  const res = await fetchWithTimeout(url, 15000);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

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

  return { title, metaDesc, visibleText, $, html };
}

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

  return Array.from(urls).slice(0, 24);
}

// -------------------------
// AI: Photo Processing (gpt-image-1)
// -------------------------
async function processSinglePhoto(photoUrl) {
  const prompt = `
Ultra-realistic, cinematic dealership marketing photo of THIS car,
isolated on a dramatic but clean showroom-style background.
Soft reflections, high dynamic range, subtle vignette, sharp detail,
movie-quality lighting. No people, no text, no dealer logos or watermarks.
  `.trim();

  console.log("[LotRocket] gpt-image-1 photo:", photoUrl);

  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    n: 1,
  });

  const base64 = result.data?.[0]?.b64_json;
  if (!base64) {
    console.error("[LotRocket] gpt-image-1 returned no image data");
    throw new Error("AI image model returned no data");
  }

  return `data:image/png;base64,${base64}`;
}

// -------------------------
// AI: Social Kit (JSON)
// -------------------------
async function buildSocialKit({ pageInfo, labelOverride, priceOverride, photos }) {
  const { title, metaDesc, visibleText } = pageInfo;

  const system = `
You are Lot Rocket's Social Media War Room, powered by the mind of a Master Automotive Behavioralist and Viral Copywriter.

CRITICAL OUTPUT RULES:
- Output MUST be a single VALID JSON object.
- NO intro text, NO outro text, NO markdown formatting.
- Use these keys EXACTLY:

{
  "label":       string,
  "price":       string,
  "facebook":    string,
  "instagram":   string,
  "tiktok":      string,
  "linkedin":    string,
  "twitter":     string,
  "text":        string,
  "marketplace": string,
  "hashtags":    string,
  "selfieScript": string,
  "videoPlan":    string,
  "canvaIdea":    string
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
Remember: OUTPUT ONLY raw JSON with the required keys.
`.trim();

  const raw = await aiText({ system, user, model: "gpt-4o-mini" });

  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("❌ Social kit JSON parse failed:", e, raw.slice(0, 250));
  }

  return {
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
}

// ======================================================
// ROUTES
// ======================================================

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --------------------------------------------------
// IMAGE PROXY (CORS-safe for canvas loading)
// Keep ONE canonical route, then alias the old one.
// --------------------------------------------------
async function handleImageProxy(req, res) {
  try {
    const target = req.query.url;
    if (!target) return res.status(400).json({ error: "Missing url parameter" });

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({ error: "Invalid protocol" });
    }

    const upstream = await fetchWithTimeout(target, 15000);

    if (!upstream.ok) {
      console.error("proxy-image upstream error:", upstream.status, target);
      return res.status(502).json({ error: `Upstream error ${upstream.status}` });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // stream if possible
    if (upstream.body && typeof upstream.body.pipe === "function") {
      return upstream.body.pipe(res);
    }

    const buf = await upstream.arrayBuffer();
    return res.end(Buffer.from(buf));
  } catch (err) {
    console.error("proxy-image error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Image proxy error" });
  }
}

app.get("/api/proxy-image", handleImageProxy);
// alias (older frontend code sometimes uses this)
app.get("/api/image-proxy", handleImageProxy);

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
        results.push({ originalUrl: url, processedUrl: url }); // fallback
      }
    }

    return res.json({ editedPhotos: results });
  } catch (err) {
    console.error("❌ /api/process-photos error:", err);
    return res.status(500).json({ error: "Photo processing failed" });
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

    return res.json({ processedUrl, vehicleLabel });
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

    // Optional: AI Photo Processing Pipeline
    const editedPhotos = [];
    if (Array.isArray(photos) && photos.length) {
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

    kit.editedPhotos = editedPhotos;

    return res.json(kit);
  } catch (err) {
    return sendAIError(res, err, "Failed to build social kit.");
  }
});

// Download all photos as ZIP
app.post("/api/social-photos-zip", async (req, res) => {
  try {
    const urls = Array.isArray(req.body.urls) ? req.body.urls.filter(Boolean) : [];
    if (!urls.length) return res.status(400).json({ message: "No photo URLs provided." });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="lot-rocket-photos.zip"');

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("ZIP archive error:", err);
      if (!res.headersSent) res.status(500).end("Error creating ZIP.");
      else res.destroy(err);
    });

    archive.pipe(res);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const resp = await fetchWithTimeout(url, 15000);
        if (!resp.ok || !resp.body) {
          console.warn("Skipping bad photo URL:", url, resp.status);
          continue;
        }
        archive.append(resp.body, { name: `photo-${i + 1}.jpg` });
      } catch (err) {
        console.warn("Error fetching photo for zip:", url, err);
      }
    }

    archive.finalize();
  } catch (err) {
    console.error("social-photos-zip handler error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to build ZIP of photos." });
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
      return res.status(400).json({ error: "Missing platform or URL for new post." });
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

    const text = await aiText({ system, user, model: "gpt-4o-mini" });
    return res.json({ text });
  } catch (err) {
    return sendAIError(res, err, "Failed to regenerate post.");
  }
});

// New video script (selfie or generic idea)
app.post("/api/new-script", async (req, res) => {
  try {
    const { kind, url, vehicle, hook, style, length } = req.body || {};

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

    const script = await aiText({ system, user, model: "gpt-4o-mini" });
    return res.json({ script });
  } catch (err) {
    return sendAIError(res, err, "Failed to create script.");
  }
});

// Shot plan from URL
app.post("/api/video-from-photos", async (req, res) => {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    if (!pageUrl) return res.status(400).json({ error: "Invalid or missing URL" });

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

    const plan = await aiText({ system, user, model: "gpt-4o-mini" });
    return res.json({ plan });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate shot plan.");
  }
});

// Canva-style layout idea
app.post("/api/design-idea", async (req, res) => {
  try {
    const { type, creativeType, headline, cta, vibe, label } = req.body || {};

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

    const idea = await aiText({ system, user, model: "gpt-4o-mini" });
    return res.json({ idea });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate design idea.");
  }
});

// Objection Coach
app.post("/api/objection-coach", async (req, res) => {
  try {
    const { objection, history } = req.body || {};

    const system = `
You are Lot Rocket's Grandmaster Objection Coach for car sales professionals.

For each objection, respond with four parts:
1) Diagnosis
2) Emotional Pivot
3) Kill Shot Response (ethical)
4) Teacher’s Breakdown

Formatting:
- Clearly label each section as: Diagnosis, Emotional Pivot, Kill Shot Response, Teacher’s Breakdown.
- Tight, practical, screenshot-friendly.
`.trim();

    const user = `
Conversation history (if any):
${history || "(none)"}

New customer objection:
${objection || "(none provided)"}
`.trim();

    const answer = await aiText({ system, user, model: "gpt-4o-mini" });
    return res.json({ answer });
  } catch (err) {
    return sendAIError(res, err, "Failed to coach objection.");
  }
});

// Payment Estimator (math only) — supports trade & payoff (negative equity)
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

    // Negative equity: only add payoff above trade value
    const negativeEquity = Math.max(payoff - trade, 0);

    // Amount financed after down payment + negative equity
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

    return res.json({ result });
  } catch (err) {
    console.error("payment-helper error", err);
    return res.status(500).json({ error: "Failed to estimate payment" });
  }
});

// Income Estimator — from gross-to-date + last paycheck date
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

    const daysIntoYear = Math.floor((lastPayDate - startOfYear) / msPerDay) + 1;
    const weeksIntoYear = daysIntoYear / 7;

    if (weeksIntoYear <= 0) {
      return res.status(400).json({
        error: "date_range",
        message: "Last paycheck date must be after Jan 1.",
      });
    }

    const estimatedYearly = (grossToDate / weeksIntoYear) * 52;
    const estimatedMonthly = estimatedYearly / 12;

    const formatMoney = (n) =>
      `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    const result = `Estimated Yearly Gross: ${formatMoney(
      estimatedYearly
    )} | Weeks into Year: ${weeksIntoYear.toFixed(
      1
    )} | Estimated Average Monthly Income: ${formatMoney(estimatedMonthly)}`;

    return res.json({ result });
  } catch (err) {
    console.error("income-helper error", err);
    return res.status(500).json({ error: "Failed to estimate income" });
  }
});

// ===== AI: Workflow Expert =====
// NOTE: keeping your existing path AND adding an /api alias for safety.
async function handleWorkflow(req, res) {
  try {
    const { goal, tone, channel, days, touches } = req.body || {};

    const workflowPrompt = `
You are Lot Rocket's Lead Resurrection Specialist & Automotive Behavioral Psychologist.

Build a High-Conversion Outreach Sequence that spreads ${touches || 6} touches over ${
      days || 10
    } days.

Inputs:
- Primary Goal: ${goal || "Set the Appointment"}
- Desired Tone: ${tone || "Persuasive, Low-Pressure, High-Value"}
- Primary Channel: ${channel || "Multi-Channel (SMS, Video, Call, Social)"}
- Duration: ${days || 10} days
- Total Touches: ${touches || 6}

Rules:
1) Never say "Just checking in".
2) Keep SMS/DMs under 3 short lines. End with a question.
3) Human, not robot.

Output Format (Markdown):
1) Strategy Overview (2–3 sentences)
2) Touch 1, Touch 2, ... with:
- Day [X] - [Time of Day]
- Channel
- Psychology
- Script/Action
`.trim();

    const text = await aiText({ system: "", user: workflowPrompt, model: "gpt-4o-mini" });

    return res.json({
      text: (text || "").trim() || "No workflow returned. Try again.",
    });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate workflow.");
  }
}

app.post("/ai/workflow", handleWorkflow);
app.post("/api/workflow", handleWorkflow);

// =============================================
//  AI Message Helper (workflow / message / ask / car / image-brief / video-brief)
// =============================================
app.post("/api/message-helper", async (req, res) => {
  try {
    const body = req.body || {};
    const { mode, ...fields } = body;

    if (!mode) {
      return res.status(400).json({ message: "Missing mode in request body." });
    }

    const rawContext = Object.entries(fields)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    let systemPrompt = "";
    let userPrompt = "";

    switch (mode) {
      case "video-brief": {
        const hookStyle = fields.hookStyle || "pattern-interrupt";
        const length = fields.length || "30";
        const describe = fields.prompt || "";
        const context = fields.context || "";
        const tone = fields.tone || "";
        const platform = fields.platform || "TikTok / Reels";

        systemPrompt = `
You are Lot Rocket's AI Video Director for car sales content.

Return:
1) A short, punchy spoken script
2) A shot-by-shot list
3) An AI video generator prompt
4) A thumbnail prompt (vertical)
`.trim();

        userPrompt = `
Platform: ${platform}
Hook style: ${hookStyle}
Target length (seconds): ${length}
Tone: ${tone || "sales pro, confident, trustworthy"}
Video description:
"${describe || "Walkaround of a car"}"

Extra vehicle/offer context:
${context || "(none)"}
`.trim();
        break;
      }

      case "workflow":
        systemPrompt = `
You are Lot Rocket's AI Workflow Expert.
Give clear, step-by-step guidance to car sales pros on leads, follow-up, and daily process.
Be concise, direct, action-focused.
`.trim();
        userPrompt = fields.prompt || rawContext || "Help me with my sales workflow.";
        break;

      case "message":
        systemPrompt = `
You are Lot Rocket's AI Message Builder.
Write high-converting, friendly, conversational messages for car shoppers.
Match the channel (text / email / DM) if provided.
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
Be technical, precise, blunt, confident. Analyze—do not summarize.

Include:
1) Engineering & powertrain
2) Trim decoding
3) Best years vs avoid years
4) Known issues
5) Verdict
6) Sales application (angles, objections, rebuttals)
`.trim();
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

    // Use Responses API for consistency
    const text = await aiText({
      system: systemPrompt,
      user: userPrompt,
      model: "gpt-4o-mini",
      temperature: 0.8,
    });

    return res.json({
      text: (text || "").trim() || "Lot Rocket could not generate a response. Please try again.",
    });
  } catch (err) {
    console.error("❌ /api/message-helper error", err);
    return res.status(500).json({ message: "Lot Rocket hit an error talking to AI." });
  }
});

// -------------------------
// Start server
// -------------------------
app.listen(PORT, () => {
  console.log(`Lot Rocket backend running on port ${PORT}`);
});
