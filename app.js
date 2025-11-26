// app.js – Lot Rocket Social Media Kit (single file, 2-column posts + big logo)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// ----------------- Helper: scrape photos -----------------

async function scrapeVehiclePhotos(pageUrl) {
  try {
    const res = await fetch(pageUrl);
    if (!res.ok) {
      console.error('Failed to fetch page for photos:', res.status);
      return [];
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const urls = new Set();
    const base = new URL(pageUrl);

    $('img').each((i, el) => {
      let src = $(el).attr('data-src') || $(el).attr('src');
      if (!src) return;

      if (src.startsWith('//')) {
        src = 'https:' + src;
      } else if (src.startsWith('/')) {
        src = base.origin + src;
      } else if (!src.startsWith('http')) {
        src = base.origin + (src.startsWith('/') ? src : '/' + src);
      }

      const lower = src.toLowerCase();
      if (
        lower.includes('logo') ||
        lower.includes('icon') ||
        lower.includes('badge') ||
        lower.includes('spinner') ||
        lower.includes('placeholder')
      ) {
        return;
      }

      urls.add(src);
    });

    return Array.from(urls).slice(0, 40);
  } catch (err) {
    console.error('Error scraping photos:', err);
    return [];
  }
}

// ----------------- Prompt builders -----------------

function buildSocialKitPrompt({ label, price, url }) {
  return `
You are helping a car salesperson create a social media content kit for a single vehicle.

Vehicle label (how we’ll refer to it in the copy):
"${label}"

Pricing / deal info as a short phrase:
"${price || 'Message for current pricing'}"

Dealer vehicle URL:
${url}

Goal:
Write copy that is READY TO COPY/PASTE for each platform. It should feel like high-converting, thumb-stopping content a strong salesperson would actually post.

Tone:
- Confident, honest, direct
- Feels human, not corporate
- Has energy and modern vibe, with emojis and hooks
- No cringe, but it CAN be hype and attention-grabbing

IMPORTANT:
- Use clear line breaks so it looks exactly like a social post when pasted.
- Each field must be under ~900 characters.
- Do NOT mention “template”, “JSON”, or “field”.
- No backticks in the output.

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

Platform styles:

facebook:
- Strong hook in all caps or with emojis at top (e.g. "🔥 STOP SCROLLING. THIS IS THE ONE.")
- 2–3 short paragraphs + 5–10 short benefit bullets using emojis.
- Clear CTA with “Comment or DM ‘INFO’…” at bottom.

instagram:
- Similar to facebook but slightly more “vibe”.
- 3–6 short benefit lines, each starting with an emoji.
- CTA with “DM ‘INFO’…” at the end.

tiktok:
- Feels like captions for a vertical video.
- Hook about “if this showed up on your feed…”.
- 5–8 short lines.
- Strong urgency and DM CTA at bottom.

linkedin:
- Professional but still human.
- Talks about how the vehicle fits work + family life.
- 2–4 short paragraphs + simple CTA.

twitter:
- 1–3 short lines with a simple CTA.
- Include some hashtags inline.

textBlurb:
- 1–3 very short lines, perfect for SMS or DMs.
- Example: “Just pulled a [vehicle]. It’s [deal phrase]. Want a quick walkaround video?”

marketplace:
- Perfect for Facebook Marketplace description.
- Start with a plain sentence (no emojis in the first line).
- Include bullet-style value points.
- End with “If it’s listed, it’s available – for now.” style CTA.

hashtags:
- Single line of 8–15 simple hashtags.
- Mostly lowercase.
- Example: #carsforsale #carshopping #usedcars #cityname #dealername

videoScript:
- 30–40 second script, in natural spoken language.
- 4–7 short paragraphs separated by blank lines.
- Hook, benefit content, and strong CTA (DM “INFO”, schedule a test drive, etc.).
- No labels like “HOOK” or “CTA” – just the script.

shotPlan:
- 5–10 bullet points.
- Each bullet describes one shot for Reels / TikTok / Shorts.
- Mention shots like “front 3/4”, “interior tech”, “cargo space”, “you on camera with CTA”.
`;
}

function buildSinglePostPrompt({ platform, label, price, url }) {
  return `
You are writing a fresh, copy-and-paste-ready social post for a car salesperson.

Platform: ${platform}
Vehicle: "${label}"
Deal phrase: "${price || 'Message for current pricing'}"
Vehicle URL: ${url}

Rules:
- Output MUST be exactly what they will paste into the app. No explanations.
- Preserve line breaks so it looks like a real post.
- Use emojis and strong hooks for facebook/instagram/tiktok.
- Use clear CTA (comment or DM “INFO”, message me, schedule a test drive, etc.).
- Do NOT include hashtags (we handle them separately) except for "twitter" where a few are okay.
- No backticks, no meta comments.

Length:
- facebook / instagram / linkedin / marketplace: 4–10 short lines.
- tiktok: 5–10 short lines.
- twitter: 1–3 short lines.
- text: 1–3 very short lines (perfect for SMS/DM).

Return ONLY the post text.`;
}

function buildVideoScriptPrompt({ label, price, url }) {
  return `
Write a 30–40 second vertical video script a car salesperson can read on camera.

Vehicle: "${label}"
Deal phrase: "${price || 'Message for current pricing'}"
Vehicle URL: ${url}

Format:
- 4–7 short paragraphs separated by blank lines.
- No labels like HOOK / CTA, just natural sentences.
- Talk like a confident salesperson: clear, upbeat, no cringe.
- Include a strong CTA at the end (DM “INFO”, message me, or book a test drive).

Return ONLY the script text. No extra commentary.`;
}

// ----------------- OpenAI helpers (Responses API) -----------------

async function callOpenAIForJSON(prompt) {
  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: prompt,
  });

  const text = response.output_text || '';
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse JSON from model:', text);
    throw err;
  }
}

async function callOpenAIForText(prompt) {
  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: prompt,
  });

  return (response.output_text || '').trim();
}

// ----------------- API routes -----------------

app.post('/api/social-kit', async (req, res) => {
  try {
    const { url, label, price } = req.body;
    if (!url || !label) {
      return res.status(400).json({ success: false, error: 'Missing url or label' });
    }

    const prompt = buildSocialKitPrompt({ url, label, price });
    const kit = await callOpenAIForJSON(prompt);

    res.json({ success: true, kit });
  } catch (err) {
    console.error('Error in /api/social-kit:', err);
    res.status(500).json({ success: false, error: 'Failed to generate social kit' });
  }
});

app.post('/api/new-post', async (req, res) => {
  try {
    const { platform, label, price, url } = req.body;
    if (!platform || !label) {
      return res.status(400).json({ success: false, error: 'Missing platform or label' });
    }
    const prompt = buildSinglePostPrompt({ platform, label, price, url });
    const post = await callOpenAIForText(prompt);

    res.json({ success: true, post });
  } catch (err) {
    console.error('Error in /api/new-post:', err);
    res.status(500).json({ success: false, error: 'Failed to generate new post' });
  }
});

app.post('/api/new-script', async (req, res) => {
  try {
    const { label, price, url } = req.body;
    if (!label || !url) {
      return res.status(400).json({ success: false, error: 'Missing label or url' });
    }
    const prompt = buildVideoScriptPrompt({ label, price, url });
    const script = await callOpenAIForText(prompt);

    res.json({ success: true, script });
  } catch (err) {
    console.error('Error in /api/new-script:', err);
    res.status(500).json({ success: false, error: 'Failed to generate video script' });
  }
});

app.post('/api/grab-photos', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Missing url' });
    }
    const photos = await scrapeVehiclePhotos(url);
    res.json({ success: true, photos });
  } catch (err) {
    console.error('Error in /api/grab-photos:', err);
    res.status(500).json({ success: false, error: 'Failed to grab photos' });
  }
});

app.post('/api/video-from-photos', async (req, res) => {
  try {
    const { photos, label } = req.body;
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ success: false, error: 'No photos provided' });
    }

    const total = photos.length;
    const mid = Math.floor(total / 2);
    const last = total - 1;

    const planLines = [
      `Clip 1 – Photo 1 – 3–4 seconds\nOn-screen text: "${label}"`,
      total > 4 ? 'Clip 2 – Photo 4 – 3 seconds' : '',
      total > 8 ? 'Clip 3 – Photo 8 – 3 seconds' : '',
      `Clip 4 – Photo ${mid + 1} – 3–4 seconds\nOn-screen text: "Interior & tech"`,
      total > 6 ? `Clip 5 – Photo ${Math.min(mid + 3, last + 1)} – 3 seconds` : '',
      `Clip 6 – Photo ${last + 1} – 3 seconds\nOn-screen text: "DM 'INFO' for details"`,
      'Recommended music: upbeat, confident track that fits Reels / TikTok.',
    ].filter(Boolean);

    res.json({ success: true, plan: planLines.join('\n\n') });
  } catch (err) {
    console.error('Error in /api/video-from-photos:', err);
    res.status(500).json({ success: false, error: 'Failed to build video plan' });
  }
});

// ----------------- Front-end HTML -----------------

app.get('/', (req, res) => {
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
      --accent: #d32525;
      --accent-soft: rgba(211, 37, 37, 0.15);
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
      gap: 16px;
    }

    /* Logo like your image: big circle with LR + script inside */
    .logo-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-circle {
      width: 96px;
      height: 96px;
      border-radius: 999px;
      border: 3px solid #b91c1c;
      position: relative;
      background: #fdfdfd;
      box-shadow: 0 0 0 1px rgba(15,23,42,0.18);
    }

    .logo-LR {
      position: absolute;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      font-family: "Georgia", "Times New Roman", serif;
      font-size: 52px;
      font-weight: 700;
      color: #b91c1c;
      line-height: 1;
    }

    .logo-script {
      position: absolute;
      bottom: 12%;
      left: 50%;
      transform: translateX(-50%);
      font-family: "Georgia", "Times New Roman", serif;
      font-size: 16px;
      color: #b91c1c;
      font-style: italic;
      white-space: nowrap;
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
      white-space: pre-wrap;
    }

    .textarea {
      min-height: 90px;
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
      background: linear-gradient(135deg, #fb923c, #b91c1c);
      color: #fff;
      box-shadow: 0 14px 30px rgba(185, 28, 28, 0.7);
    }
    [data-theme="light"] .button-primary {
      background: linear-gradient(135deg, #f97316, #b91c1c);
      color: #fff;
      box-shadow: 0 12px 26px rgba(220, 38, 38, 0.6);
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

    /* SOCIAL GRID – rows of 2 long boxes */
    .social-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    @media (max-width: 1000px) {
      .social-grid {
        grid-template-columns: minmax(0, 1fr);
      }
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

    .textarea.social {
      min-height: 210px;
      max-height: 260px;
      font-size: 13px;
      line-height: 1.4;
      padding-top: 8px;
    }

    .textarea.script {
      min-height: 160px;
    }

    .textarea.shotplan,
    #videoPlan {
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
        <div class="logo-wrapper">
          <div class="logo-circle">
            <div class="logo-LR">LR</div>
            <div class="logo-script">Lot Rocket</div>
          </div>
        </div>
        <div>
          <div class="title-text-main">Social Media Kit</div>
          <div class="title-text-sub">Prototype for salespeople, not stores</div>
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
      <!-- Left: URL + media -->
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
              <div class="card-subtitle">Dealer photos + simple video plan. Photo editor and real video builder coming next.</div>
            </div>
          </div>

          <div class="pill-row">
            <button id="buildVideoButton" class="button-ghost" type="button">
              <span class="icon">🎬</span><span>Build Video Plan from Photos</span>
            </button>
          </div>

          <div class="field-group">
            <label class="field-label">Dealer Photos</label>
            <div id="photosGrid" class="photos-grid"></div>
            <div id="photosStatus" class="tiny-note">Photos will auto-load after Boost if we can find them on the dealer page.</div>
          </div>

          <div class="field-group">
            <label class="field-label" for="videoPlan">Video From Photos Plan</label>
            <textarea id="videoPlan" class="textarea shotplan" placeholder="Hit 'Build Video Plan from Photos' after Boost to get a simple shot list." readonly></textarea>
          </div>
        </div>
      </section>

      <!-- Right: Social kit -->
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
              Each box is full-length and ready to paste. Hit “New Post” to spin a fresh version for that platform.
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
              <textarea id="facebookPost" class="textarea social" readonly></textarea>
            </div>

            <!-- Instagram -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">📸 Instagram</div>
                <button data-platform="instagram" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="instagramPost" class="textarea social" readonly></textarea>
            </div>

            <!-- TikTok -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🎵 TikTok</div>
                <button data-platform="tiktok" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="tiktokPost" class="textarea social" readonly></textarea>
            </div>

            <!-- LinkedIn -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">💼 LinkedIn</div>
                <button data-platform="linkedin" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="linkedinPost" class="textarea social" readonly></textarea>
            </div>

            <!-- X / Twitter -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🐦 X / Twitter</div>
                <button data-platform="twitter" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="twitterPost" class="textarea social" readonly></textarea>
            </div>

            <!-- Text / DM -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">💬 Text / DM</div>
                <button data-platform="text" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Text</span>
                </button>
              </div>
              <textarea id="textBlurb" class="textarea social" readonly></textarea>
            </div>

            <!-- Marketplace -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🛒 Marketplace</div>
                <button data-platform="marketplace" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="marketplacePost" class="textarea social" readonly></textarea>
            </div>

            <!-- Hashtags -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🏷 Hashtags</div>
                <button data-platform="hashtags" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Tags</span>
                </button>
              </div>
              <textarea id="hashtags" class="textarea social" readonly></textarea>
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
            Prototype for salespeople. Copy, tweak, and make it yours. 🚀 Photo editor + real video builder coming soon.
          </div>
        </div>
      </section>
    </div>
  </div>

  <script>
    const apiBase = '';

    const vehicleUrlInput = document.getElementById('vehicleUrl');
    const vehicleLabelInput = document.getElementById('vehicleLabel');
    const priceInfoInput = document.getElementById('priceInfo');
    const boostButton = document.getElementById('boostButton');
    const statusText = document.getElementById('statusText');

    const summaryLabel = document.getElementById('summaryLabel');
    const summaryPrice = document.getElementById('summaryPrice');

    const facebookPost = document.getElementById('facebookPost');
    const instagramPost = document.getElementById('instagramPost');
    const tiktokPost = document.getElementById('tiktokPost');
    const linkedinPost = document.getElementById('linkedinPost');
    const twitterPost = document.getElementById('twitterPost');
    const textBlurb = document.getElementById('textBlurb');
    const marketplacePost = document.getElementById('marketplacePost');
    const hashtags = document.getElementById('hashtags');
    const videoScript = document.getElementById('videoScript');
    const shotPlan = document.getElementById('shotPlan');

    const buildVideoButton = document.getElementById('buildVideoButton');
    const photosGrid = document.getElementById('photosGrid');
       const photosStatus = document.getElementById('photosStatus');
    const videoPlan = document.getElementById('videoPlan');

    const newScriptButton = document.getElementById('newScriptButton');

    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');

    let currentPhotos = [];
    let isBoosting = false;

    function applyTheme(theme) {
      const root = document.documentElement;
      root.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        themeIcon.textContent = '🌙';
        themeLabel.textContent = 'Dark';
      } else {
        themeIcon.textContent = '☀️';
        themeLabel.textContent = 'Light';
      }
      localStorage.setItem('lotRocketTheme', theme);
    }

    function initTheme() {
      const saved = localStorage.getItem('lotRocketTheme');
      if (saved === 'light' || saved === 'dark') {
        applyTheme(saved);
      } else {
        applyTheme('dark');
      }
    }

    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });

    initTheme();

    function safeTrim(str) {
      return (str || '').toString().trim();
    }

    function setStatus(text, loading) {
      if (loading) {
        statusText.innerHTML = '<span class="loading-dot"></span>' + text;
      } else {
        statusText.textContent = text;
      }
    }

    function updateSummary(label, price) {
      summaryLabel.textContent = safeTrim(label) || 'Vehicle ready';
      summaryPrice.textContent = safeTrim(price) || 'Message for current pricing';
    }

    function fillSocialKit(kit) {
      facebookPost.value = kit.facebook || '';
      instagramPost.value = kit.instagram || '';
      tiktokPost.value = kit.tiktok || '';
      linkedinPost.value = kit.linkedin || '';
      twitterPost.value = kit.twitter || '';
      textBlurb.value = kit.textBlurb || '';
      marketplacePost.value = kit.marketplace || '';
      hashtags.value = kit.hashtags || '';
      videoScript.value = kit.videoScript || '';
      shotPlan.value = kit.shotPlan || '';
    }

    function renderPhotosGrid(photos) {
      photosGrid.innerHTML = '';
      if (!photos || !photos.length) {
        photosStatus.textContent = 'No photos found yet.';
        return;
      }
      photos.forEach((url) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'photo-thumb';
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Vehicle photo';
        wrapper.appendChild(img);
        wrapper.addEventListener('click', () => {
          window.open(url, '_blank');
        });
        photosGrid.appendChild(wrapper);
      });
      photosStatus.textContent = photos.length + ' photos found. Click any to open full size.';
    }

    async function callJson(endpoint, body) {
      const res = await fetch(apiBase + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error('Request failed: ' + res.status + ' ' + txt);
      }
      return res.json();
    }

    async function handleBoost() {
      if (isBoosting) return;

      const url = safeTrim(vehicleUrlInput.value);
      if (!url) {
        alert('Paste a dealer vehicle URL first.');
        return;
      }

      let label = safeTrim(vehicleLabelInput.value);
      if (!label) {
        label = 'This vehicle';
        vehicleLabelInput.value = label;
      }

      let price = safeTrim(priceInfoInput.value);
      if (!price) {
        price = 'Message for current pricing';
        priceInfoInput.value = price;
      }

      isBoosting = true;
      boostButton.disabled = true;
      setStatus('Building social kit with AI…', true);

      try {
        const kitResp = await callJson('/api/social-kit', { url, label, price });
        if (!kitResp.success) throw new Error('API returned error');
        fillSocialKit(kitResp.kit);
        updateSummary(label, price);
        setStatus('Social kit ready. You can spin new posts or scripts anytime.', false);

        photosStatus.textContent = 'Trying to grab photos from dealer page…';
        try {
          const photoResp = await callJson('/api/grab-photos', { url });
          if (photoResp.success) {
            currentPhotos = photoResp.photos || [];
            renderPhotosGrid(currentPhotos);
          } else {
            photosStatus.textContent = 'Could not grab photos.';
          }
        } catch (err) {
          console.error('Auto photo grab failed:', err);
          photosStatus.textContent = 'Auto photo load failed.';
        }
      } catch (err) {
        console.error(err);
        setStatus('Something went wrong. Try again or check the URL.', false);
        alert('Error building social kit. Check the URL and try again.');
      } finally {
        isBoosting = false;
        boostButton.disabled = false;
      }
    }

    boostButton.addEventListener('click', handleBoost);

    document.querySelectorAll('.button-new-post').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const platform = btn.getAttribute('data-platform');
        const url = safeTrim(vehicleUrlInput.value);
        const label = safeTrim(vehicleLabelInput.value);
        const price = safeTrim(priceInfoInput.value);

        if (!url || !label) {
          alert('Please paste a URL and hit Boost at least once before spinning posts.');
          return;
        }

        btn.disabled = true;
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<span class="icon">⏳</span><span>Working…</span>';

        try {
          const resp = await callJson('/api/new-post', { platform, url, label, price });
          if (!resp.success) throw new Error('API error');
          const text = resp.post || '';

          switch (platform) {
            case 'facebook': facebookPost.value = text; break;
            case 'instagram': instagramPost.value = text; break;
            case 'tiktok': tiktokPost.value = text; break;
            case 'linkedin': linkedinPost.value = text; break;
            case 'twitter': twitterPost.value = text; break;
            case 'text': textBlurb.value = text; break;
            case 'marketplace': marketplacePost.value = text; break;
            case 'hashtags': hashtags.value = text; break;
          }
        } catch (err) {
          console.error(err);
          alert('Error generating a new post. Try again.');
        } finally {
          btn.disabled = false;
          btn.innerHTML = oldHtml;
        }
      });
    });

    newScriptButton.addEventListener('click', async () => {
      const url = safeTrim(vehicleUrlInput.value);
      const label = safeTrim(vehicleLabelInput.value);
      const price = safeTrim(priceInfoInput.value);

      if (!url || !label) {
        alert('Please paste a URL and hit Boost at least once before spinning scripts.');
        return;
      }

      newScriptButton.disabled = true;
      const oldHtml = newScriptButton.innerHTML;
      newScriptButton.innerHTML = '<span class="icon">⏳</span><span>Working…</span>';

      try {
        const resp = await callJson('/api/new-script', { url, label, price });
        if (!resp.success) throw new Error('API error');
        videoScript.value = resp.script || '';
      } catch (err) {
        console.error(err);
        alert('Error generating a new script. Try again.');
      } finally {
        newScriptButton.disabled = false;
        newScriptButton.innerHTML = oldHtml;
      }
    });

    buildVideoButton.addEventListener('click', async () => {
      if (!currentPhotos || !currentPhotos.length) {
        alert('No photos yet. Hit Boost first so we can pull photos from the dealer page.');
        return;
      }

      buildVideoButton.disabled = true;
      const oldHtml = buildVideoButton.innerHTML;
      buildVideoButton.innerHTML = '<span class="icon">⏳</span><span>Building…</span>';

      try {
        const label = safeTrim(vehicleLabelInput.value) || 'This vehicle';
        const resp = await callJson('/api/video-from-photos', { photos: currentPhotos, label });
        if (!resp.success) throw new Error('API error');
        videoPlan.value = resp.plan || '';
      } catch (err) {
        console.error(err);
        alert('Error building video plan. Try again.');
      } finally {
        buildVideoButton.disabled = false;
        buildVideoButton.innerHTML = oldHtml;
      }
    });
  </script>
</body>
</html>`);
});

// ----------------- Start server -----------------

app.listen(port, () => {
  console.log(`Lot Rocket server running on port ${port}`);
});
