// app.js – Lot Rocket backend (Cleaned + organized)
// - normalized URL helper
// - image proxy for CORS-safe canvas usage
// - social kit + regen routes
// - photo AI endpoints
// - calculators + workflow + message-helper

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const fetch = require("node-fetch");
const archiver = require("archiver");

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/* =========================================================
   HELPERS
   ========================================================= */

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

function isRateLimitError(err) {
  const msg = (err && (err.message || err.error?.message || ""))?.toLowerCase?.() || "";
  if (msg.includes("rate limit")) return true;
  if (msg.includes("quota") || msg.includes("billing")) return true;
  if (msg.includes("insufficient") && msg.includes("quota")) return true;

  if (err?.code === "rate_limit_exceeded") return true;
  if (err?.error?.type === "rate_limit_exceeded") return true;
  if (err?.status === 429) return true;
  if (err?.response?.status === 429) return true;

  return false;
}

function sendAIError(res, err, friendlyMessage) {
  console.error("🔴 OpenAI error:", friendlyMessage, err);

  const rawMsg = (err && (err.message || err.error?.message || "")) || "Unknown error";

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

async function scrapePage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") || "";

  let visibleText = "";
  $("body *")
    .not("script, style, noscript")
    .each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 40 && text.length < 500) visibleText += text + "\n";
    });

  return { title, metaDesc, visibleText, $ };
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
      urls.add(new URL(src, base).href);
    } catch {
      /* ignore */
    }
  });

  return Array.from(urls).slice(0, 24);
}

/* =========================================================
   IMAGE – GPT IMAGE PIPELINE
   ========================================================= */

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
  if (!base64) throw new Error("AI image model returned no data");

  return `data:image/png;base64,${base64}`;
}

/* =========================================================
   SOCIAL KIT AI
   ========================================================= */

async function buildSocialKit({ pageInfo, labelOverride, priceOverride, photos }) {
  const { title, metaDesc, visibleText } = pageInfo;

  const system = `
You are Lot Rocket's Social Media War Room, powered by the mind of a Master Automotive Behavioralist and Viral Copywriter.

CRITICAL OUTPUT RULES:
- Output MUST be a single VALID JSON object.
- NO intro/outro, NO markdown code fences.
- Use keys EXACTLY:

{
  "label": string,
  "price": string,
  "facebook": string,
  "instagram": string,
  "tiktok": string,
  "linkedin": string,
  "twitter": string,
  "text": string,
  "marketplace": string,
  "hashtags": string,
  "selfieScript": string,
  "videoPlan": string,
  "canvaIdea": string
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

If label/price overrides are provided, prefer those.
Return ONLY raw JSON.
`.trim();

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = response.output?.[0]?.content?.[0]?.text || "{}";

  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse social kit JSON:", e, raw.slice(0, 300));
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

/* =========================================================
   ROUTES
   ========================================================= */

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

// CORS-safe proxy for Konva/Fabric image loading (tainted canvas fix)
app.get("/api/proxy-image", async (req, res) => {
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

    const upstream = await fetch(target);
    if (!upstream.ok) {
      console.error("proxy-image upstream error:", upstream.status, target);
      return res.status(502).json({ error: `Upstream error ${upstream.status}` });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");

    upstream.body.pipe(res);
  } catch (err) {
    console.error("proxy-image error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Image proxy error" });
  }
});

/* ---------- Photo processing batch ---------- */
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

/* ---------- Single cinematic photo ---------- */
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
      message: "Lot Rocket couldn't complete the cinematic background edit. Try again in a moment.",
    });
  }
});

/* ---------- Full social kit ---------- */
app.post("/api/social-kit", async (req, res) => {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    const labelOverride = req.body?.labelOverride || "";
    const priceOverride = req.body?.priceOverride || "";

    if (!pageUrl) {
      return res.status(400).json({
        error: "bad_url",
        message: "Invalid or missing URL. Please paste a full dealer link.",
      });
    }

    const pageInfo = await scrapePage(pageUrl);
    const photos = scrapeVehiclePhotosFromCheerio(pageInfo.$, pageUrl);

    const kit = await buildSocialKit({ pageInfo, labelOverride, priceOverride, photos });

    // optional: generate edited photos
    const editedPhotos = [];
    if (Array.isArray(photos) && photos.length) {
      for (const url of photos) {
        try {
          const processedUrl = await processSinglePhoto(url);
          editedPhotos.push({ originalUrl: url, processedUrl });
        } catch (e) {
          console.error("Photo processing failed:", url, e);
          editedPhotos.push({ originalUrl: url, processedUrl: url });
        }
      }
    }

    kit.editedPhotos = editedPhotos;
    res.json(kit);
  } catch (err) {
    return sendAIError(res, err, "Failed to build social kit.");
  }
});

/* ---------- Download ZIP of photos ---------- */
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
        const resp = await fetch(url);
        if (!resp.ok || !resp.body) continue;
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

/* ---------- Regen a single platform post ---------- */
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

    const system = `
You are Lot Rocket, an elite automotive copywriter.
Return ONLY the copy for the requested platform. No JSON. No explanation.
`.trim();

    const user = `
Dealer page:
TITLE: ${pageInfo.title}
META: ${pageInfo.metaDesc}
TEXT:
${pageInfo.visibleText.slice(0, 3000)}

Platform: ${platform}
Optional custom label: ${label || "none"}
Optional custom price: ${price || "none"}

Write ONE high-performing piece of content for this platform.
Include CTA to DM/message.
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

/* ---------- Payment helper ---------- */
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
      return res.status(400).json({ error: "Price and term (months) are required." });
    }

    const taxedPrice = taxRate ? price * (1 + taxRate) : price;
    const negativeEquity = Math.max(payoff - trade, 0);
    const amountFinanced = Math.max(taxedPrice - down + negativeEquity, 0);

    let payment;
    if (!rate) payment = amountFinanced / term;
    else {
      payment =
        (amountFinanced * rate * Math.pow(1 + rate, term)) /
        (Math.pow(1 + rate, term) - 1);
    }

    res.json({ result: `~$${payment.toFixed(2)} per month (rough estimate only).` });
  } catch (err) {
    console.error("payment-helper error", err);
    res.status(500).json({ error: "Failed to estimate payment" });
  }
});

/* ---------- Income helper ---------- */
app.post("/api/income-helper", (req, res) => {
  try {
    const grossToDate = Number(req.body.mtd || req.body.monthToDate || req.body.grossToDate || 0);
    const lastPayDateStr =
      req.body.lastPayDate || req.body.lastCheck || req.body.lastPaycheckDate || req.body.date;

    if (!grossToDate || !lastPayDateStr) {
      return res.status(400).json({
        error: "income_inputs",
        message: "Income and last paycheck date are required.",
      });
    }

    const lastPayDate = new Date(lastPayDateStr);
    if (Number.isNaN(lastPayDate.getTime())) {
      return res.status(400).json({ error: "bad_date", message: "Could not read the last paycheck date." });
    }

    const year = lastPayDate.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysIntoYear = Math.floor((lastPayDate - startOfYear) / msPerDay) + 1;
    const weeksIntoYear = daysIntoYear / 7;

    const estimatedYearly = (grossToDate / weeksIntoYear) * 52;
    const estimatedMonthly = estimatedYearly / 12;

    const formatMoney = (n) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    res.json({
      result: `Estimated Yearly Gross: ${formatMoney(estimatedYearly)} | Weeks into Year: ${weeksIntoYear.toFixed(
        1
      )} | Estimated Avg Monthly: ${formatMoney(estimatedMonthly)}`,
    });
  } catch (err) {
    console.error("income-helper error", err);
    res.status(500).json({ error: "Failed to estimate income" });
  }
});

/* ---------- Workflow Expert ---------- */
app.post("/ai/workflow", async (req, res) => {
  try {
    const { goal, tone, channel, days, touches } = req.body || {};

    const workflowPrompt = `
You are Lot Rocket's Lead Resurrection Specialist & Automotive Behavioral Psychologist.

Build a high-conversion outreach workflow:
- Goal: ${goal || "Set the Appointment"}
- Tone: ${tone || "Persuasive, Low-Pressure, High-Value"}
- Channel: ${channel || "Multi-Channel"}
- Duration: ${days || 10} days
- Touches: ${touches || 6}

Rules:
- Never say "just checking in"
- Keep SMS/DM under 3 short lines and end with a question
- Include psychology notes

Output in Markdown with Touch 1, Touch 2... etc.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: workflowPrompt,
    });

    const text = completion.output?.[0]?.content?.[0]?.text?.trim() || "No workflow returned.";
    res.json({ text });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate workflow.");
  }
});

/* ---------- Unified AI Message Helper ---------- */
app.post("/api/message-helper", async (req, res) => {
  try {
    const body = req.body || {};
    const { mode, ...fields } = body;

    if (!mode) return res.status(400).json({ message: "Missing mode in request body." });

    const rawContext = Object.entries(fields)
      .map(([k, v]) => `${k}: ${v}`)
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
You are Lot Rocket's AI Video Director.
Return FOUR labeled sections exactly like this:

SCRIPT:
SHOT LIST:
AI PROMPT:
THUMBNAIL:

Keep it practical for car sales content.
`.trim();

        userPrompt = `
Platform: ${platform}
Hook style: ${hookStyle}
Target length (seconds): ${length}
Tone: ${tone || "confident, trustworthy, fast"}
User request:
"${describe || "Walkaround video"}"

Extra vehicle/offer context:
${context || "(none)"}
`.trim();
        break;
      }

      case "workflow":
        systemPrompt = `You are Lot Rocket's AI Workflow Expert. Be concise and action-focused.`;
        userPrompt = fields.prompt || rawContext || "Help me with my sales workflow.";
        break;

      case "message":
        systemPrompt = `You are Lot Rocket's AI Message Builder. Write high-converting, conversational messages.`;
        userPrompt = fields.prompt || rawContext || "Write a follow-up message to a car lead.";
        break;

      case "ask":
        systemPrompt = `You are Lot Rocket's assistant for car salespeople. Answer clearly and practically.`;
        userPrompt = fields.prompt || rawContext || "Answer this question for a car salesperson.";
        break;

      case "car":
        systemPrompt = `You are The Master Automotive Analyst. Be technical, precise, blunt, and confident.`;
        userPrompt = fields.prompt || rawContext || "Explain this vehicle to a customer.";
        break;

      case "image-brief":
        systemPrompt = `You write concise AI image prompts for car marketing. Return ONLY the prompt.`;
        userPrompt = fields.prompt || rawContext || "Generate an image brief for a dealership post.";
        break;

      default:
        systemPrompt = `You are Lot Rocket's AI assistant for car sales pros.`;
        userPrompt = fields.prompt || rawContext || "Help me with sales & marketing.";
        break;
    }

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text = completion.output?.[0]?.content?.[0]?.text?.trim() || "No response returned.";
    res.json({ text });
  } catch (err) {
    console.error("❌ /api/message-helper error", err);
    return sendAIError(res, err, "Lot Rocket hit an error talking to AI.");
  }
});

/* =========================================================
   START SERVER
   ========================================================= */
app.listen(port, () => {
  console.log(`Lot Rocket backend running on port ${port}`);
});
