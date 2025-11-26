// app.js – Lot Rocket Social Media Kit (viral-style posts + auto-photos + light/dark)

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const cheerio = require("cheerio");

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Helper: Scrape photos from dealer URL ----------

async function scrapeVehiclePhotos(pageUrl) {
  try {
    const res = await fetch(pageUrl);
    if (!res.ok) {
      console.error("Failed to fetch page for photos:", res.status);
      return [];
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const urls = new Set();

    const base = new URL(pageUrl);

    $("img").each((i, el) => {
      let src = $(el).attr("data-src") || $(el).attr("src");
      if (!src) return;

      // Normalize to absolute URL
      if (src.startsWith("//")) {
        src = "https:" + src;
      } else if (src.startsWith("/")) {
        src = base.origin + src;
      } else if (!src.startsWith("http")) {
        src = base.origin + (src.startsWith("/") ? src : "/" + src);
      }

      const lower = src.toLowerCase();

      // crude filters to avoid logos / junk
      if (
        lower.includes("logo") ||
        lower.includes("icon") ||
        lower.includes("badge") ||
        lower.includes("spinner") ||
        lower.includes("placeholder")
      ) {
        return;
      }

      urls.add(src);
    });

    return Array.from(urls).slice(0, 40);
  } catch (err) {
    console.error("Error scraping photos:", err);
    return [];
  }
}

// ---------- Helper: base prompt for social kit (VIRAL STYLE) ----------

function buildSocialKitPrompt({ label, price, url }) {
  return `
You are helping a car salesperson create a **viral-style** social media content kit for a single vehicle.

Vehicle label (how we’ll refer to it in the copy):
"${label}"

Pricing / deal info as a short phrase:
"${price || "Message for current pricing"}"

Dealer vehicle URL:
${url}

Overall goals:
- Posts should feel like **big “scroll-stopper” boxes**: clear hook line on top, then spaced-out lines that are easy to read.
- Use emojis to create energy (🚗🔥✨💥👀 etc.) on Facebook, Instagram, TikTok, and Marketplace.
- Everything must be **copy-and-paste ready**. No [CUT TO] or bracketed stage directions. No instructions to the salesperson inside the post text.
- Write like a confident, honest salesperson – not a corporate dealership.

Return a JSON object ONLY with these exact keys:
{
  "facebook": "...",
  "instagram": "...",
  "tiktok": "...",
  "linkedin": "...",
  "twitter": "...",
  "textBlurb": "...",
  "marketplace": "...",
  "hashtags": "...",
  "videoScript": "...",
  "shotPlan": "..."
}

Style guide (IMPORTANT):
- Keep everything under ~900 characters per field.
- Use **short lines separated by line breaks** so it looks like a “big box” of text a salesperson can paste.
- Use the vehicle label naturally 1–3 times.
- Include the pricing/deal phrase once near the top if it’s useful.
- NO markdown, NO backticks, NO bullet characters like • unless you write them literally. Plain text only.

Platform-by-platform instructions:

facebook:
- Start with a big hook like: "🔥 STOP SCROLLING. Look at this [vehicle] in [city] 🔥" or "🚨 DEAL ALERT 🚨".
- Use 2–4 emoji in the first 2 lines.
- Then 5–10 short lines calling out benefits (comfort, tech, fuel, space, etc.).
- End with a strong CTA: comment/DM "INFO", book a test drive, etc.
- Line breaks between sections so it pastes as a “big readable box”.

instagram:
- Also start with a hook + emojis.
- Slightly more “vibe” / lifestyle tone, but still about the actual car.
- 3–6 short benefit lines.
- Clear CTA: "DM 'INFO'" or "DM for details".
- Include the deal phrase where it makes sense.

tiktok:
- Write like a caption or voiceover text.
- Hook + emojis at the top.
- 3–6 short lines that feel like what’s on screen in a vertical video.
- Clear CTA at the end.

linkedin:
- Less emojis, more professional, but **not** stiff or corporate.
- One clear hook line, then 3–6 short lines explaining why this is a smart, practical choice.
- CTA: connect or message for details.

twitter:
- 1–2 short lines plus hashtags at the end.
- Can include 1–2 emojis.

textBlurb:
- Short SMS/DM style, 1–3 lines max.
- No emojis required, but allowed.
- Very direct: what the vehicle is, that it’s available, ask if they want pics/walkaround/pricing.

marketplace:
- This should feel like a **spicy, scroll-stopping Facebook Marketplace description**, not boring.
- Start with a strong first line, can include emojis, but the first characters should still read clean if someone skims.
- Include a short “why this one is worth a serious look” style section.
- Talk about: looks, daily comfort, tech, space, how it fits real life.
- End with a clear CTA: message for details, more photos, simple breakdown of numbers, etc.

hashtags:
- A single line of hashtags separated by spaces.
- 8–15 tags, mostly lowercase, mix of year/make/model/local (#2024 #kia #suv #plymouthmi #carsforsale etc.).
- No special characters beyond #.

videoScript:
- 30–40 second script someone can read straight to camera.
- No bracketed instructions like [Cut to exterior] or [B-roll].
- 4–7 short paragraphs/lines.
- Natural spoken language, feels like a salesperson talking.
- Clear CTA at the end: DM "INFO", message me, or book a test drive.

shotPlan:
- 5–10 bullet-style lines describing shots to capture.
- Each line should describe the shot in plain text (for example, "Front 3/4 exterior walk-around", "Interior tech close-up", etc.).
- No brackets, no camera directions in square brackets. Just plain text bullet descriptions.
`;
}

// ---------- Helper: single-post prompts (VIRAL MODE) ----------

function buildSinglePostPrompt({ platform, label, price, url }) {
  return `
You are writing a **fresh, viral-style** social media post for a car salesperson.

Platform: ${platform}
Vehicle: "${label}"
Pricing/deal phrase: "${price || "Message for current pricing"}"
Vehicle URL: ${url}

The post must be **copy-and-paste ready**. NO [CUT TO] directions, no script notes.
Plain text only.

Tone:
- Confident, honest salesperson.
- Conversational, not corporate.
- Hooky and scroll-stopping, but not cringe or fake hype.

Emojis:
- facebook, instagram, tiktok, marketplace: use emojis in the hook and where they help.
- twitter: 1–3 emojis maximum.
- linkedin: emojis optional; keep it more professional.
- textBlurb: emojis optional; keep it tight and direct.

Length rules:
- facebook, instagram, linkedin, marketplace: 3–10 short lines, separated by line breaks, so it looks like a big readable box.
- tiktok: 3–6 short lines, feels like caption/voiceover.
- twitter: 1–3 short lines total.
- textBlurb: 1–3 very short lines.

CTAs:
- facebook/instagram/tiktok/marketplace: end with a clear CTA like "DM 'INFO' for details", "Message me to schedule a test drive", etc.
- linkedin: ask them to message or connect for more details.
- twitter: short CTA or invite to DM.
- textBlurb: ask if they want photos, a quick walkaround video, or pricing.

DO NOT include hashtags in this response. DO NOT use the word "hashtags".
Return only the finished post as plain text that’s ready to paste.
`;
}

// ---------- Helper: video script prompt (plain narration, no [CUT TO]) ----------

function buildVideoScriptPrompt({ label, price, url }) {
  return `
Write a 30–40 second vertical video script a car salesperson can read on camera
for this vehicle:

Vehicle: "${label}"
Pricing/deal phrase: "${price || "Message for current pricing"}"
Vehicle URL: ${url}

Format:
- No labels like HOOK or CTA, just the script lines.
- NO bracketed directions like [Cut to exterior] or [B-roll].
- Use natural spoken language.
- 4–7 short paragraphs or line breaks.
- Clear call-to-action at the end (DM "INFO", message me, book a test drive, etc.).

Return ONLY the script text, nothing else.
`;
}

// ---------- OpenAI helpers (no response_format param) ----------

async function callOpenAIForJSON(prompt) {
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const text = response.output[0].content[0].text;

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  return JSON.parse(cleaned);
}

async function callOpenAIForText(prompt) {
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  return response.output[0].content[0].text;
}

// ---------- API routes ----------

app.post("/api/social-kit", async (req, res) => {
  try {
    const { url, label, price } = req.body;
    if (!url || !label) {
      return res.status(400).json({ error: "Missing url or label" });
    }

    const prompt = buildSocialKitPrompt({ url, label, price });
    const json = await callOpenAIForJSON(prompt);

    res.json({
      success: true,
      kit: json,
    });
  } catch (err) {
    console.error("Error in /api/social-kit:", err);
    res.status(500).json({ error: "Failed to generate social kit" });
  }
});

app.post("/api/new-post", async (req, res) => {
  try {
    const { platform, label, price, url } = req.body;
    if (!platform || !label) {
      return res.status(400).json({ error: "Missing platform or label" });
    }

    const prompt = buildSinglePostPrompt({ platform, label, price, url });
    const text = await callOpenAIForText(prompt);

    res.json({
      success: true,
      post: text.trim(),
    });
  } catch (err) {
    console.error("Error in /api/new-post:", err);
    res.status(500).json({ error: "Failed to generate new post" });
  }
});

app.post("/api/new-script", async (req, res) => {
  try {
    const { label, price, url } = req.body;
    if (!label || !url) {
      return res.status(400).json({ error: "Missing label or url" });
    }

    const prompt = buildVideoScriptPrompt({ label, price, url });
    const script = await callOpenAIForText(prompt);

    res.json({
      success: true,
      script: script.trim(),
    });
  } catch (err) {
    console.error("Error in /api/new-script:", err);
    res.status(500).json({ error: "Failed to generate video script" });
  }
});

app.post("/api/grab-photos", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing url" });
    }

    const photos = await scrapeVehiclePhotos(url);
    res.json({ success: true, photos });
  } catch (err) {
    console.error("Error in /api/grab-photos:", err);
    res.status(500).json({ error: "Failed to grab photos" });
  }
});

app.post("/api/video-from-photos", async (req, res) => {
  try {
    const { photos, label } = req.body;
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: "No photos provided" });
    }

    const total = photos.length;
    const mid = Math.floor(total / 2);
    const last = total - 1;

    const plan = [
      `Clip 1 – Photo 1 – 3–4 seconds\nOn-screen text: "${label}"`,
      total > 4 ? `Clip 2 – Photo 4 – 3 seconds` : "",
      total > 8 ? `Clip 3 – Photo 8 – 3 seconds` : "",
      `Clip 4 – Photo ${mid + 1} – 3–4 seconds\nOn-screen text: "Interior & tech"`,
      total > 6 ? `Clip 5 – Photo ${Math.min(mid + 3, last + 1)} – 3 seconds` : "",
      `Clip 6 – Photo ${last + 1} – 3 seconds\nOn-screen text: "DM 'INFO' for details"`,
      `Recommended music: upbeat, confident track that fits Reels / TikTok.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    res.json({ success: true, plan });
  } catch (err) {
    console.error("Error in /api/video-from-photos:", err);
    res.status(500).json({ error: "Failed to build video plan" });
  }
});

// ---------- Front-end HTML (unchanged from last working version, except copy tweaks) ----------

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <title>Lot Rocket · Social Media Kit</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg-dark: #05060a;
      --bg-dark-alt: #0c0f17;
      --bg-light: #f5f5f7;
      --bg-light-alt: #ffffff;
      --accent: #ff4b4b;
      --accent-soft: rgba(255, 75, 75, 0.15);
      --border-dark: #252836;
      --border-light: #d0d3dd;
      --text-dark: #f9fafb;
      --text-muted-dark: #9ca3af;
      --text-light: #111827;
      --text-muted-light: #6b7280;
      --card-radius: 18px;
      --shadow-soft: 0 18px 40px rgba(0, 0, 0, 0.4);
      --shadow-soft-light: 0 18px 40px rgba(15, 23, 42, 0.18);
      --input-radius: 12px;
      --transition-fast: 0.18s ease-out;
      --font-main: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    }

    [data-theme="dark"] body {
      background: radial-gradient(circle at top, #111827 0, #020617 45%, #000 100%);
      color: var(--text-dark);
    }
    [data-theme="light"] body {
      background: radial-gradient(circle at top, #e5e7eb 0, #f9fafb 40%, #e5e7eb 100%);
      color: var(--text-light);
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--font-main);
      display: flex;
      align-items: stretch;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }

    .app-shell {
      width: 100%;
      max-width: 1240px;
      border-radius: 26px;
      padding: 20px 22px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      overflow: hidden;
    }

    [data-theme="dark"] .app-shell {
      background: radial-gradient(circle at top left, #1f2937 0, #020617 60%);
      box-shadow: var(--shadow-soft);
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    [data-theme="light"] .app-shell {
      background: linear-gradient(135deg, #f9fafb, #e5e7eb);
      box-shadow: var(--shadow-soft-light);
      border: 1px solid rgba(148, 163, 184, 0.35);
    }

    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 999px;
      background: radial-gradient(circle at 10% 0, #f97316, #ef4444);
      color: #fff;
      font-weight: 800;
      font-size: 18px;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.35), 0 10px 25px rgba(239, 68, 68, 0.7);
    }
    .title-text-main {
      font-weight: 650;
      font-size: 20px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .title-text-sub {
      font-size: 13px;
      opacity: 0.78;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
    }

    .chip {
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    [data-theme="dark"] .chip {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.5);
      color: var(--text-muted-dark);
    }
    [data-theme="light"] .chip {
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.5);
      color: var(--text-muted-light);
    }
    .chip span.dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #22c55e;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15);
    }

    .theme-toggle {
      border-radius: 999px;
      padding: 6px 10px;
      border: none;
      cursor: pointer;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast), color var(--transition-fast);
    }
    [data-theme="dark"] .theme-toggle {
      background: rgba(15, 23, 42, 0.95);
      color: var(--text-muted-dark);
      box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.45);
    }
    [data-theme="light"] .theme-toggle {
      background: rgba(255, 255, 255, 0.95);
      color: var(--text-muted-light);
      box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.5);
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
      gap: 16px;
      margin-top: 6px;
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .card {
      border-radius: var(--card-radius);
      padding: 14px 14px 13px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 10px;
      position: relative;
    }
    [data-theme="dark"] .card {
      background: radial-gradient(circle at top left, #111827 0, #020617 60%);
      border: 1px solid rgba(51, 65, 85, 0.9);
    }
    [data-theme="light"] .card {
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.6);
    }

    .card-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .card-subtitle {
      font-size: 12px;
      opacity: 0.75;
    }

    .badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    [data-theme="dark"] .badge {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(107, 114, 128, 0.9);
      color: var(--text-muted-dark);
    }
    [data-theme="light"] .badge {
      background: rgba(249, 250, 251, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.9);
      color: var(--text-muted-light);
    }

    label.field-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.8;
      margin-bottom: 4px;
      display: block;
    }

    .field-group {
      margin-bottom: 8px;
    }

    .input, .textarea {
      width: 100%;
      box-sizing: border-box;
      border-radius: var(--input-radius);
      border: 1px solid;
      padding: 7px 9px;
      font-family: var(--font-main);
      font-size: 13px;
      resize: vertical;
      min-height: 34px;
      outline: none;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
    }
    .textarea {
      min-height: 90px;
      white-space: pre-wrap;
    }

    [data-theme="dark"] .input,
    [data-theme="dark"] .textarea {
      background: rgba(15, 23, 42, 0.95);
      border-color: rgba(55, 65, 81, 0.95);
      color: var(--text-dark);
    }
    [data-theme="light"] .input,
    [data-theme="light"] .textarea {
      background: rgba(249, 250, 251, 0.96);
      border-color: rgba(148, 163, 184, 0.9);
      color: var(--text-light);
    }

    .input:focus,
    .textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.5);
    }

    .button-primary {
      border-radius: 999px;
      padding: 7px 16px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
    }
    [data-theme="dark"] .button-primary {
      background: linear-gradient(135deg, #fb923c, #ef4444);
      color: #fff;
      box-shadow: 0 14px 30px rgba(248, 113, 113, 0.7);
    }
    [data-theme="light"] .button-primary {
      background: linear-gradient(135deg, #f97316, #dc2626);
      color: #fff;
      box-shadow: 0 12px 26px rgba(239, 68, 68, 0.6);
    }
    .button-primary:active {
      transform: translateY(1px) scale(0.99);
      box-shadow: none;
    }

    .button-ghost {
      border-radius: 999px;
      padding: 5px 10px;
      border: 1px solid;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
    }
    [data-theme="dark"] .button-ghost {
      border-color: rgba(75, 85, 99, 0.85);
      color: var(--text-muted-dark);
    }
    [data-theme="light"] .button-ghost {
      border-color: rgba(148, 163, 184, 0.9);
      color: var(--text-muted-light);
    }
    .button-ghost span.icon {
      font-size: 13px;
    }

    .stack-vertical {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pill-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-start;
    }

    .pill {
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 11px;
      border: 1px solid;
    }
    [data-theme="dark"] .pill {
      background: rgba(15, 23, 42, 0.9);
      border-color: rgba(55, 65, 81, 0.9);
      color: var(--text-muted-dark);
    }
    [data-theme="light"] .pill {
      background: rgba(249, 250, 251, 0.96);
      border-color: rgba(148, 163, 184, 0.9);
      color: var(--text-muted-light);
    }

    .photos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 6px;
    }
    .photo-thumb {
      position: relative;
      border-radius: 10px;
      overflow: hidden;
      cursor: pointer;
      aspect-ratio: 4 / 3;
      border: 1px solid rgba(148, 163, 184, 0.5);
    }
    .photo-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .status-text {
      font-size: 11px;
      opacity: 0.8;
    }

    .section-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .social-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
    }

    .social-card {
      border-radius: 14px;
      padding: 9px 9px 8px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      border: 1px solid rgba(148, 163, 184, 0.75);
    }
    [data-theme="dark"] .social-card {
      background: rgba(15, 23, 42, 0.98);
    }
    [data-theme="light"] .social-card {
      background: rgba(249, 250, 251, 0.98);
    }

    .social-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .social-platform {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .textarea.small {
      min-height: 80px;
      max-height: 150px;
    }

    .textarea.tall {
      min-height: 120px;
    }

    .textarea.script {
      min-height: 150px;
    }

    .textarea.shotplan {
      min-height: 130px;
    }

    .tiny-note {
      font-size: 10px;
      opacity: 0.75;
      margin-top: 4px;
    }

    .loading-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--accent);
      display: inline-block;
      margin-right: 6px;
      animation: pulse 1s infinite alternate;
      vertical-align: middle;
    }
    @keyframes pulse {
      from { transform: scale(1); opacity: 0.8; }
      to   { transform: scale(1.4); opacity: 0.3; }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <header class="app-header">
      <div class="title-group">
        <div class="logo-pill">🚀</div>
        <div>
          <div class="title-text-main">Lot Rocket</div>
          <div class="title-text-sub">Social Media Kit · Prototype for salespeople, not stores</div>
        </div>
      </div>
      <div class="header-right">
        <div class="chip">
          <span class="dot"></span>
          <span>AI-ASSISTED COPY · BETA</span>
        </div>
        <button id="themeToggle" class="theme-toggle" type="button">
          <span id="themeIcon">🌙</span>
          <span id="themeLabel">Dark</span>
        </button>
      </div>
    </header>

    <div class="layout">
      <!-- Left panel: URL + media -->
      <section class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Step 1 · Dealer URL</div>
            <div class="card-subtitle">Paste a full vehicle detail page. We’ll pull photos and build the kit.</div>
          </div>
          <span class="badge">INPUT</span>
        </div>

        <div class="stack-vertical">
          <div class="field-group">
            <label class="field-label" for="vehicleUrl">Dealer vehicle URL</label>
            <input id="vehicleUrl" class="input" placeholder="https://dealer.com/used-YourVehicleHere..." />
          </div>

          <div class="pill-row">
            <button id="boostButton" class="button-primary" type="button">
              <span>🚀 Boost This Listing</span>
            </button>
            <span id="statusText" class="status-text">Paste URL, then tap Boost.</span>
          </div>

          <div class="field-group">
            <label class="field-label" for="vehicleLabel">Vehicle label (editable)</label>
            <input id="vehicleLabel" class="input" placeholder="2024 Chevrolet Blazer 2LT – Plymouth, MI" />
          </div>

          <div class="field-group">
            <label class="field-label" for="priceInfo">Price / deal info (editable)</label>
            <input id="priceInfo" class="input" placeholder="Message for current pricing" />
          </div>
        </div>

        <div class="stack-vertical">
          <div class="section-title-row">
            <div>
              <div class="card-title">Media Tools</div>
              <div class="card-subtitle">Photos auto-load from the dealer page. Then build a simple video plan.</div>
            </div>
          </div>

          <div class="pill-row">
            <button id="buildVideoButton" class="button-ghost" type="button">
              <span class="icon">🎬</span><span>Video Shot Plan From Photos</span>
            </button>
          </div>

          <div class="field-group">
            <label class="field-label">Dealer Photos</label>
            <div id="photosGrid" class="photos-grid"></div>
            <div id="photosStatus" class="tiny-note">Photos will auto-load after Boost if we can find them.</div>
          </div>

          <div class="field-group">
            <label class="field-label" for="videoPlan">Video From Photos Plan</label>
            <textarea id="videoPlan" class="textarea shotplan" placeholder="After photos are loaded, hit 'Video Shot Plan From Photos' to get a simple shot list for Reels / TikTok." readonly></textarea>
          </div>

          <div class="field-group">
            <label class="field-label">Photo Editor (coming soon)</label>
            <div class="tiny-note">Future version: remove watermarks, adjust lighting, crop, and export social-ready images directly from Lot Rocket.</div>
          </div>
        </div>
      </section>

      <!-- Right panel: social kit -->
      <section class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Step 2 · Social Kit</div>
            <div class="card-subtitle">Copy, tweak, and paste into each platform. Spin fresh versions anytime.</div>
          </div>
          <span class="badge">OUTPUT</span>
        </div>

        <div class="stack-vertical">
          <div class="field-group">
            <label class="field-label">Listing Summary</label>
            <div class="pill-row">
              <span id="summaryLabel" class="pill">No vehicle yet</span>
              <span id="summaryPrice" class="pill">—</span>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Social Media Posts</label>
            <div class="card-subtitle">
              Each box is ready-to-use. Hit “New Post” to spin a fresh version for that platform.
            </div>
          </div>

          <div class="social-grid">
            <!-- Facebook -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">📘 Facebook</div>
                <button data-platform="facebook" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="facebookPost" class="textarea small" readonly></textarea>
            </div>

            <!-- Instagram -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">📸 Instagram</div>
                <button data-platform="instagram" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="instagramPost" class="textarea small" readonly></textarea>
            </div>

            <!-- TikTok -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🎵 TikTok</div>
                <button data-platform="tiktok" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="tiktokPost" class="textarea small" readonly></textarea>
            </div>

            <!-- LinkedIn -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">💼 LinkedIn</div>
                <button data-platform="linkedin" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="linkedinPost" class="textarea small" readonly></textarea>
            </div>

            <!-- X / Twitter -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🐦 X / Twitter</div>
                <button data-platform="twitter" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="twitterPost" class="textarea small" readonly></textarea>
            </div>

            <!-- Text / DM -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">💬 Text / DM</div>
                <button data-platform="text" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Text</span>
                </button>
              </div>
              <textarea id="textBlurb" class="textarea small" readonly></textarea>
            </div>

            <!-- Marketplace -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🛒 Marketplace</div>
                <button data-platform="marketplace" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="marketplacePost" class="textarea tall" readonly></textarea>
            </div>

            <!-- Hashtags -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🏷 Hashtags</div>
                <button data-platform="hashtags" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Tags</span>
                </button>
              </div>
              <textarea id="hashtags" class="textarea small" readonly></textarea>
            </div>
          </div>

          <div class="field-group">
            <div class="section-title-row">
              <label class="field-label">Video Engine</label>
              <button id="newScriptButton" class="button-ghost" type="button">
                <span class="icon">🔁</span><span>New Script</span>
              </button>
            </div>
            <div class="card-subtitle">
              Script + shot plan you can read on camera and follow for Reels, TikTok, Shorts, or Facebook Reels.
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="videoScript">Viral Video Script</label>
            <textarea id="videoScript" class="textarea script" readonly></textarea>
          </div>

          <div class="field-group">
            <label class="field-label" for="shotPlan">Viral Visual Shot Plan</label>
            <textarea id="shotPlan" class="textarea shotplan" readonly></textarea>
          </div>

          <div class="tiny-note">
            Prototype for salespeople. Copy, tweak, and make it yours. 🚀
          </div>
        </div>
      </section>
    </div>
  </div>

  <script>
    const apiBase = "";

    const vehicleUrlInput = document.getElementById("vehicleUrl");
    const vehicleLabelInput = document.getElementById("vehicleLabel");
    const priceInfoInput = document.getElementById("priceInfo");
    const boostButton = document.getElementById("boostButton");
    const statusText = document.getElementById("statusText");

    const summaryLabel = document.getElementById("summaryLabel");
    const summaryPrice = document.getElementById("summaryPrice");

    const facebookPost = document.getElementById("facebookPost");
    const instagramPost = document.getElementById("instagramPost");
    const tiktokPost = document.getElementById("tiktokPost");
    const linkedinPost = document.getElementById("linkedinPost");
    const twitterPost = document.getElementById("twitterPost");
    const textBlurb = document.getElementById("textBlurb");
    const marketplacePost = document.getElementById("marketplacePost");
    const hashtags = document.getElementById("hashtags");
    const videoScript = document.getElementById("videoScript");
    const shotPlan = document.getElementById("shotPlan");

    const buildVideoButton = document.getElementById("buildVideoButton");
    const photosGrid = document.getElementById("photosGrid");
    const photosStatus = document.getElementById("photosStatus");
    const videoPlan = document.getElementById("videoPlan");

    const newScriptButton = document.getElementById("newScriptButton");

    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");
    const themeLabel = document.getElementById("themeLabel");

    let currentPhotos = [];
    let currentUrl = "";
    let isBoosting = false;

    function applyTheme(theme) {
      const root = document.documentElement;
      root.setAttribute("data-theme", theme);
      if (theme === "dark") {
        themeIcon.textContent = "🌙";
        themeLabel.textContent = "Dark";
      } else {
        themeIcon.textContent = "☀️";
        themeLabel.textContent = "Light";
      }
      localStorage.setItem("lotRocketTheme", theme);
    }

    function initTheme() {
      const saved = localStorage.getItem("lotRocketTheme");
      if (saved === "light" || saved === "dark") {
        applyTheme(saved);
      } else {
        applyTheme("dark");
      }
    }

    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
    });

    initTheme();

    function setStatus(text, isLoading = false) {
      if (isLoading) {
        statusText.innerHTML = '<span class="loading-dot"></span>' + text;
      } else {
        statusText.textContent = text;
      }
    }

    function safeTrim(str) {
      return (str || "").toString().trim();
    }

    function updateSummary(label, price) {
      summaryLabel.textContent = safeTrim(label) || "Vehicle ready";
      summaryPrice.textContent = safeTrim(price) || "Message for current pricing";
    }

    function fillSocialKit(kit) {
      facebookPost.value = kit.facebook || "";
      instagramPost.value = kit.instagram || "";
      tiktokPost.value = kit.tiktok || "";
      linkedinPost.value = kit.linkedin || "";
      twitterPost.value = kit.twitter || "";
      textBlurb.value = kit.textBlurb || "";
      marketplacePost.value = kit.marketplace || "";
      hashtags.value = kit.hashtags || "";
      videoScript.value = kit.videoScript || "";
      shotPlan.value = kit.shotPlan || "";
    }

    function renderPhotosGrid(photos) {
      photosGrid.innerHTML = "";
      if (!photos || !photos.length) {
        photosStatus.textContent = "No photos found yet. They will auto-load on Boost if available.";
        return;
      }
      photos.forEach((url) => {
        const wrapper = document.createElement("div");
        wrapper.className = "photo-thumb";
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Vehicle photo";
        wrapper.appendChild(img);
        wrapper.addEventListener("click", () => {
          window.open(url, "_blank");
        });
        photosGrid.appendChild(wrapper);
      });
      photosStatus.textContent = photos.length + " photos found. Click any to open full size.";
    }

    async function callJson(endpoint, body) {
      const res = await fetch(apiBase + endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error("Request failed: " + res.status + " " + txt);
      }
      return res.json();
    }

    async function handleBoost() {
      if (isBoosting) return;
      const url = safeTrim(vehicleUrlInput.value);
      if (!url) {
        alert("Paste a dealer vehicle URL first.");
        return;
      }

      let label = safeTrim(vehicleLabelInput.value);
      if (!label) {
        label = "This vehicle";
        vehicleLabelInput.value = label;
      }
      let price = safeTrim(priceInfoInput.value);
      if (!price) {
        price = "Message for current pricing";
        priceInfoInput.value = price;
      }

      isBoosting = true;
      boostButton.disabled = true;
      setStatus("Building social kit with AI…", true);

      try {
        currentUrl = url;
        const resp = await callJson("/api/social-kit", { url, label, price });
        if (!resp.success) throw new Error("API returned error");
        fillSocialKit(resp.kit);
        updateSummary(label, price);
        setStatus("Social kit ready. You can spin new posts or scripts anytime.");

        try {
          photosStatus.textContent = "Trying to grab photos from dealer page…";
          const photoResp = await callJson("/api/grab-photos", { url });
          if (photoResp.success) {
            currentPhotos = photoResp.photos || [];
            renderPhotosGrid(currentPhotos);
          } else {
            photosStatus.textContent = "Could not grab photos.";
          }
        } catch (err) {
          console.error("Auto photo grab failed:", err);
          photosStatus.textContent = "Auto photo load failed.";
        }
      } catch (err) {
        console.error(err);
        setStatus("Something went wrong. Try again or check the URL.");
        alert("Error building social kit. Check the URL and try again.");
      } finally {
        isBoosting = false;
        boostButton.disabled = false;
      }
    }

    boostButton.addEventListener("click", handleBoost);

    document.querySelectorAll(".button-new-post").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const platform = btn.getAttribute("data-platform");
        const url = safeTrim(vehicleUrlInput.value);
        const label = safeTrim(vehicleLabelInput.value);
        const price = safeTrim(priceInfoInput.value);

        if (!url || !label) {
          alert("Please paste a URL and hit Boost at least once before spinning posts.");
          return;
        }

        btn.disabled = true;
        const oldText = btn.innerHTML;
        btn.innerHTML = '<span class="icon">⏳</span><span>Working…</span>';

        try {
          const resp = await callJson("/api/new-post", { platform, url, label, price });
          if (!resp.success) throw new Error("API returned error");
          const text = resp.post || "";

          switch (platform) {
            case "facebook":
              facebookPost.value = text;
              break;
            case "instagram":
              instagramPost.value = text;
              break;
            case "tiktok":
              tiktokPost.value = text;
              break;
            case "linkedin":
              linkedinPost.value = text;
              break;
            case "twitter":
              twitterPost.value = text;
              break;
            case "text":
              textBlurb.value = text;
              break;
            case "marketplace":
              marketplacePost.value = text;
              break;
            case "hashtags":
              hashtags.value = text;
              break;
          }
        } catch (err) {
          console.error(err);
          alert("Error generating a new post. Try again.");
        } finally {
          btn.disabled = false;
          btn.innerHTML = oldText;
        }
      });
    });

    newScriptButton.addEventListener("click", async () => {
      const url = safeTrim(vehicleUrlInput.value);
      const label = safeTrim(vehicleLabelInput.value);
      const price = safeTrim(priceInfoInput.value);

      if (!url || !label) {
        alert("Please paste a URL and hit Boost at least once before spinning scripts.");
        return;
      }

      newScriptButton.disabled = true;
      const oldText = newScriptButton.innerHTML;
      newScriptButton.innerHTML = '<span class="icon">⏳</span><span>Working…</span>';

      try {
        const resp = await callJson("/api/new-script", { url, label, price });
        if (!resp.success) throw new Error("API error");
        videoScript.value = resp.script || "";
      } catch (err) {
        console.error(err);
        alert("Error generating a new script. Try again.");
      } finally {
        newScriptButton.disabled = false;
        newScriptButton.innerHTML = oldText;
      }
    });

    buildVideoButton.addEventListener("click", async () => {
      if (!currentPhotos || !currentPhotos.length) {
        alert("No photos yet. Boost a listing first so we can grab the photos.");
        return;
      }

      buildVideoButton.disabled = true;
      const oldText = buildVideoButton.innerHTML;
      buildVideoButton.innerHTML = '<span class="icon">⏳</span><span>Building…</span>';

      try {
        const label = safeTrim(vehicleLabelInput.value) || "this vehicle";
        const resp = await callJson("/api/video-from-photos", {
          photos: currentPhotos,
          label,
        });
        if (!resp.success) throw new Error("API error");
        videoPlan.value = resp.plan || "";
      } catch (err) {
        console.error(err);
        alert("Error building video plan. Try again.");
      } finally {
        buildVideoButton.disabled = false;
        buildVideoButton.innerHTML = oldText;
      }
    });
  </script>
</body>
</html>`);
});

// ---------- Start server ----------

app.listen(port, () => {
  console.log(`Lot Rocket server running on port ${port}`);
});
