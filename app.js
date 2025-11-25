// app.js – Lot Rocket Social Media Kit (auto-photos, light/dark mode, basic photo editor)

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

// ---------------- Helper: scrape photos from dealer URL ----------------

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

// ---------------- Helper: prompts ----------------

function buildSocialKitPrompt({ label, price, url }) {
  return (
    "You are helping a car salesperson create a social media content kit for a single vehicle.\n\n" +
    "Vehicle label (how we will refer to it in the copy):\n" +
    '"' +
    label +
    '"\n\n' +
    "Pricing / deal info as a short phrase:\n" +
    '"' +
    (price || "Message for current pricing") +
    '"\n\n' +
    "Dealer vehicle URL:\n" +
    url +
    "\n\n" +
    "Write short, direct, human-sounding copy that a salesperson can copy/paste.\n" +
    "Avoid sounding like a big corporate dealership. Talk like a confident, honest salesperson.\n\n" +
    "Do NOT use shouty phrases like STOP SCROLLING, VIRAL, ALL CAPS, or over-the-top hype.\n" +
    "Do NOT include any stage directions, labels like HOOK or CTA, or text in square brackets.\n\n" +
    "Return a JSON object ONLY with these exact keys:\n" +
    "{\n" +
    '  "facebook": "...",\n' +
    '  "instagram": "...",\n' +
    '  "tiktok": "...",\n' +
    '  "linkedin": "...",\n' +
    '  "twitter": "...",\n' +
    '  "textBlurb": "...",\n' +
    '  "marketplace": "...",\n' +
    '  "hashtags": "...",\n' +
    '  "videoScript": "...",\n' +
    '  "shotPlan": "..."\n' +
    "}\n\n" +
    "Style guide:\n" +
    "- Keep everything under about 900 characters per field.\n" +
    "- Conversational, straightforward, no cringe.\n" +
    "- Use the vehicle label in a natural way.\n" +
    "- Use the price/deal phrase once near the top if it is useful.\n" +
    "- Hashtags should be 8–15 tags, simple, mostly lowercase.\n" +
    "- Do NOT include backticks, the word JSON, or any other explanation.\n\n" +
    "For each field:\n" +
    "- facebook: 1–3 short paragraphs, plain text with optional short bullet lines.\n" +
    "- instagram: similar to facebook with a bit more vibe; 3–5 short benefit lines.\n" +
    "- tiktok: short caption/voiceover style (3–6 lines).\n" +
    "- linkedin: slightly more professional, still human.\n" +
    "- twitter: 1–2 short lines plus hashtags.\n" +
    "- textBlurb: SMS/DM style, 1–3 short lines.\n" +
    "- marketplace: clean description suitable for Facebook Marketplace (no emojis at the very start).\n" +
    "- hashtags: a single line of hashtags separated by spaces.\n" +
    "- videoScript: 30–40 second script someone can read on camera.\n" +
    "- shotPlan: 5–10 bullet points describing shots to capture for short vertical video.\n"
  );
}

function buildSinglePostPrompt({ platform, label, price, url }) {
  return (
    "You are writing a fresh social media post for a car salesperson.\n\n" +
    "Platform: " +
    platform +
    "\n" +
    'Vehicle: "' +
    label +
    '"\n' +
    'Pricing/deal phrase: "' +
    (price || "Message for current pricing") +
    '"\n' +
    "Vehicle URL: " +
    url +
    "\n\n" +
    "Write ONLY the post body text for this platform, no intro or explanation.\n\n" +
    "Tone:\n" +
    "- Confident, honest salesperson.\n" +
    "- Conversational, not corporate.\n" +
    "- No hard-sell cringe, no all caps, no word VIRAL.\n" +
    "- No stage directions or text in brackets.\n\n" +
    "Length:\n" +
    "- facebook, instagram, linkedin: 3–8 short lines.\n" +
    "- tiktok: 3–6 lines, feels like caption or short voiceover.\n" +
    "- twitter: 1–3 short lines.\n" +
    "- textBlurb: 1–3 very short lines.\n" +
    "- marketplace: short description suitable for Facebook Marketplace.\n\n" +
    "Do NOT include hashtags and do NOT include the word 'hashtags'.\n" +
    "Just return the post text as plain text."
  );
}

function buildVideoScriptPrompt({ label, price, url }) {
  return (
    "Write a 30–40 second vertical video script a car salesperson can read on camera\n" +
    "for this vehicle:\n\n" +
    'Vehicle: "' +
    label +
    '"\n' +
    'Pricing/deal phrase: "' +
    (price || "Message for current pricing") +
    '"\n' +
    "Vehicle URL: " +
    url +
    "\n\n" +
    "Format:\n" +
    "- No labels like HOOK or CTA.\n" +
    "- No stage directions or text in brackets.\n" +
    "- Use natural spoken language.\n" +
    "- 4–7 short paragraphs or line breaks.\n" +
    '- Clear call-to-action at the end (for example: DM "INFO", message me, book a test drive).\n\n' +
    "Return ONLY the script text, nothing else."
  );
}

// ---------------- OpenAI helpers (Chat Completions) ----------------

async function callOpenAIForJSON(prompt) {
  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    completion.choices?.[0]?.message?.content?.trim() || "{}";

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse JSON from model:", err, text);
    return {};
  }
}

async function callOpenAIForText(prompt) {
  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    completion.choices?.[0]?.message?.content?.trim() || "";
  return text;
}

// ---------------- API routes ----------------

// Full social kit
app.post("/api/social-kit", async (req, res) => {
  try {
    const { url, label, price } = req.body;
    if (!url || !label) {
      return res.status(400).json({ error: "Missing url or label" });
    }

    const prompt = buildSocialKitPrompt({ url, label, price });
    const json = await callOpenAIForJSON(prompt);

    res.json({ success: true, kit: json });
  } catch (err) {
    console.error("Error in /api/social-kit:", err);
    res.status(500).json({ error: "Failed to generate social kit" });
  }
});

// Single new post
app.post("/api/new-post", async (req, res) => {
  try {
    const { platform, label, price, url } = req.body;
    if (!platform || !label) {
      return res.status(400).json({ error: "Missing platform or label" });
    }

    const prompt = buildSinglePostPrompt({ platform, label, price, url });
    const text = await callOpenAIForText(prompt);

    res.json({ success: true, post: text.trim() });
  } catch (err) {
    console.error("Error in /api/new-post:", err);
    res.status(500).json({ error: "Failed to generate new post" });
  }
});

// New video script (script only, not an actual video file)
app.post("/api/new-script", async (req, res) => {
  try {
    const { label, price, url } = req.body;
    if (!label || !url) {
      return res.status(400).json({ error: "Missing label or url" });
    }

    const prompt = buildVideoScriptPrompt({ label, price, url });
    const script = await callOpenAIForText(prompt);

    res.json({ success: true, script: script.trim() });
  } catch (err) {
    console.error("Error in /api/new-script:", err);
    res.status(500).json({ error: "Failed to generate video script" });
  }
});

// Grab photos
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

// Video plan from photos
app.post("/api/video-from-photos", async (req, res) => {
  try {
    const { photos, label } = req.body;
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: "No photos provided" });
    }

    const total = photos.length;
    const mid = Math.floor(total / 2);
    const last = total - 1;

    const planParts = [
      'Clip 1 – Photo 1 – 3–4 seconds\nOn-screen text: "' + label + '"',
    ];
    if (total > 3) planParts.push("Clip 2 – Photo 4 – 3 seconds");
    if (total > 7) planParts.push("Clip 3 – Photo 8 – 3 seconds");

    planParts.push(
      "Clip 4 – Photo " +
        (mid + 1) +
        " – 3–4 seconds\nOn-screen text: \"Interior & tech\""
    );

    if (total > 5) {
      planParts.push(
        "Clip 5 – Photo " +
          Math.min(mid + 3, last + 1) +
          " – 3 seconds"
      );
    }

    planParts.push(
      "Clip 6 – Photo " +
        (last + 1) +
        " – 3 seconds\nOn-screen text: \"DM 'INFO' for details\""
    );

    planParts.push(
      "Recommended music: upbeat, confident track that fits Reels / TikTok."
    );

    res.json({ success: true, plan: planParts.join("\n\n") });
  } catch (err) {
    console.error("Error in /api/video-from-photos:", err);
    res.status(500).json({ error: "Failed to build video plan" });
  }
});

// ---------------- Front-end HTML ----------------

app.get("/", (req, res) => {
  res.send(
    "<!DOCTYPE html>\n" +
      '<html lang="en" data-theme="dark">\n' +
      "<head>\n" +
      '  <meta charset="UTF-8" />\n' +
      "  <title>Lot Rocket · Social Media Kit</title>\n" +
      '  <meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
      "  <style>\n" +
      "    :root {\n" +
      "      --bg-dark: #05060a;\n" +
      "      --bg-dark-alt: #0c0f17;\n" +
      "      --bg-light: #f5f5f7;\n" +
      "      --bg-light-alt: #ffffff;\n" +
      "      --accent: #ff4b4b;\n" +
      "      --accent-soft: rgba(255, 75, 75, 0.15);\n" +
      "      --border-dark: #252836;\n" +
      "      --border-light: #d0d3dd;\n" +
      "      --text-dark: #f9fafb;\n" +
      "      --text-muted-dark: #9ca3af;\n" +
      "      --text-light: #111827;\n" +
      "      --text-muted-light: #6b7280;\n" +
      "      --card-radius: 18px;\n" +
      "      --shadow-soft: 0 18px 40px rgba(0, 0, 0, 0.4);\n" +
      "      --shadow-soft-light: 0 18px 40px rgba(15, 23, 42, 0.18);\n" +
      "      --input-radius: 12px;\n" +
      "      --transition-fast: 0.18s ease-out;\n" +
      '      --font-main: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;\n' +
      "    }\n" +
      "\n" +
      "    [data-theme=\"dark\"] body {\n" +
      "      background: radial-gradient(circle at top, #111827 0, #020617 45%, #000 100%);\n" +
      "      color: var(--text-dark);\n" +
      "    }\n" +
      "    [data-theme=\"light\"] body {\n" +
      "      background: radial-gradient(circle at top, #e5e7eb 0, #f9fafb 40%, #e5e7eb 100%);\n" +
      "      color: var(--text-light);\n" +
      "    }\n" +
      "\n" +
      "    body {\n" +
      "      margin: 0;\n" +
      "      min-height: 100vh;\n" +
      "      font-family: var(--font-main);\n" +
      "      display: flex;\n" +
      "      align-items: stretch;\n" +
      "      justify-content: center;\n" +
      "      padding: 24px;\n" +
      "      box-sizing: border-box;\n" +
      "    }\n" +
      "\n" +
      "    .app-shell {\n" +
      "      width: 100%;\n" +
      "      max-width: 1240px;\n" +
      "      border-radius: 26px;\n" +
      "      padding: 20px 22px;\n" +
      "      box-sizing: border-box;\n" +
      "      display: flex;\n" +
      "      flex-direction: column;\n" +
      "      gap: 14px;\n" +
      "      position: relative;\n" +
      "      overflow: hidden;\n" +
      "    }\n" +
      "    [data-theme=\"dark\"] .app-shell {\n" +
      "      background: radial-gradient(circle at top left, #1f2937 0, #020617 60%);\n" +
      "      box-shadow: var(--shadow-soft);\n" +
      "      border: 1px solid rgba(148, 163, 184, 0.25);\n" +
      "    }\n" +
      "    [data-theme=\"light\"] .app-shell {\n" +
      "      background: linear-gradient(135deg, #f9fafb, #e5e7eb);\n" +
      "      box-shadow: var(--shadow-soft-light);\n" +
      "      border: 1px solid rgba(148, 163, 184, 0.35);\n" +
      "    }\n" +
      "\n" +
      "    .app-header {\n" +
      "      display: flex;\n" +
      "      align-items: center;\n" +
      "      justify-content: space-between;\n" +
      "      gap: 12px;\n" +
      "    }\n" +
      "    .title-group {\n" +
      "      display: flex;\n" +
      "      align-items: center;\n" +
      "      gap: 10px;\n" +
      "    }\n" +
      "    .logo-pill {\n" +
      "      display: inline-flex;\n" +
      "      align-items: center;\n" +
      "      justify-content: center;\n" +
      "      width: 40px;\n" +
      "      height: 40px;\n" +
      "      border-radius: 999px;\n" +
      "      background: radial-gradient(circle at 10% 0, #f97316, #ef4444);\n" +
      "      color: #fff;\n" +
      "      font-weight: 800;\n" +
      "      font-size: 18px;\n" +
      "      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.35), 0 10px 25px rgba(239, 68, 68, 0.7);\n" +
      "    }\n" +
      "    .title-text-main {\n" +
      "      font-weight: 650;\n" +
      "      font-size: 20px;\n" +
      "      letter-spacing: 0.06em;\n" +
      "      text-transform: uppercase;\n" +
      "    }\n" +
      "    .title-text-sub {\n" +
      "      font-size: 13px;\n" +
      "      opacity: 0.78;\n" +
      "    }\n" +
      "\n" +
      "    .header-right {\n" +
      "      display: flex;\n" +
      "      align-items: center;\n" +
      "      gap: 10px;\n" +
      "      font-size: 12px;\n" +
      "    }\n" +
      "    .chip {\n" +
      "      padding: 5px 10px;\n" +
      "      border-radius: 999px;\n" +
      "      font-size: 11px;\n" +
      "      text-transform: uppercase;\n" +
      "      letter-spacing: 0.08em;\n" +
      "      display: inline-flex;\n" +
      "      align-items: center;\n" +
      "      gap: 6px;\n" +
      "    }\n" +
      "    [data-theme=\"dark\"] .chip {\n" +
      "      background: rgba(15, 23, 42, 0.95);\n" +
      "      border: 1px solid rgba(148, 163, 184, 0.5);\n" +
      "      color: var(--text-muted-dark);\n" +
      "    }\n" +
      "    [data-theme=\"light\"] .chip {\n" +
      "      background: rgba(255, 255, 255, 0.85);\n" +
      "      border: 1px solid rgba(148, 163, 184, 0.5);\n" +
      "      color: var(--text-muted-light);\n" +
      "    }\n" +
      "    .chip span.dot {\n" +
      "      width: 6px;\n" +
      "      height: 6px;\n" +
      "      border-radius: 999px;\n" +
      "      background: #22c55e;\n" +
      "      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15);\n" +
      "    }\n" +
      "\n" +
      "    .theme-toggle {\n" +
      "      border-radius: 999px;\n" +
      "      padding: 6px 10px;\n" +
      "      border: none;\n" +
      "      cursor: pointer;\n" +
      "      font-size: 12px;\n" +
      "      display: inline-flex;\n" +
      "      align-items: center;\n" +
      "      gap: 6px;\n" +
      "      transition: background var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast), color var(--transition-fast);\n" +
      "    }\n" +
      "    [data-theme=\"dark\"] .theme-toggle {\n" +
      "      background: rgba(15, 23, 42, 0.95);\n" +
      "      color: var(--text-muted-dark);\n" +
      "      box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.45);\n" +
      "    }\n" +
      "    [data-theme=\"light\"] .theme-toggle {\n" +
      "      background: rgba(255, 255, 255, 0.95);\n" +
      "      color: var(--text-muted-light);\n" +
      "      box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.5);\n" +
      "    }\n" +
      "\n" +
      "    .layout {\n" +
      "      display: grid;\n" +
      "      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);\n" +
      "      gap: 16px;\n" +
      "      margin-top: 6px;\n" +
      "    }\n" +
      "    @media (max-width: 900px) {\n" +
      "      .layout {\n" +
      "        grid-template-columns: minmax(0, 1fr);\n" +
      "      }\n" +
      "    }\n" +
      "\n" +
      "    .card {\n" +
      "      border-radius: var(--card-radius);\n" +
      "      padding: 14px 14px 13px;\n" +
      "      box-sizing: border-box;\n" +
      "      display: flex;\n" +
      "      flex-direction: column;\n" +
      "      gap: 10px;\n" +
      "      position: relative;\n" +
      "    }\n" +
      "    [data-theme=\"dark\"] .card {\n" +
      "      background: radial-gradient(circle at top left, #111827 0, #020617 60%);\n" +
      "      border: 1px solid rgba(51, 65, 85, 0.9);\n" +
      "    }\n" +
      "    [data-theme=\"light\"] .card {\n" +
      "      background: rgba(255, 255, 255, 0.92);\n" +
      "      border: 1px solid rgba(148, 163, 184, 0.6);\n" +
      "    }\n" +
      "\n" +
      "    .card-header {\n" +
      "      display: flex;\n" +
      "      align-items: baseline;\n" +
      "      justify-content: space-between;\n" +
      "      gap: 8px;\n" +
      "    }\n" +
      "    .card-title {\n" +
      "      font-size: 14px;\n" +
      "      font-weight: 600;\n" +
      "      letter-spacing: 0.08em;\n" +
      "      text-transform: uppercase;\n" +
      "    }\n" +
      "    .card-subtitle {\n" +
      "      font-size: 12px;\n" +
      "      opacity: 0.75;\n" +
      "    }\n" +
      "\n" +
      "    .badge {\n" +
      "      font-size: 11px;\n" +
      "      padding: 3px 8px;\n" +
      "      border-radius: 999px;\n" +
      "      text-transform: uppercase;\n" +
      "      letter-spacing: 0.08em;\n" +
      "    }\n" +
      "    [data-theme=\"dark\"] .badge {\n" +
      "      background: rgba(15, 23, 42, 0.9);\n" +
      "      border: 1px solid rgba(107, 114, 128, 0.9);\n" +
      "      color: var(--text-muted-dark);\n" +
      "    }\n" +
      "    [data-theme=\"light\"] .badge {\n" +
      "      background: rgba(249, 250, 251, 0.95);\n" +
      "      border: 1px solid rgba(148, 163, 184, 0.9);\n" +
      "      color: var(--text-muted-light);\n" +
      "    }\n" +
      "\n" +
      "    label.field-label {\n" +
      "      font-size: 11px;\n" +
      "      text-transform: uppercase;\n" +
      "      letter-spacing: 0.08em;\n" +
      "      opacity: 0.8;\n" +
      "      margin-bottom: 4px;\n" +
      "      display: block;\n" +
      "    }\n" +
      "    .field-group {\n" +
      "      margin-bottom: 8px;\n" +
      "    }\n" +
      "    .input, .textarea {\n" +
      "      width: 100%;\n" +
      "      box-sizing: border-box;\n" +
      "      border-radius: var(--input-radius);\n" +
      "      border: 1px solid;\n" +
      "      padding: 7px 9px;\n" +
      "      font-family: var(--font-main);\n" +
      "      font-size: 13px;\n" +
      "      resize: vertical;\n" +
      "      min-height: 34px;\n" +
      "      outline: none;\n" +
      "      transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), color var(--transition-fast);\n" +
      "    }\n" +
      "    .textarea {\n" +
      "      min-height: 90px;\n" +
      "      white-space: pre-wrap;\n" +
      "    }\n" +
      "    [data-theme=\"dark\"] .input,\n" +
      "    [data-theme=\"dark\"] .textarea {\n" +
      "      background: rgba(15, 23, 42, 0.95);\n" +
      "      border-color: rgba(55, 65, 81, 0.95);\n" +
      "      color: var(--text-dark);\n" +
      "    }\n" +
      "    [data-theme=\"light\"] .input,\n" +
      "    [data-theme=\"light\"] .textarea {\n" +
      "      background: rgba(249, 250, 251, 0.96);\n" +
      "      border-color: rgba(148, 163, 184, 0.9);\n" +
      "      color: var(--text-light);\n" +
      "    }\n" +
      "    .input:focus,\n" +
      "    .textarea:focus {\n" +
      "      border-color: var(--accent);\n" +
      "      box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.5);\n" +
      "    }\n" +
      "\n" +
      "    .button-primary {\n" +
      "      border-radius: 999px;\n" +
      "      padding: 7px 16px;\n" +
      "      border: none;\n" +
      "      font-size: 13px;\n" +
      "      font-weight: 600;\n" +
      "      letter-spacing: 0.08em;\n" +
      "      text-transform: uppercase;\n" +
      "      cursor: pointer;\n" +
      "      display: inline-flex;\n" +
      "      align-items: center;\n" +
      "      gap: 8px;\n" +
      "      transition: transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);\n" +
      "    }\n" +
      "    [data-theme=\"dark\"] .button-primary {\n" +
      "      background: linear-gradient(135deg, #fb923c, #ef4444);\n" +
      "      color: #fff;\n" +
      "      box-shadow: 0 14px 30px rgba(248, 113, 113, 0.7);\n" +
      "    }\n" +
      "    [data-theme=\"light\"] .button-primary {\n" +
      "      background: linear-gradient(135deg, #f97316, #dc2626);\n" +
      "      color: #fff;\n" +
      "      box-shadow: 0 12px 26px rgba(239, 68, 68, 0.6);\n" +
      "    }\n" +
      "    .button-primary:active {\n" +
      "      transform: translateY(1px) scale(0.99);\n" +
      "      box-shadow: none;\n" +
      "    }\n" +
      "\n" +
      "    .button-ghost {\n" +
      "      border-radius: 999px;\n" +
      "      padding: 5px 10px;\n" +
      "      border: 1px solid;\n" +
      "      font-size: 11px;\n" +
      "      text-transform: uppercase;\n" +
      "      letter-spacing: 0.08em;\n" +
      "      cursor: pointer;\n" +
      "      display: inline-flex;\n" +
      "      align-items: center;\n" +
      "      gap: 6px;\n" +
      "      background: transparent;\n" +
      "      transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);\n" +
      "    }\n" +
      "    [data-theme=\"dark\"] .button-ghost {\n" +
      "      border-color: rgba(75, 85, 99, 0.85);\n" +
      "      color: var(--text-muted-dark);\n" +
      "    }\n" +
      "    [data-theme=\"light\"] .button-ghost {\n" +
      "      border-color: rgba(148, 163, 184, 0.9);\n" +
      "      color: var(--text-muted-light);\n" +
      "    }\n" +
      "    .button-ghost span.icon { font-size: 13px; }\n" +
      "\n" +
      "    .stack-vertical { display: flex; flex-direction: column; gap: 8px; }\n" +
      "    .pill-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }\n" +
      "    .pill { border-radius: 999px; padding: 5px 9px; font-size: 11px; border: 1px solid; }\n" +
      "    [data-theme=\"dark\"] .pill {\n" +
      "      background: rgba(15, 23, 42, 0.9);\n" +
      "      border-color: rgba(55, 65, 81, 0.9);\n" +
      "      color: var(--text-muted-dark);\n" +
      "    }\n" +
      "    [data-theme=\"light\"] .pill {\n" +
      "      background: rgba(249, 250, 251, 0.96);\n" +
      "      border-color: rgba(148, 163, 184, 0.9);\n" +
      "      color: var(--text-muted-light);\n" +
      "    }\n" +
      "\n" +
      "    .photos-grid {\n" +
      "      display: grid;\n" +
      "      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));\n" +
      "      gap: 6px;\n" +
      "    }\n" +
      "    .photo-thumb {\n" +
      "      position: relative;\n" +
      "      border-radius: 10px;\n" +
      "      overflow: hidden;\n" +
      "      cursor: pointer;\n" +
      "      aspect-ratio: 4 / 3;\n" +
      "      border: 1px solid rgba(148, 163, 184, 0.5);\n" +
      "    }\n" +
      "    .photo-thumb img {\n" +
      "      width: 100%; height: 100%; object-fit: cover; display: block;\n" +
      "    }\n" +
      "\n" +
      "    .status-text { font-size: 11px; opacity: 0.8; }\n" +
      "    .section-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }\n" +
      "    .social-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }\n" +
      "    .social-card { border-radius: 14px; padding: 9px 9px 8px; display: flex; flex-direction: column; gap: 5px; border: 1px solid rgba(148, 163, 184, 0.75); }\n" +
      "    [data-theme=\"dark\"] .social-card { background: rgba(15, 23, 42, 0.98); }\n" +
      "    [data-theme=\"light\"] .social-card { background: rgba(249, 250, 251, 0.98); }\n" +
      "    .social-card-header { display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 12px; font-weight: 500; }\n" +
      "    .social-platform { display: inline-flex; align-items: center; gap: 6px; }\n" +
      "    .textarea.small { min-height: 80px; max-height: 150px; }\n" +
      "    .textarea.tall { min-height: 120px; }\n" +
      "    .textarea.script { min-height: 150px; }\n" +
      "    .textarea.shotplan { min-height: 130px; }\n" +
      "    .tiny-note { font-size: 10px; opacity: 0.75; margin-top: 4px; }\n" +
      "    .loading-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--accent); animation: pulse 1s infinite alternate; display: inline-block; margin-right: 4px; }\n" +
      "    @keyframes pulse { from { transform: scale(1); opacity: 0.8; } to { transform: scale(1.4); opacity: 0.3; } }\n" +
      "\n" +
      "    #editorCanvas {\n" +
      "      width: 100%;\n" +
      "      max-height: 260px;\n" +
      "      border-radius: 12px;\n" +
      "      border: 1px solid rgba(148, 163, 184, 0.75);\n" +
      "      background: rgba(15, 23, 42, 0.4);\n" +
      "    }\n" +
      "    .slider-row {\n" +
      "      display: flex;\n" +
      "      flex-wrap: wrap;\n" +
      "      gap: 10px;\n" +
      "      align-items: center;\n" +
      "      font-size: 11px;\n" +
      "    }\n" +
      "    .slider-row label { display: flex; align-items: center; gap: 4px; }\n" +
      "  </style>\n" +
      "</head>\n" +
      "<body>\n" +
      '  <div class="app-shell">\n' +
      '    <header class="app-header">\n' +
      '      <div class="title-group">\n' +
      '        <div class="logo-pill">🚀</div>\n' +
      "        <div>\n" +
      '          <div class="title-text-main">Lot Rocket</div>\n' +
      '          <div class="title-text-sub">Social Media Kit · Prototype for salespeople, not stores</div>\n' +
      "        </div>\n" +
      "      </div>\n" +
      '      <div class="header-right">\n' +
      '        <div class="chip"><span class="dot"></span><span>AI-ASSISTED COPY · BETA</span></div>\n' +
      '        <button id="themeToggle" class="theme-toggle" type="button">\n' +
      '          <span id="themeIcon">🌙</span>\n' +
      '          <span id="themeLabel">Dark</span>\n' +
      "        </button>\n" +
      "      </div>\n" +
      "    </header>\n" +
      "\n" +
      '    <div class="layout">\n' +
      "      <!-- Left panel -->\n" +
      '      <section class="card">\n' +
      '        <div class="card-header">\n' +
      "          <div>\n" +
      '            <div class="card-title">Step 1 · Dealer URL</div>\n' +
      '            <div class="card-subtitle">Paste a full vehicle detail page. We will pull photos and build the kit.</div>\n' +
      "          </div>\n" +
      '          <span class="badge">INPUT</span>\n' +
      "        </div>\n" +
      "\n" +
      '        <div class="stack-vertical">\n' +
      '          <div class="field-group">\n' +
      '            <label class="field-label" for="vehicleUrl">Dealer vehicle URL</label>\n' +
      '            <input id="vehicleUrl" class="input" placeholder="https://dealer.com/used-YourVehicleHere..." />\n' +
      "          </div>\n" +
      "\n" +
      '          <div class="pill-row">\n' +
      '            <button id="boostButton" class="button-primary" type="button"><span>🚀 Boost This Listing</span></button>\n' +
      '            <span id="statusText" class="status-text">Paste URL, then tap Boost.</span>\n' +
      "          </div>\n" +
      "\n" +
      '          <div class="field-group">\n' +
      '            <label class="field-label" for="vehicleLabel">Vehicle label (editable)</label>\n' +
      '            <input id="vehicleLabel" class="input" placeholder="2024 Chevrolet Blazer 2LT – Plymouth, MI" />\n' +
      "          </div>\n" +
      '          <div class="field-group">\n' +
      '            <label class="field-label" for="priceInfo">Price / deal info (editable)</label>\n' +
      '            <input id="priceInfo" class="input" placeholder="Message for current pricing" />\n' +
      "          </div>\n" +
      "        </div>\n" +
      "\n" +
      '        <div class="stack-vertical">\n' +
      '          <div class="section-title-row">\n' +
      "            <div>\n" +
      '              <div class="card-title">Media Tools</div>\n' +
      '              <div class="card-subtitle">We auto-load dealer photos and turn them into a simple video plan.</div>\n' +
      "            </div>\n" +
      '            <button id="buildVideoButton" class="button-ghost" type="button"><span class="icon">🎬</span><span>Build Video from Photos</span></button>\n' +
      "          </div>\n" +
      "\n" +
      '          <div class="field-group">\n' +
      '            <label class="field-label">Dealer Photos</label>\n' +
      '            <div id="photosGrid" class="photos-grid"></div>\n' +
      '            <div id="photosStatus" class="tiny-note">Photos will auto-load after Boost if we can find them.</div>\n' +
      "          </div>\n" +
      "\n" +
      '          <div class="field-group">\n' +
      '            <label class="field-label" for="videoPlan">Video From Photos Plan</label>\n' +
      '            <textarea id="videoPlan" class="textarea shotplan" placeholder="Hit \\'Build Video from Photos\\' to get a simple shot list for Reels / TikTok." readonly></textarea>\n' +
      "          </div>\n" +
      "\n" +
      '          <div class="field-group">\n' +
      '            <label class="field-label">Photo Editor (basic)</label>\n' +
      '            <div class="card-subtitle">Click a photo above to load it here, adjust, then download.</div>\n' +
      '            <canvas id="editorCanvas"></canvas>\n' +
      '            <div class="slider-row" style="margin-top:6px;">\n' +
      '              <label>Brightness <input type="range" id="brightnessSlider" min="-50" max="50" value="0" /></label>\n' +
      '              <label>Contrast <input type="range" id="contrastSlider" min="-50" max="50" value="0" /></label>\n' +
      "            </div>\n" +
      '            <div class="pill-row" style="margin-top:4px;">\n' +
      '              <button id="resetPhotoButton" class="button-ghost" type="button"><span>Reset</span></button>\n' +
      '              <button id="downloadPhotoButton" class="button-ghost" type="button"><span>Download edited</span></button>\n' +
      "            </div>\n" +
      '            <div class="tiny-note">Note: some dealer sites may block downloading edited images because of browser security rules.</div>\n' +
      "          </div>\n" +
      "        </div>\n" +
      "      </section>\n" +
      "\n" +
      "      <!-- Right panel -->\n" +
      '      <section class="card">\n' +
      '        <div class="card-header">\n' +
      "          <div>\n" +
      '            <div class="card-title">Step 2 · Social Kit</div>\n' +
      '            <div class="card-subtitle">Copy, tweak, and paste into each platform. Spin fresh versions anytime.</div>\n' +
      "          </div>\n" +
      '          <span class="badge">OUTPUT</span>\n' +
      "        </div>\n" +
      "\n" +
      '        <div class="stack-vertical">\n' +
      '          <div class="field-group">\n' +
      '            <label class="field-label">Listing Summary</label>\n' +
      '            <div class="pill-row">\n' +
      '              <span id="summaryLabel" class="pill">No vehicle yet</span>\n' +
      '              <span id="summaryPrice" class="pill">—</span>\n' +
      "            </div>\n" +
      "          </div>\n" +
      '\n' +
      '          <div class="field-group">\n' +
      '            <label class="field-label">Social Media Posts</label>\n' +
      '            <div class="card-subtitle">Each box is ready-to-use. Hit “New Post” to spin a fresh version for that platform.</div>\n' +
      "          </div>\n" +
      "\n" +
      '          <div class="social-grid">\n' +
      "            <!-- Facebook -->\n" +
      '            <div class="social-card">\n' +
      '              <div class="social-card-header">\n' +
      '                <div class="social-platform">📘 Facebook</div>\n' +
      '                <button data-platform="facebook" class="button-ghost button-new-post" type="button"><span class="icon">🔁</span><span>New Post</span></button>\n' +
      "              </div>\n" +
      '              <textarea id="facebookPost" class="textarea small" readonly></textarea>\n' +
      "            </div>\n" +
      "            <!-- Instagram -->\n" +
      '            <div class="social-card">\n' +
      '              <div class="social-card-header">\n' +
      '                <div class="social-platform">📸 Instagram</div>\n' +
      '                <button data-platform="instagram" class="button-ghost button-new-post" type="button"><span class="icon">🔁</span><span>New Post</span></button>\n' +
      "              </div>\n" +
      '              <textarea id="instagramPost" class="textarea small" readonly></textarea>\n' +
      "            </div>\n" +
      "            <!-- TikTok -->\n" +
      '            <div class="social-card">\n' +
      '              <div class="social-card-header">\n' +
      '                <div class="social-platform">🎵 TikTok</div>\n' +
      '                <button data-platform="tiktok" class="button-ghost button-new-post" type="button"><span class="icon">🔁</span><span>New Post</span></button>\n' +
      "              </div>\n" +
      '              <textarea id="tiktokPost" class="textarea small" readonly></textarea>\n' +
      "            </div>\n" +
      "            <!-- LinkedIn -->\n" +
      '            <div class="social-card">\n' +
      '              <div class="social-card-header">\n' +
      '                <div class="social-platform">💼 LinkedIn</div>\n' +
      '                <button data-platform="linkedin" class="button-ghost button-new-post" type="button"><span class="icon">🔁</span><span>New Post</span></button>\n' +
      "              </div>\n" +
      '              <textarea id="linkedinPost" class="textarea small" readonly></textarea>\n' +
      "            </div>\n" +
      "            <!-- X / Twitter -->\n" +
      '            <div class="social-card">\n' +
      '              <div class="social-card-header">\n' +
      '                <div class="social-platform">🐦 X / Twitter</div>\n' +
      '                <button data-platform="twitter" class="button-ghost button-new-post" type="button"><span class="icon">🔁</span><span>New Post</span></button>\n' +
      "              </div>\n" +
      '              <textarea id="twitterPost" class="textarea small" readonly></textarea>\n' +
      "            </div>\n" +
      "            <!-- Text / DM -->\n" +
      '            <div class="social-card">\n' +
      '              <div class="social-card-header">\n' +
      '                <div class="social-platform">💬 Text / DM</div>\n' +
      '                <button data-platform="text" class="button-ghost button-new-post" type="button"><span class="icon">🔁</span><span>New Text</span></button>\n' +
      "              </div>\n" +
      '              <textarea id="textBlurb" class="textarea small" readonly></textarea>\n' +
      "            </div>\n" +
      "            <!-- Marketplace -->\n" +
      '            <div class="social-card">\n' +
      '              <div class="social-card-header">\n' +
      '                <div class="social-platform">🛒 Marketplace</div>\n' +
      '                <button data-platform="marketplace" class="button-ghost button-new-post" type="button"><span class="icon">🔁</span><span>New Post</span></button>\n' +
      "              </div>\n" +
      '              <textarea id="marketplacePost" class="textarea tall" readonly></textarea>\n' +
      "            </div>\n" +
      "            <!-- Hashtags -->\n" +
      '            <div class="social-card">\n' +
      '              <div class="social-card-header">\n' +
      '                <div class="social-platform">🏷 Hashtags</div>\n' +
      '                <button data-platform="hashtags" class="button-ghost button-new-post" type="button"><span class="icon">🔁</span><span>New Tags</span></button>\n' +
      "              </div>\n" +
      '              <textarea id="hashtags" class="textarea small" readonly></textarea>\n' +
      "            </div>\n" +
      "          </div>\n" +
      "\n" +
      '          <div class="field-group">\n' +
      '            <div class="section-title-row">\n' +
      '              <label class="field-label">Video Engine (script + plan only)</label>\n' +
      '              <button id="newScriptButton" class="button-ghost" type="button"><span class="icon">🔁</span><span>New Script</span></button>\n' +
      "            </div>\n" +
      '            <div class="card-subtitle">Script + shot plan you can read on camera and follow for Reels, TikTok, Shorts, or Facebook Reels. This does not create an actual video file.</div>\n' +
      "          </div>\n" +
      "\n" +
      '          <div class="field-group">\n' +
      '            <label class="field-label" for="videoScript">Viral Video Script</label>\n' +
      '            <textarea id="videoScript" class="textarea script" readonly></textarea>\n' +
      "          </div>\n" +
      '          <div class="field-group">\n' +
      '            <label class="field-label" for="shotPlan">Viral Visual Shot Plan</label>\n' +
      '            <textarea id="shotPlan" class="textarea shotplan" readonly></textarea>\n' +
      "          </div>\n" +
      '          <div class="tiny-note">Prototype for salespeople. Copy, tweak, and make it yours. 🚀</div>\n' +
      "        </div>\n" +
      "      </section>\n" +
      "    </div>\n" +
      "  </div>\n" +
      "\n" +
      "  <script>\n" +
      "    const apiBase = '';\n" +
      "\n" +
      "    const vehicleUrlInput = document.getElementById('vehicleUrl');\n" +
      "    const vehicleLabelInput = document.getElementById('vehicleLabel');\n" +
      "    const priceInfoInput = document.getElementById('priceInfo');\n" +
      "    const boostButton = document.getElementById('boostButton');\n" +
      "    const statusText = document.getElementById('statusText');\n" +
      "    const summaryLabel = document.getElementById('summaryLabel');\n" +
      "    const summaryPrice = document.getElementById('summaryPrice');\n" +
      "    const facebookPost = document.getElementById('facebookPost');\n" +
      "    const instagramPost = document.getElementById('instagramPost');\n" +
      "    const tiktokPost = document.getElementById('tiktokPost');\n" +
      "    const linkedinPost = document.getElementById('linkedinPost');\n" +
      "    const twitterPost = document.getElementById('twitterPost');\n" +
      "    const textBlurb = document.getElementById('textBlurb');\n" +
      "    const marketplacePost = document.getElementById('marketplacePost');\n" +
      "    const hashtags = document.getElementById('hashtags');\n" +
      "    const videoScript = document.getElementById('videoScript');\n" +
      "    const shotPlan = document.getElementById('shotPlan');\n" +
      "    const buildVideoButton = document.getElementById('buildVideoButton');\n" +
      "    const photosGrid = document.getElementById('photosGrid');\n" +
      "    const photosStatus = document.getElementById('photosStatus');\n" +
      "    const videoPlan = document.getElementById('videoPlan');\n" +
      "    const newScriptButton = document.getElementById('newScriptButton');\n" +
      "    const themeToggle = document.getElementById('themeToggle');\n" +
      "    const themeIcon = document.getElementById('themeIcon');\n" +
      "    const themeLabel = document.getElementById('themeLabel');\n" +
      "    const editorCanvas = document.getElementById('editorCanvas');\n" +
      "    const brightnessSlider = document.getElementById('brightnessSlider');\n" +
      "    const contrastSlider = document.getElementById('contrastSlider');\n" +
      "    const resetPhotoButton = document.getElementById('resetPhotoButton');\n" +
      "    const downloadPhotoButton = document.getElementById('downloadPhotoButton');\n" +
      "\n" +
      "    let currentPhotos = [];\n" +
      "    let currentUrl = '';\n" +
      "    let isBoosting = false;\n" +
      "    let editorCtx = editorCanvas.getContext('2d');\n" +
      "    let originalImageData = null;\n" +
      "\n" +
      "    function applyTheme(theme) {\n" +
      "      const root = document.documentElement;\n" +
      "      root.setAttribute('data-theme', theme);\n" +
      "      if (theme === 'dark') {\n" +
      "        themeIcon.textContent = '🌙';\n" +
      "        themeLabel.textContent = 'Dark';\n" +
      "      } else {\n" +
      "        themeIcon.textContent = '☀️';\n" +
      "        themeLabel.textContent = 'Light';\n" +
      "      }\n" +
      "      localStorage.setItem('lotRocketTheme', theme);\n" +
      "    }\n" +
      "    function initTheme() {\n" +
      "      const saved = localStorage.getItem('lotRocketTheme');\n" +
      "      if (saved === 'light' || saved === 'dark') applyTheme(saved);\n" +
      "      else applyTheme('dark');\n" +
      "    }\n" +
      "    themeToggle.addEventListener('click', function () {\n" +
      "      const current = document.documentElement.getAttribute('data-theme') || 'dark';\n" +
      "      const next = current === 'dark' ? 'light' : 'dark';\n" +
      "      applyTheme(next);\n" +
      "    });\n" +
      "    initTheme();\n" +
      "\n" +
      "    function setStatus(text, isLoading) {\n" +
      "      if (isLoading) {\n" +
      "        statusText.innerHTML = '<span class=\"loading-dot\"></span>' + text;\n" +
      "      } else {\n" +
      "        statusText.textContent = text;\n" +
      "      }\n" +
      "    }\n" +
      "    function safeTrim(str) { return (str || '').toString().trim(); }\n" +
      "    function updateSummary(label, price) {\n" +
      "      summaryLabel.textContent = safeTrim(label) || 'Vehicle ready';\n" +
      "      summaryPrice.textContent = safeTrim(price) || 'Message for current pricing';\n" +
      "    }\n" +
      "    function fillSocialKit(kit) {\n" +
      "      facebookPost.value = kit.facebook || '';\n" +
      "      instagramPost.value = kit.instagram || '';\n" +
      "      tiktokPost.value = kit.tiktok || '';\n" +
      "      linkedinPost.value = kit.linkedin || '';\n" +
      "      twitterPost.value = kit.twitter || '';\n" +
      "      textBlurb.value = kit.textBlurb || '';\n" +
      "      marketplacePost.value = kit.marketplace || '';\n" +
      "      hashtags.value = kit.hashtags || '';\n" +
      "      videoScript.value = kit.videoScript || '';\n" +
      "      shotPlan.value = kit.shotPlan || '';\n" +
      "    }\n" +
      "    function renderPhotosGrid(photos) {\n" +
      "      photosGrid.innerHTML = '';\n" +
      "      if (!photos || !photos.length) {\n" +
      "        photosStatus.textContent = 'No photos found yet.';\n" +
      "        return;\n" +
      "      }\n" +
      "      photos.forEach(function (url) {\n" +
      "        const wrapper = document.createElement('div');\n" +
      "        wrapper.className = 'photo-thumb';\n" +
      "        const img = document.createElement('img');\n" +
      "        img.src = url;\n" +
      "        img.alt = 'Vehicle photo';\n" +
      "        wrapper.appendChild(img);\n" +
      "        wrapper.addEventListener('click', function () {\n" +
      "          loadPhotoIntoEditor(url);\n" +
      "        });\n" +
      "        photosGrid.appendChild(wrapper);\n" +
      "      });\n" +
      "      photosStatus.textContent = photos.length + ' photos found. Click any to open in the editor below.';\n" +
      "    }\n" +
      "    async function callJson(endpoint, body) {\n" +
      "      const res = await fetch(apiBase + endpoint, {\n" +
      "        method: 'POST',\n" +
      "        headers: { 'Content-Type': 'application/json' },\n" +
      "        body: JSON.stringify(body || {})\n" +
      "      });\n" +
      "      if (!res.ok) {\n" +
      "        const txt = await res.text().catch(function () { return ''; });\n" +
      "        throw new Error('Request failed: ' + res.status + ' ' + txt);\n" +
      "      }\n" +
      "      return res.json();\n" +
      "    }\n" +
      "\n" +
      "    async function handleBoost() {\n" +
      "      if (isBoosting) return;\n" +
      "      const url = safeTrim(vehicleUrlInput.value);\n" +
      "      if (!url) { alert('Paste a dealer vehicle URL first.'); return; }\n" +
      "\n" +
      "      let label = safeTrim(vehicleLabelInput.value);\n" +
      "      if (!label) { label = 'This vehicle'; vehicleLabelInput.value = label; }\n" +
      "      let price = safeTrim(priceInfoInput.value);\n" +
      "      if (!price) { price = 'Message for current pricing'; priceInfoInput.value = price; }\n" +
      "\n" +
      "      isBoosting = true;\n" +
      "      boostButton.disabled = true;\n" +
      "      setStatus('Building social kit with AI…', true);\n" +
      "\n" +
      "      try {\n" +
      "        currentUrl = url;\n" +
      "        const resp = await callJson('/api/social-kit', { url: url, label: label, price: price });\n" +
      "        if (!resp.success) throw new Error('API returned error');\n" +
      "        fillSocialKit(resp.kit || {});\n" +
      "        updateSummary(label, price);\n" +
      "        setStatus('Social kit ready. You can spin new posts or scripts anytime.', false);\n" +
      "\n" +
      "        try {\n" +
      "          photosStatus.textContent = 'Trying to grab photos from dealer page…';\n" +
      "          const photoResp = await callJson('/api/grab-photos', { url: url });\n" +
      "          if (photoResp.success) {\n" +
      "            currentPhotos = photoResp.photos || [];\n" +
      "            renderPhotosGrid(currentPhotos);\n" +
      "          } else {\n" +
      "            photosStatus.textContent = 'Could not grab photos automatically.';\n" +
      "          }\n" +
      "        } catch (errPhoto) {\n" +
      "          console.error('Auto photo grab failed:', errPhoto);\n" +
      "          photosStatus.textContent = 'Auto photo load failed.';\n" +
      "        }\n" +
      "      } catch (err) {\n" +
      "        console.error(err);\n" +
      "        setStatus('Something went wrong. Try again or check the URL.', false);\n" +
      "        alert('Error building social kit. Check the URL and try again.');\n" +
      "      } finally {\n" +
      "        isBoosting = false;\n" +
      "        boostButton.disabled = false;\n" +
      "      }\n" +
      "    }\n" +
      "    boostButton.addEventListener('click', handleBoost);\n" +
      "\n" +
      "    document.querySelectorAll('.button-new-post').forEach(function (btn) {\n" +
      "      btn.addEventListener('click', async function () {\n" +
      "        const platform = btn.getAttribute('data-platform');\n" +
      "        const url = safeTrim(vehicleUrlInput.value);\n" +
      "        const label = safeTrim(vehicleLabelInput.value);\n" +
      "        const price = safeTrim(priceInfoInput.value);\n" +
      "        if (!url || !label) { alert('Please paste a URL and hit Boost at least once before spinning posts.'); return; }\n" +
      "        btn.disabled = true;\n" +
      "        const oldText = btn.innerHTML;\n" +
      "        btn.innerHTML = '<span class=\"icon\">⏳</span><span>Working…</span>';\n" +
      "        try {\n" +
      "          const resp = await callJson('/api/new-post', { platform: platform, url: url, label: label, price: price });\n" +
      "          if (!resp.success) throw new Error('API returned error');\n" +
      "          const text = resp.post || '';\n" +
      "          if (platform === 'facebook') facebookPost.value = text;\n" +
      "          else if (platform === 'instagram') instagramPost.value = text;\n" +
      "          else if (platform === 'tiktok') tiktokPost.value = text;\n" +
      "          else if (platform === 'linkedin') linkedinPost.value = text;\n" +
      "          else if (platform === 'twitter') twitterPost.value = text;\n" +
      "          else if (platform === 'text') textBlurb.value = text;\n" +
      "          else if (platform === 'marketplace') marketplacePost.value = text;\n" +
      "          else if (platform === 'hashtags') hashtags.value = text;\n" +
      "        } catch (err) {\n" +
      "          console.error(err);\n" +
      "          alert('Error generating a new post. Try again.');\n" +
      "        } finally {\n" +
      "          btn.disabled = false;\n" +
      "          btn.innerHTML = oldText;\n" +
      "        }\n" +
      "      });\n" +
      "    });\n" +
      "\n" +
      "    newScriptButton.addEventListener('click', async function () {\n" +
      "      const url = safeTrim(vehicleUrlInput.value);\n" +
      "      const label = safeTrim(vehicleLabelInput.value);\n" +
      "      const price = safeTrim(priceInfoInput.value);\n" +
      "      if (!url || !label) { alert('Please paste a URL and hit Boost at least once before spinning scripts.'); return; }\n" +
      "      newScriptButton.disabled = true;\n" +
      "      const oldText = newScriptButton.innerHTML;\n" +
      "      newScriptButton.innerHTML = '<span class=\"icon\">⏳</span><span>Working…</span>';\n" +
      "      try {\n" +
      "        const resp = await callJson('/api/new-script', { url: url, label: label, price: price });\n" +
      "        if (!resp.success) throw new Error('API error');\n" +
      "        videoScript.value = resp.script || '';\n" +
      "      } catch (err) {\n" +
      "        console.error(err);\n" +
      "        alert('Error generating a new script. Try again.');\n" +
      "      } finally {\n" +
      "        newScriptButton.disabled = false;\n" +
      "        newScriptButton.innerHTML = oldText;\n" +
      "      }\n" +
      "    });\n" +
      "\n" +
      "    buildVideoButton.addEventListener('click', async function () {\n" +
      "      if (!currentPhotos || !currentPhotos.length) { alert('No photos yet. Boost first so we can grab photos.'); return; }\n" +
      "      buildVideoButton.disabled = true;\n" +
      "      const oldText = buildVideoButton.innerHTML;\n" +
      "      buildVideoButton.innerHTML = '<span class=\"icon\">⏳</span><span>Building…</span>';\n" +
      "      try {\n" +
      "        const label = safeTrim(vehicleLabelInput.value) || 'this vehicle';\n" +
      "        const resp = await callJson('/api/video-from-photos', { photos: currentPhotos, label: label });\n" +
      "        if (!resp.success) throw new Error('API error');\n" +
      "        videoPlan.value = resp.plan || '';\n" +
      "      } catch (err) {\n" +
      "        console.error(err);\n" +
      "        alert('Error building video plan. Try again.');\n" +
      "      } finally {\n" +
      "        buildVideoButton.disabled = false;\n" +
      "        buildVideoButton.innerHTML = oldText;\n" +
      "      }\n" +
      "    });\n" +
      "\n" +
      "    function loadPhotoIntoEditor(url) {\n" +
      "      const img = new Image();\n" +
      "      img.crossOrigin = 'anonymous';\n" +
      "      img.onload = function () {\n" +
      "        const maxWidth = editorCanvas.clientWidth || 400;\n" +
      "        const scale = img.width > maxWidth ? maxWidth / img.width : 1;\n" +
      "        const w = img.width * scale;\n" +
      "        const h = img.height * scale;\n" +
      "        editorCanvas.width = w;\n" +
      "        editorCanvas.height = h;\n" +
      "        editorCtx.drawImage(img, 0, 0, w, h);\n" +
      "        originalImageData = editorCtx.getImageData(0, 0, w, h);\n" +
      "        brightnessSlider.value = '0';\n" +
      "        contrastSlider.value = '0';\n" +
      "      };\n" +
      "      img.onerror = function () {\n" +
      "        alert('Could not load this photo into the editor.');\n" +
      "      };\n" +
      "      img.src = url;\n" +
      "    }\n" +
      "\n" +
      "    function applyImageAdjustments() {\n" +
      "      if (!originalImageData) return;\n" +
      "      const brightness = parseInt(brightnessSlider.value || '0', 10);\n" +
      "      const contrastVal = parseInt(contrastSlider.value || '0', 10);\n" +
      "      const data = new Uint8ClampedArray(originalImageData.data);\n" +
      "      const factor = (259 * (contrastVal + 255)) / (255 * (259 - contrastVal));\n" +
      "      for (let i = 0; i < data.length; i += 4) {\n" +
      "        for (let c = 0; c < 3; c++) {\n" +
      "          let v = data[i + c];\n" +
      "          v = v + brightness;\n" +
      "          v = factor * (v - 128) + 128;\n" +
      "          if (v < 0) v = 0;\n" +
      "          if (v > 255) v = 255;\n" +
      "          data[i + c] = v;\n" +
      "        }\n" +
      "      }\n" +
      "      const out = new ImageData(data, originalImageData.width, originalImageData.height);\n" +
      "      editorCtx.putImageData(out, 0, 0);\n" +
      "    }\n" +
      "\n" +
      "    brightnessSlider.addEventListener('input', applyImageAdjustments);\n" +
      "    contrastSlider.addEventListener('input', applyImageAdjustments);\n" +
      "\n" +
      "    resetPhotoButton.addEventListener('click', function () {\n" +
      "      if (!originalImageData) return;\n" +
      "      editorCtx.putImageData(originalImageData, 0, 0);\n" +
      "      brightnessSlider.value = '0';\n" +
      "      contrastSlider.value = '0';\n" +
      "    });\n" +
      "\n" +
      "    downloadPhotoButton.addEventListener('click', function () {\n" +
      "      if (!editorCanvas.width || !editorCanvas.height) { alert('Load a photo first by clicking one of the thumbnails.'); return; }\n" +
      "      const link = document.createElement('a');\n" +
      "      link.download = 'lot-rocket-edited.jpg';\n" +
      "      link.href = editorCanvas.toDataURL('image/jpeg', 0.9);\n" +
      "      link.click();\n" +
      "    });\n" +
      "  </script>\n" +
      "</body>\n" +
      "</html>\n"
  );
});

// ---------------- Start server ----------------

app.listen(port, () => {
  console.log("Lot Rocket server running on port " + port);
});
