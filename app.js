// app.js – Lot Rocket Social Media Kit with Objection Coach + Design Lab + Floating Tools

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

// ---------------- Helper: scrape vehicle photos ----------------

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

// ---------------- Helper: prompts ----------------

function buildSocialKitPrompt({ label, price, url }) {
  return `
You are helping a car salesperson create a social media content kit for ONE used or new vehicle.

Vehicle label (how we’ll refer to it in the copy):
"${label}"

Pricing / deal info as a short phrase:
"${price || 'Message for current pricing'}"

Dealer vehicle URL:
${url}

Goal:
- Copy-and-paste ready posts that look great on each platform.
- Strong hooks, scroll-stopping, modern, with emojis where they fit.
- Talk like a confident, honest salesperson – not a stiff dealership ad.

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

IMPORTANT:
- Keep everything under ~900 characters per field.
- No hashtags inside the main posts (except twitter). Hashtags go in "hashtags".
- No backticks, no code blocks, no explanations. Only the raw JSON object.

Platform styles:
- facebook: 
  * Big hook line with emojis (ALL CAPS is okay on first line).
  * 1–2 short paragraphs + 3–6 bullet points with emojis (✅, 🔥, 🚗, etc.).
  * Clear CTA at the end.
- instagram:
  * Similar to facebook but slightly more vibe, fewer bullets.
  * Emojis welcome.
- tiktok:
  * Short caption / voiceover text. High-energy, direct, 3–8 lines.
- linkedin:
  * Slightly more professional, but still human and friendly.
- twitter:
  * 1–3 concise lines plus a few inline hashtags.
- textBlurb:
  * SMS / DM style, 1–3 lines max. No hashtags.
- marketplace:
  * Facebook Marketplace description. No emojis at the very top, but you can use them later.
  * Friendly, clear, focused on benefits + CTA to message for more info.
- hashtags:
  * One single line. 8–15 hashtags. Mostly lowercase, simple words, separated by spaces.
- videoScript:
  * 30–40 second script they can read on camera.
  * 4–8 short paragraphs / line breaks.
  * Clear CTA at the end (DM "INFO", message me, schedule test drive).
- shotPlan:
  * 5–10 bullet points describing shots for Reels / TikTok using dealer photos (exterior, interior, features, walk-around, closing shot, etc.).`;
}

function buildSinglePostPrompt({ platform, label, price, url }) {
  return `
You are writing a fresh, scroll-stopping social media post for a car salesperson.

Platform: ${platform}
Vehicle: "${label}"
Pricing/deal phrase: "${price || 'Message for current pricing'}"
Vehicle URL: ${url}

Write ONLY the post body text for this platform.

Tone:
- Confident, honest car salesperson.
- Speaks like a real human, not a corporate script.
- Strong hooks, emojis allowed (especially for facebook / instagram / tiktok).
- No cringe or “hard sell”, but high energy and clear CTA.

Length:
- facebook, instagram, linkedin, marketplace: 3–10 short lines.
- tiktok: 3–8 high-energy lines.
- twitter: 1–3 short lines.
- textBlurb: 1–3 very short lines (SMS style).
- hashtags: single line of hashtags only.

Rules:
- Do NOT include the word "hashtags" anywhere.
- For "hashtags" platform: return ONLY the hashtags line.
- For all others: no hashtags (except twitter can include a few inline).

Return only the post text, nothing else.`;
}

function buildVideoScriptPrompt({ label, price, url }) {
  return `
Write a 30–40 second vertical video script a car salesperson can read on camera
for this vehicle.

Vehicle: "${label}"
Pricing/deal phrase: "${price || 'Message for current pricing'}"
Vehicle URL: ${url}

Style:
- Modern car sales trainer vibe: high-energy, confident, positive.
- Ethical and honest: no pressure, no manipulation.
- Talks directly to the viewer ("you").
- 4–8 short paragraphs or line breaks.
- Strong hook in the first 1–2 lines.
- Clear CTA at the end (DM "INFO", message me, schedule a quick test drive, etc.).

Return ONLY the script text, nothing else.`;
}

// Objection chat system prompt (Andy Elliott–style coach)
function buildObjectionSystemPrompt({ label, price }) {
  return `
You are an automotive objections specialist and high-energy sales coach.
Your style is inspired by trainers like Andy Elliott:
- Confident, direct, high-energy.
- Ethical and honest: no lying, no manipulation, no fake scarcity.
- You help salespeople handle objections, keep control, and move the deal forward.

The salesperson is working a customer on:
- Vehicle: "${label || 'this vehicle'}"
- Deal phrase: "${price || 'Message for current pricing'}"

Rules for your replies:
- Treat everything as part of a live role-play.
- Always respect the customer and keep things ethical.
- Use SHORT, punchy sentences that are easy to say out loud.
- Structure most answers like:
  1) Acknowledge and agree / align.
  2) Reframe with logic or emotion.
  3) Ask 1–2 strong questions that move things forward.
  4) Give a clear suggested line or word track.

- You are talking to the salesperson (not the customer), so explain what to say and why.
- When you give word tracks, write them as spoken lines they can say immediately.

You are in a continuous chat with this salesperson. They will paste objections and ask follow-up questions.
Answer as their personal objection-handling coach.`;
}

// Design Lab prompt – Canva-style layout ideas
function buildDesignPrompt({ type, label, price, url }) {
  return `
You are helping a car salesperson design a social graphic in a tool like Canva.

Design type: ${type}
Vehicle: "${label}"
Pricing/deal phrase: "${price || 'Message for current pricing'}"
Vehicle URL: ${url}

Give me a Canva-style layout plan that is COPY/PASTE friendly.

Return plain text, with these sections in order:

1) TITLE / MAIN HOOK TEXT
- Write exactly what the big headline on the graphic should say.
- Make it bold, scroll-stopping, and short.

2) SUBHEAD / SUPPORT LINE
- One strong supporting line.

3) BODY TEXT BLOCK
- 3–6 short bullet-style benefit lines, can include emojis.

4) CTA TEXT
- Exact line that should go near the bottom as the call-to-action.

5) LAYOUT IDEA
- Explain where to place the photo(s) and each text part on the canvas
  (top, bottom, left, right, center, overlay on photo, etc.).

6) COLORS & VIBE
- Suggest 1–2 background color ideas, 1 accent color, and what kind of vibe
  (bold, clean, luxury, off-road, family, etc.).

Make it very easy for a salesperson to read and then recreate quickly in Canva. Use line breaks between sections.`;
}

// ---------------- OpenAI helpers ----------------

async function callOpenAIForJSON(prompt) {
  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: prompt,
  });

  // Responses API: output[0].content[0].text
  const content = response.output[0].content[0].text;
  return JSON.parse(content);
}

async function callOpenAIForText(prompt) {
  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: prompt,
  });

  const text = response.output[0].content[0].text;
  return text;
}

// ---------------- API routes ----------------

// Full social kit
app.post('/api/social-kit', async (req, res) => {
  try {
    const { url, label, price } = req.body;
    if (!url || !label) {
      return res.status(400).json({ error: 'Missing url or label' });
    }
    const prompt = buildSocialKitPrompt({ url, label, price });
    const json = await callOpenAIForJSON(prompt);

    res.json({ success: true, kit: json });
  } catch (err) {
    console.error('Error in /api/social-kit:', err);
    res.status(500).json({ error: 'Failed to generate social kit' });
  }
});

// New post for a specific platform
app.post('/api/new-post', async (req, res) => {
  try {
    const { platform, label, price, url } = req.body;
    if (!platform || !label) {
      return res.status(400).json({ error: 'Missing platform or label' });
    }
    const prompt = buildSinglePostPrompt({ platform, label, price, url });
    const text = await callOpenAIForText(prompt);
    res.json({ success: true, post: text.trim() });
  } catch (err) {
    console.error('Error in /api/new-post:', err);
    res.status(500).json({ error: 'Failed to generate new post' });
  }
});

// New video script
app.post('/api/new-script', async (req, res) => {
  try {
    const { label, price, url } = req.body;
    if (!label || !url) {
      return res.status(400).json({ error: 'Missing label or url' });
    }
    const prompt = buildVideoScriptPrompt({ label, price, url });
    const script = await callOpenAIForText(prompt);
    res.json({ success: true, script: script.trim() });
  } catch (err) {
    console.error('Error in /api/new-script:', err);
    res.status(500).json({ error: 'Failed to generate video script' });
  }
});

// Objection chat (multi-turn)
app.post('/api/objection-coach', async (req, res) => {
  try {
    const { messages, label, price } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing messages array' });
    }

    const systemPrompt = buildObjectionSystemPrompt({ label, price });

    const input = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
      })),
    ];

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input,
    });

    const reply = response.output[0].content[0].text.trim();
    res.json({ success: true, reply });
  } catch (err) {
    console.error('Error in /api/objection-coach:', err);
    res.status(500).json({ error: 'Failed to generate objection response' });
  }
});

// Design Lab – Canva-style layout ideas
app.post('/api/design-idea', async (req, res) => {
  try {
    const { type, label, price, url } = req.body || {};
    if (!type || !label || !url) {
      return res.status(400).json({ error: 'Missing type, label, or url' });
    }
    const prompt = buildDesignPrompt({ type, label, price, url });
    const design = await callOpenAIForText(prompt);
    res.json({ success: true, design: design.trim() });
  } catch (err) {
    console.error('Error in /api/design-idea:', err);
    res.status(500).json({ error: 'Failed to generate design idea' });
  }
});

// Grab photos
app.post('/api/grab-photos', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing url' });
    }
    const photos = await scrapeVehiclePhotos(url);
    res.json({ success: true, photos });
  } catch (err) {
    console.error('Error in /api/grab-photos:', err);
    res.status(500).json({ error: 'Failed to grab photos' });
  }
});

// Video-from-photos plan
app.post('/api/video-from-photos', async (req, res) => {
  try {
    const { photos, label } = req.body;
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }

    const total = photos.length;
    const mid = Math.floor(total / 2);
    const last = total - 1;

    const plan = [
      `Clip 1 – Photo 1 – 3–4 seconds\nOn-screen text: "${label}"`,
      total > 4 ? `Clip 2 – Photo 4 – 3 seconds` : '',
      total > 8 ? `Clip 3 – Photo 8 – 3 seconds` : '',
      `Clip 4 – Photo ${mid + 1} – 3–4 seconds\nOn-screen text: "Interior & tech"`,
      total > 6 ? `Clip 5 – Photo ${Math.min(mid + 3, last + 1)} – 3 seconds` : '',
      `Clip 6 – Photo ${last + 1} – 3 seconds\nOn-screen text: "DM 'INFO' for details"`,
      `Recommended music: upbeat, confident track that fits Reels / TikTok.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    res.json({ success: true, plan });
  } catch (err) {
    console.error('Error in /api/video-from-photos:', err);
    res.status(500).json({ error: 'Failed to build video plan' });
  }
});

// AI Message & multi-campaign builder
app.post('/api/ai-message', async (req, res) => {
  try {
    let {
      channel = 'sms',
      goal,
      details,
      audience = 'car buyer',
      tone = 'friendly',
      followups = 3,
      variants = 1,
    } = req.body || {};

    if (!goal && !details) {
      return res
        .status(400)
        .json({ error: 'Please provide a goal or some details for the message.' });
    }

    followups = Math.max(1, Math.min(Number(followups) || 3, 10));
    variants = Math.max(1, Math.min(Number(variants) || 1, 5));

    const prompt = `
You are an expert automotive sales copywriter and CRM strategist.

Channel: ${channel}
Audience: ${audience}
Tone: ${tone}
Primary goal: ${goal || 'Not specified, infer from context.'}
Extra details from salesperson: ${details || 'None provided.'}
Number of follow-up steps for each campaign: ${followups}
Number of different campaign variants to create: ${variants}

Tasks:
1. Create ${variants} different high-converting ${
      channel === 'email' ? 'emails' : 'SMS text messages'
    } that a car salesperson can send to a real lead. Make each one personalized, clear, and action-driven.
2. For EACH of those ${variants} options, create a follow-up workflow with ${followups} steps. For each step, include:
   - Day offset (for example: 0, 2, 5, etc.)
   - Channel (SMS, email, call, etc.)
   - Purpose of the step
   - Full suggested message text.

Return your answer as strict JSON in this exact shape:
{
  "variants": [
    {
      "primaryMessage": "string",
      "campaign": [
        {
          "dayOffset": number,
          "channel": "sms | email | phone",
          "purpose": "string",
          "message": "string"
        }
      ]
    }
  ]
}

Important:
- Always include exactly ${variants} items in "variants".
- For each campaign, always include exactly ${followups} steps in "campaign".
- Only output JSON. Do not include any extra commentary.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content:
            'You write high-converting automotive sales messages and follow-up workflows. Always respond in valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return res.status(500).json({ error: 'No response from AI.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse AI JSON:', e, raw);
      return res.status(500).json({ error: 'AI response was not valid JSON.' });
    }

    if (!Array.isArray(parsed.variants)) {
      return res.status(500).json({
        error: 'AI response JSON missing "variants" array.',
      });
    }

    res.json(parsed);
  } catch (err) {
    console.error('Error in /api/ai-message:', err);
    res.status(500).json({ error: 'Failed to generate AI message workflow' });
  }
});

// ---------------- Front-end HTML ----------------

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
      gap: 14px;
    }

    .logo-circle {
      width: 70px;
      height: 70px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      box-sizing: border-box;
    }
    [data-theme="dark"] .logo-circle {
      border: 2px solid #ef4444;
      color: #ef4444;
      background: radial-gradient(circle at center, rgba(239,68,68,0.08), transparent 60%);
    }
    [data-theme="light"] .logo-circle {
      border: 2px solid #b91c1c;
      color: #b91c1c;
      background: #fff;
    }
    .logo-inner {
      font-weight: 800;
      font-size: 30px;
      line-height: 1;
      position: relative;
      font-family: "Times New Roman", Georgia, serif;
    }
    .logo-inner span.rocket {
      position: absolute;
      left: 52%;
      top: 32%;
      font-size: 16px;
      transform: translateX(-50%);
    }
    .logo-text-main {
      font-weight: 700;
      font-size: 18px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .logo-text-sub {
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
      grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.3fr);
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

    /* Social posts layout – 2 wide, long boxes */
    .social-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    @media (max-width: 900px) {
      .social-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .social-card {
      border-radius: 16px;
      padding: 10px 11px 9px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      border: 1px solid rgba(148, 163, 184, 0.75);
      min-height: 200px;
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

    .textarea.post-box {
      min-height: 210px;
      max-height: 260px;
      font-size: 13px;
      line-height: 1.35;
    }

    .textarea.marketplace-box {
      min-height: 230px;
      max-height: 280px;
    }

    .textarea.script {
      min-height: 160px;
    }

    .textarea.shotplan {
      min-height: 130px;
    }

    .textarea.design {
      min-height: 180px;
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
      margin-right: 4px;
      animation: pulse 1s infinite alternate;
    }
    @keyframes pulse {
      from { transform: scale(1); opacity: 0.8; }
      to   { transform: scale(1.4); opacity: 0.3; }
    }

    .hidden {
      display: none !important;
    }

    /* ----- Floating Tools Column ----- */

    .tool-launcher-column {
      position: fixed;
      top: 18px;
      right: 20px;
      z-index: 60;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-end;
    }

    .tool-launcher-btn {
      border-radius: 999px;
      padding: 6px 12px;
      border: none;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    [data-theme="dark"] .tool-launcher-btn {
      background: rgba(15, 23, 42, 0.96);
      color: var(--text-dark);
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.75);
    }
    [data-theme="light"] .tool-launcher-btn {
      background: rgba(255, 255, 255, 0.96);
      color: var(--text-light);
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.25);
      border: 1px solid rgba(148, 163, 184, 0.9);
    }

    .tool-launcher-btn span.icon {
      font-size: 13px;
    }

    @media (max-width: 820px) {
      .tool-launcher-column {
        bottom: 16px;
        top: auto;
        right: 16px;
        align-items: flex-end;
      }
    }

    /* ----- Shared modal styles (objection + tools) ----- */

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.78);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .modal-card {
      width: 620px;
      max-width: 96vw;
      max-height: 82vh;
      border-radius: 20px;
      padding: 14px 14px 12px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    [data-theme="dark"] .modal-card {
      background: radial-gradient(circle at top, #111827 0, #020617 60%);
      border: 1px solid rgba(248, 113, 113, 0.8);
      box-shadow: 0 22px 55px rgba(0, 0, 0, 0.9);
      color: var(--text-dark);
    }
    [data-theme="light"] .modal-card {
      background: #f9fafb;
      border: 1px solid rgba(248, 113, 113, 0.9);
      box-shadow: 0 22px 55px rgba(15, 23, 42, 0.35);
      color: var(--text-light);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .modal-title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .modal-tag {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      opacity: 0.8;
    }
    .modal-title {
      font-size: 14px;
      font-weight: 600;
    }
    .modal-sub {
      font-size: 11px;
      opacity: 0.8;
    }

    .modal-close {
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.9);
      background: transparent;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
    }

    .modal-body {
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1 1 auto;
      min-height: 0;
    }

    .modal-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .modal-half {
      flex: 1 1 0;
      min-width: 130px;
    }

    .tool-input {
      width: 100%;
      box-sizing: border-box;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.9);
      padding: 6px 8px;
      font-size: 13px;
      font-family: var(--font-main);
      background: rgba(15, 23, 42, 0.98);
      color: var(--text-dark);
    }
    [data-theme="light"] .tool-input {
      background: rgba(249, 250, 251, 0.98);
      color: var(--text-light);
    }

    .tool-textarea {
      width: 100%;
      box-sizing: border-box;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.9);
      padding: 6px 8px;
      font-size: 12px;
      font-family: var(--font-main);
      resize: vertical;
      min-height: 80px;
      white-space: pre-wrap;
      background: rgba(15, 23, 42, 0.98);
      color: var(--text-dark);
    }
    [data-theme="light"] .tool-textarea {
      background: rgba(249, 250, 251, 0.98);
      color: var(--text-light);
    }

    .tool-button-primary {
      border-radius: 999px;
      padding: 6px 12px;
      border: none;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    [data-theme="dark"] .tool-button-primary {
      background: linear-gradient(135deg, #fb923c, #ef4444);
      color: #fff;
      box-shadow: 0 10px 22px rgba(248, 113, 113, 0.7);
    }
    [data-theme="light"] .tool-button-primary {
      background: linear-gradient(135deg, #f97316, #dc2626);
      color: #fff;
      box-shadow: 0 10px 22px rgba(239, 68, 68, 0.6);
    }

    .tool-result-text {
      font-size: 13px;
      font-weight: 600;
      margin-top: 4px;
      white-space: pre-wrap;
    }

    @media (max-width: 640px) {
      .modal-card {
        width: 100%;
        margin: 0 10px;
        max-height: 86vh;
      }
    }

    .objection-history {
      flex: 1 1 auto;
      min-height: 140px;
      max-height: 260px;
      overflow-y: auto;
      border-radius: 12px;
      padding: 8px 10px;
      box-sizing: border-box;
      border: 1px solid rgba(148, 163, 184, 0.7);
    }
    .objection-bubble {
      margin-bottom: 6px;
      font-size: 12px;
      white-space: pre-wrap;
    }
    .objection-bubble.you-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      opacity: 0.7;
    }
    .objection-bubble.coach-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      opacity: 0.7;
    }
    .objection-bubble.you {
      background: rgba(59, 130, 246, 0.12);
      border-radius: 10px;
      padding: 6px 8px;
    }
    .objection-bubble.coach {
      background: rgba(248, 113, 113, 0.12);
      border-radius: 10px;
      padding: 6px 8px;
    }

    .objection-input-row {
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .objection-input-box {
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.9);
      padding: 6px 8px;
      min-height: 70px;
      font-size: 12px;
      resize: vertical;
      font-family: var(--font-main);
      white-space: pre-wrap;
      background: rgba(15, 23, 42, 0.98);
      color: var(--text-dark);
    }
    [data-theme="light"] .objection-input-box {
      background: rgba(249, 250, 251, 0.98);
      color: var(--text-light);
    }
    .objection-send-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .objection-hint {
      font-size: 10px;
      opacity: 0.7;
    }
    #objectionSendButton {
      border-radius: 999px;
      border: none;
      padding: 6px 12px;
      font-size: 11px;
      cursor: pointer;
      background: linear-gradient(135deg, #fb923c, #ef4444);
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <header class="app-header">
      <div class="title-group">
        <div class="logo-circle">
          <div class="logo-inner">
            LR
            <span class="rocket">🚀</span>
          </div>
        </div>
        <div>
          <div class="logo-text-main">Lot Rocket</div>
          <div class="logo-text-sub">Social Media Kit · Prototype for salespeople, not stores</div>
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
            <input id="vehicleLabel" class="input" placeholder="2024 Chevrolet Blazer 2LT – Plymouth, MI – Used" />
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
              <div class="card-subtitle">We’ll auto-pull photos on Boost and turn them into a simple video plan.</div>
            </div>
            <button id="buildVideoButton" class="button-ghost" type="button">
              <span class="icon">🎬</span><span>Build Video from Photos</span>
            </button>
          </div>

          <div class="field-group">
            <label class="field-label">Dealer Photos</label>
            <div id="photosGrid" class="photos-grid"></div>
            <div id="photosStatus" class="tiny-note">Photos will auto-load after Boost if we can find them.</div>
          </div>

          <div class="field-group">
            <label class="field-label" for="videoPlan">Video From Photos Plan</label>
            <textarea id="videoPlan" class="textarea shotplan" placeholder="Hit 'Build Video from Photos' after photos load to get a simple shot list for Reels / TikTok." readonly></textarea>
          </div>
        </div>
      </section>

      <!-- Right panel: social kit + video + design lab -->
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
              Each box is copy-and-paste ready. Hit “New Post” to spin a fresh version for that platform.
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
              <textarea id="facebookPost" class="textarea post-box" readonly></textarea>
            </div>

            <!-- Instagram -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">📸 Instagram</div>
                <button data-platform="instagram" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="instagramPost" class="textarea post-box" readonly></textarea>
            </div>

            <!-- TikTok -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🎵 TikTok</div>
                <button data-platform="tiktok" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="tiktokPost" class="textarea post-box" readonly></textarea>
            </div>

            <!-- LinkedIn -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">💼 LinkedIn</div>
                <button data-platform="linkedin" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="linkedinPost" class="textarea post-box" readonly></textarea>
            </div>

            <!-- X / Twitter -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🐦 X / Twitter</div>
                <button data-platform="twitter" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="twitterPost" class="textarea post-box" readonly></textarea>
            </div>

            <!-- Text / DM -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">💬 Text / DM</div>
                <button data-platform="text" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Text</span>
                </button>
              </div>
              <textarea id="textBlurb" class="textarea post-box" readonly></textarea>
            </div>

            <!-- Marketplace -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🛒 Marketplace</div>
                <button data-platform="marketplace" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Post</span>
                </button>
              </div>
              <textarea id="marketplacePost" class="textarea marketplace-box" readonly></textarea>
            </div>

            <!-- Hashtags -->
            <div class="social-card">
              <div class="social-card-header">
                <div class="social-platform">🏷 Hashtags</div>
                <button data-platform="hashtags" class="button-ghost button-new-post" type="button">
                  <span class="icon">🔁</span><span>New Tags</span>
                </button>
              </div>
              <textarea id="hashtags" class="textarea post-box" readonly></textarea>
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

          <!-- Design Lab -->
          <div class="field-group">
            <div class="section-title-row">
              <label class="field-label">Design Lab (Canva-style layout)</label>
              <div class="card-subtitle">Get a ready-to-build graphic layout you can recreate in Canva.</div>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="designType">Design Type</label>
            <div class="pill-row">
              <select id="designType" class="input" style="max-width: 260px; padding-right: 28px;">
                <option value="facebook_feed_post">Facebook feed post</option>
                <option value="instagram_feed_post">Instagram feed post</option>
                <option value="instagram_story">Instagram Story</option>
                <option value="reels_cover">Reels / TikTok cover image</option>
                <option value="tiktok_vertical_graphic">TikTok vertical graphic</option>
                <option value="youtube_thumbnail">YouTube thumbnail</option>
              </select>
              <button id="designButton" class="button-ghost" type="button">
                <span class="icon">🎨</span><span>Generate Design Idea</span>
              </button>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="designOutput">Design Layout Plan</label>
            <textarea id="designOutput" class="textarea design" placeholder="Choose a design type and hit Generate to get a Canva-style layout you can build in minutes." readonly></textarea>
          </div>

          <div class="tiny-note">
            Prototype for salespeople. Copy, tweak, and make it yours. 🚀
          </div>
        </div>
      </section>
    </div>
  </div>

  <!-- Floating tool buttons (right side, stacked) -->
  <div class="tool-launcher-column">
    <button id="objectionLauncher" class="tool-launcher-btn" type="button">
      <span class="icon">🧠</span>
      <span>Objection coach</span>
    </button>
    <button id="paymentLauncher" class="tool-launcher-btn" type="button">
      <span class="icon">🔢</span>
      <span>Payment calc</span>
    </button>
    <button id="incomeLauncher" class="tool-launcher-btn" type="button">
      <span class="icon">💵</span>
      <span>Income calc</span>
    </button>
    <button id="messageLauncher" class="tool-launcher-btn" type="button">
      <span class="icon">✉️</span>
      <span>AI messages</span>
    </button>
  </div>

  <!-- Objection Coach Modal -->
  <div id="objectionModal" class="modal-backdrop hidden">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title-group">
          <div class="modal-tag">OBJECTIONS HANDLED</div>
          <div class="modal-title">Andy Elliott–style AI coach</div>
          <div class="modal-sub">
            Paste a customer objection or ask how to respond. Get word tracks and breakdowns.
          </div>
        </div>
        <button id="objectionCloseButton" class="modal-close" type="button">✕</button>
      </div>

      <div class="modal-body">
        <div id="objectionHistory" class="objection-history">
          <!-- chat bubbles injected here -->
        </div>

        <div class="objection-input-row">
          <textarea
            id="objectionInput"
            class="objection-input-box"
            placeholder="Example: &quot;I need to think about it&quot; or &quot;Payment is too high&quot; or ask: &quot;How do I close a be-back?&quot;"
          ></textarea>

          <div class="objection-send-row">
            <div class="objection-hint">
              Tip: Enter to make a new line. Ctrl+Enter / Cmd+Enter to send fast.
            </div>
            <button id="objectionSendButton" type="button">
              <span>🧠 Handle this objection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Payment Calculator Modal -->
  <div id="paymentModal" class="modal-backdrop hidden">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title-group">
          <div class="modal-tag">PAYMENT TOOL</div>
          <div class="modal-title">Quick Car Payment Calculator</div>
          <div class="modal-sub">
            Fast ballpark payment you can give on the spot. Not a final finance quote.
          </div>
        </div>
        <button id="paymentCloseButton" class="modal-close" type="button">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-row">
          <div class="modal-half">
            <label class="field-label">Vehicle Price ($)</label>
            <input id="payPrice" class="tool-input" type="number" placeholder="30000" />
          </div>
          <div class="modal-half">
            <label class="field-label">Down Payment ($)</label>
            <input id="payDown" class="tool-input" type="number" placeholder="3000" />
          </div>
        </div>
        <div class="modal-row">
          <div class="modal-half">
            <label class="field-label">APR (%)</label>
            <input id="payApr" class="tool-input" type="number" step="0.01" placeholder="7.99" />
          </div>
          <div class="modal-half">
            <label class="field-label">Term (months)</label>
            <input id="payTerm" class="tool-input" type="number" placeholder="72" />
          </div>
        </div>
        <button id="paymentCalcButton" class="tool-button-primary" type="button">
          <span>🔢 Calculate Payment</span>
        </button>
        <div id="paymentResultText" class="tool-result-text"></div>
      </div>
    </div>
  </div>

  <!-- Income Calculator Modal -->
  <div id="incomeModal" class="modal-backdrop hidden">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title-group">
          <div class="modal-tag">INCOME TOOL</div>
          <div class="modal-title">Yearly Gross Income Calculator</div>
          <div class="modal-sub">
            Turn hourly pay into a quick yearly income estimate.
          </div>
        </div>
        <button id="incomeCloseButton" class="modal-close" type="button">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-row">
          <div class="modal-half">
            <label class="field-label">Hourly Wage ($)</label>
            <input id="incHourly" class="tool-input" type="number" step="0.01" placeholder="20" />
          </div>
          <div class="modal-half">
            <label class="field-label">Hours per Week</label>
            <input id="incHours" class="tool-input" type="number" placeholder="40" />
          </div>
        </div>
        <button id="incomeCalcButton" class="tool-button-primary" type="button">
          <span>💵 Calculate Income</span>
        </button>
        <div id="incomeResultText" class="tool-result-text"></div>
      </div>
    </div>
  </div>

  <!-- AI Message & Campaign Builder Modal -->
  <div id="messageModal" class="modal-backdrop hidden">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title-group">
          <div class="modal-tag">FOLLOW-UP ENGINE</div>
          <div class="modal-title">AI Message & Workflow Builder</div>
          <div class="modal-sub">
            Describe what you’re trying to do. Get messages and a multi-step follow-up plan.
          </div>
        </div>
        <button id="messageCloseButton" class="modal-close" type="button">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-row">
          <div class="modal-half">
            <label class="field-label">Channel</label>
            <select id="msgChannel" class="tool-input">
              <option value="sms">Text Message (SMS)</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div class="modal-half">
            <label class="field-label">Tone</label>
            <select id="msgTone" class="tool-input">
              <option value="friendly">Friendly & Helpful</option>
              <option value="professional">Professional</option>
              <option value="urgent">Urgent / Action-focused</option>
              <option value="laid back">Laid back</option>
            </select>
          </div>
        </div>
        <div class="modal-row">
          <div class="modal-half">
            <label class="field-label">Follow-up steps</label>
            <input id="msgFollowups" class="tool-input" type="number" min="1" max="10" value="4" />
          </div>
          <div class="modal-half">
            <label class="field-label">Campaign options</label>
            <input id="msgVariants" class="tool-input" type="number" min="1" max="5" value="2" />
          </div>
        </div>
        <div class="modal-row">
          <div class="modal-half">
            <label class="field-label">Audience type</label>
            <input id="msgAudience" class="tool-input" placeholder="Subprime, first-time buyer, repeat, etc." />
          </div>
          <div class="modal-half">
            <label class="field-label">Goal</label>
            <input id="msgGoal" class="tool-input" placeholder="Example: Re-engage a be-back lead" />
          </div>
        </div>
        <div>
          <label class="field-label">Key details</label>
          <textarea id="msgDetails" class="tool-textarea" placeholder="Name, vehicle, situation, objections, payment target, timeline, etc."></textarea>
        </div>
        <button id="messageGenerateButton" class="tool-button-primary" type="button">
          <span>✉️ Build Messages & Workflow</span>
        </button>
        <textarea id="msgResult" class="tool-textarea" style="margin-top:6px; min-height:140px;" readonly placeholder="Your message options and follow-up steps will appear here."></textarea>
      </div>
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

    const designTypeSelect = document.getElementById('designType');
    const designButton = document.getElementById('designButton');
    const designOutput = document.getElementById('designOutput');

    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');

    // Floating tool launchers
    const objectionLauncher = document.getElementById('objectionLauncher');
    const paymentLauncher = document.getElementById('paymentLauncher');
    const incomeLauncher = document.getElementById('incomeLauncher');
    const messageLauncher = document.getElementById('messageLauncher');

    // Objection modal elements
    const objectionModal = document.getElementById('objectionModal');
    const objectionCloseButton = document.getElementById('objectionCloseButton');
    const objectionHistory = document.getElementById('objectionHistory');
    const objectionInput = document.getElementById('objectionInput');
    const objectionSendButton = document.getElementById('objectionSendButton');

    // Payment modal elements
    const paymentModal = document.getElementById('paymentModal');
    const paymentCloseButton = document.getElementById('paymentCloseButton');
    const payPrice = document.getElementById('payPrice');
    const payDown = document.getElementById('payDown');
    const payApr = document.getElementById('payApr');
    const payTerm = document.getElementById('payTerm');
    const paymentCalcButton = document.getElementById('paymentCalcButton');
    const paymentResultText = document.getElementById('paymentResultText');

    // Income modal elements
    const incomeModal = document.getElementById('incomeModal');
    const incomeCloseButton = document.getElementById('incomeCloseButton');
    const incHourly = document.getElementById('incHourly');
    const incHours = document.getElementById('incHours');
    const incomeCalcButton = document.getElementById('incomeCalcButton');
    const incomeResultText = document.getElementById('incomeResultText');

    // Message modal elements
    const messageModal = document.getElementById('messageModal');
    const messageCloseButton = document.getElementById('messageCloseButton');
    const msgChannel = document.getElementById('msgChannel');
    const msgTone = document.getElementById('msgTone');
    const msgFollowups = document.getElementById('msgFollowups');
    const msgVariants = document.getElementById('msgVariants');
    const msgAudience = document.getElementById('msgAudience');
    const msgGoal = document.getElementById('msgGoal');
    const msgDetails = document.getElementById('msgDetails');
    const messageGenerateButton = document.getElementById('messageGenerateButton');
    const msgResult = document.getElementById('msgResult');

    let currentPhotos = [];
    let currentUrl = '';
    let isBoosting = false;

    // chat history for objection coach
    let objectionMessages = []; // { role: 'user' | 'assistant', content: string }

    // ----- Theme handling -----

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

    // ----- Helpers -----

    function setStatus(text, isLoading = false) {
      if (isLoading) {
        statusText.innerHTML = '<span class="loading-dot"></span>' + text;
      } else {
        statusText.textContent = text;
      }
    }

    function safeTrim(str) {
      return (str || '').toString().trim();
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
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error('Request failed: ' + res.status + ' ' + txt);
      }
      return res.json();
    }

    // render objection chat history into modal
    function renderObjectionChat() {
      objectionHistory.innerHTML = '';
      if (!objectionMessages.length) {
        const empty = document.createElement('div');
        empty.className = 'objection-bubble';
        empty.style.opacity = '0.7';
        empty.textContent =
          'Paste the customer objection (or ask a question) and your Andy Elliott–style coach will give you word tracks and breakdowns.';
        objectionHistory.appendChild(empty);
        return;
      }

      objectionMessages.forEach((m) => {
        const labelDiv = document.createElement('div');
        labelDiv.className =
          'objection-bubble ' + (m.role === 'assistant' ? 'coach-label' : 'you-label');
        labelDiv.textContent = m.role === 'assistant' ? 'COACH' : 'YOU';

        const bubble = document.createElement('div');
        bubble.className = 'objection-bubble ' + (m.role === 'assistant' ? 'coach' : 'you');
        bubble.textContent = m.content || '';

        objectionHistory.appendChild(labelDiv);
        objectionHistory.appendChild(bubble);
      });

      objectionHistory.scrollTop = objectionHistory.scrollHeight;
    }

    // ----- Boost flow -----

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
        currentUrl = url;
        const resp = await callJson('/api/social-kit', { url, label, price });
        if (!resp.success) throw new Error('API returned error');
        fillSocialKit(resp.kit);
        updateSummary(label, price);
        setStatus('Social kit ready. You can spin new posts or scripts anytime.');

        // reset objection chat for the new vehicle
        objectionMessages = [];
        renderObjectionChat();

        // Auto load photos
        try {
          photosStatus.textContent = 'Trying to grab photos from dealer page…';
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
        setStatus('Something went wrong. Try again or check the URL.');
        alert('Error building social kit. Check the URL and try again.');
      } finally {
        isBoosting = false;
        boostButton.disabled = false;
      }
    }

    boostButton.addEventListener('click', handleBoost);

    // ----- New post buttons -----

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
        const oldText = btn.innerHTML;
        btn.innerHTML = '<span class="icon">⏳</span><span>Working…</span>';

        try {
          const resp = await callJson('/api/new-post', { platform, url, label, price });
          if (!resp.success) throw new Error('API returned error');
          const text = resp.post || '';

          switch (platform) {
            case 'facebook':
              facebookPost.value = text;
              break;
            case 'instagram':
              instagramPost.value = text;
              break;
            case 'tiktok':
              tiktokPost.value = text;
              break;
            case 'linkedin':
              linkedinPost.value = text;
              break;
            case 'twitter':
              twitterPost.value = text;
              break;
            case 'text':
              textBlurb.value = text;
              break;
            case 'marketplace':
              marketplacePost.value = text;
              break;
            case 'hashtags':
              hashtags.value = text;
              break;
          }
        } catch (err) {
          console.error(err);
          alert('Error generating a new post. Try again.');
        } finally {
          btn.disabled = false;
          btn.innerHTML = oldText;
        }
      });
    });

    // ----- New video script -----

    newScriptButton.addEventListener('click', async () => {
      const url = safeTrim(vehicleUrlInput.value);
      const label = safeTrim(vehicleLabelInput.value);
      const price = safeTrim(priceInfoInput.value);

      if (!url || !label) {
        alert('Please paste a URL and hit Boost at least once before spinning scripts.');
        return;
      }

      newScriptButton.disabled = true;
      const oldText = newScriptButton.innerHTML;
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
        newScriptButton.innerHTML = oldText;
      }
    });

    // ----- Build video plan from photos -----

    buildVideoButton.addEventListener('click', async () => {
      if (!currentPhotos || !currentPhotos.length) {
        alert('No photos yet. Boost a listing first so we can grab photos.');
        return;
      }

      buildVideoButton.disabled = true;
      const oldText = buildVideoButton.innerHTML;
      buildVideoButton.innerHTML = '<span class="icon">⏳</span><span>Building…</span>';

      try {
        const label = safeTrim(vehicleLabelInput.value) || 'this vehicle';
        const resp = await callJson('/api/video-from-photos', {
          photos: currentPhotos,
          label,
        });
        if (!resp.success) throw new Error('API error');
        videoPlan.value = resp.plan || '';
      } catch (err) {
        console.error(err);
        alert('Error building video plan. Try again.');
      } finally {
        buildVideoButton.disabled = false;
        buildVideoButton.innerHTML = oldText;
      }
    });

    // ----- Design Lab -----

    designButton.addEventListener('click', async () => {
      const type = designTypeSelect.value;
      const url = safeTrim(vehicleUrlInput.value);
      const label = safeTrim(vehicleLabelInput.value);
      const price = safeTrim(priceInfoInput.value);

      if (!url || !label) {
        alert('Please paste a URL and hit Boost at least once before generating design ideas.');
        return;
      }

      designButton.disabled = true;
      const oldText = designButton.innerHTML;
      designButton.innerHTML = '<span class="icon">⏳</span><span>Designing…</span>';

      try {
        const resp = await callJson('/api/design-idea', { type, url, label, price });
        if (!resp.success) throw new Error('API error');
        designOutput.value = resp.design || '';
      } catch (err) {
        console.error(err);
        alert('Error generating a design idea. Try again.');
      } finally {
        designButton.disabled = false;
        designButton.innerHTML = oldText;
      }
    });

    // ----- Objection Coach modal -----

    function openObjectionModal() {
      objectionModal.classList.remove('hidden');
      if (!objectionMessages.length) {
        renderObjectionChat();
      }
      setTimeout(() => {
        objectionInput.focus();
      }, 50);
    }

    function closeObjectionModal() {
      objectionModal.classList.add('hidden');
    }

    objectionLauncher.addEventListener('click', openObjectionModal);
    objectionCloseButton.addEventListener('click', closeObjectionModal);

    objectionModal.addEventListener('click', (e) => {
      if (e.target === objectionModal) {
        closeObjectionModal();
      }
    });

    function sendObjection() {
      const text = (objectionInput.value || '').trim();
      if (!text) {
        alert('Type the customer’s objection or your question first.');
        return;
      }

      const label = safeTrim(vehicleLabelInput.value) || 'this vehicle';
      const price = safeTrim(priceInfoInput.value) || 'Message for current pricing';

      objectionMessages.push({ role: 'user', content: text });
      renderObjectionChat();
      objectionInput.value = '';

      objectionSendButton.disabled = true;
      const oldText = objectionSendButton.innerHTML;
      objectionSendButton.innerHTML = '<span>⏳ Coaching…</span>';

      callJson('/api/objection-coach', {
        messages: objectionMessages,
        label,
        price,
      })
        .then((resp) => {
          if (!resp.success) throw new Error('API error');
          const reply = resp.reply || '';
          objectionMessages.push({ role: 'assistant', content: reply });
          renderObjectionChat();
        })
        .catch((err) => {
          console.error(err);
          alert('Error generating a response. Try again.');
        })
        .finally(() => {
          objectionSendButton.disabled = false;
          objectionSendButton.innerHTML = oldText;
        });
    }

    objectionSendButton.addEventListener('click', sendObjection);

    objectionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        sendObjection();
      }
    });

    // ----- Payment Calculator modal logic -----

    function openPaymentModal() {
      paymentModal.classList.remove('hidden');
      setTimeout(() => payPrice.focus(), 50);
    }
    function closePaymentModal() {
      paymentModal.classList.add('hidden');
    }

    paymentLauncher.addEventListener('click', openPaymentModal);
    paymentCloseButton.addEventListener('click', closePaymentModal);
    paymentModal.addEventListener('click', (e) => {
      if (e.target === paymentModal) closePaymentModal();
    });

    function calculatePayment() {
      const price = parseFloat(payPrice.value) || 0;
      const down = parseFloat(payDown.value) || 0;
      const apr = parseFloat(payApr.value) || 0;
      const term = parseInt(payTerm.value, 10) || 0;

      const loanAmount = price - down;
      if (loanAmount <= 0 || term <= 0) {
        paymentResultText.textContent = 'Enter a valid price, down payment, and term.';
        return;
      }

      const monthlyRate = apr > 0 ? (apr / 100) / 12 : 0;
      let payment;
      if (monthlyRate === 0) {
        payment = loanAmount / term;
      } else {
        const pow = Math.pow(1 + monthlyRate, term);
        payment = loanAmount * (monthlyRate * pow) / (pow - 1);
      }

      paymentResultText.textContent =
        'Estimated Payment: $' + payment.toFixed(2) + ' / month (rough estimate, not final finance terms).';
    }

    paymentCalcButton.addEventListener('click', calculatePayment);

    // ----- Income Calculator modal logic -----

    function openIncomeModal() {
      incomeModal.classList.remove('hidden');
      setTimeout(() => incHourly.focus(), 50);
    }
    function closeIncomeModal() {
      incomeModal.classList.add('hidden');
    }

    incomeLauncher.addEventListener('click', openIncomeModal);
    incomeCloseButton.addEventListener('click', closeIncomeModal);
    incomeModal.addEventListener('click', (e) => {
      if (e.target === incomeModal) closeIncomeModal();
    });

    function calculateIncome() {
      const hourly = parseFloat(incHourly.value) || 0;
      const hoursPerWeek = parseFloat(incHours.value) || 0;

      if (hourly <= 0 || hoursPerWeek <= 0) {
        incomeResultText.textContent = 'Enter a valid hourly wage and hours per week.';
        return;
      }

      const yearly = hourly * hoursPerWeek * 52;
      incomeResultText.textContent =
        'Estimated Yearly Gross Income: $' + yearly.toFixed(2);
    }

    incomeCalcButton.addEventListener('click', calculateIncome);

    // ----- Message Builder modal logic -----

    function openMessageModal() {
      messageModal.classList.remove('hidden');
      setTimeout(() => msgGoal.focus(), 50);
    }
    function closeMessageModal() {
      messageModal.classList.add('hidden');
    }

    messageLauncher.addEventListener('click', openMessageModal);
    messageCloseButton.addEventListener('click', closeMessageModal);
    messageModal.addEventListener('click', (e) => {
      if (e.target === messageModal) closeMessageModal();
    });

    async function generateMessages() {
      const channel = msgChannel.value || 'sms';
      const tone = msgTone.value || 'friendly';
      const followups = parseInt(msgFollowups.value, 10) || 4;
      const variants = parseInt(msgVariants.value, 10) || 2;
      const audience = safeTrim(msgAudience.value) || 'car buyer';
      const goal = safeTrim(msgGoal.value);
      const details = safeTrim(msgDetails.value);

      if (!goal && !details) {
        alert('Tell the AI what you’re trying to accomplish or give some details.');
        return;
      }

      messageGenerateButton.disabled = true;
      const oldText = messageGenerateButton.innerHTML;
      messageGenerateButton.innerHTML = '<span>⏳ Building…</span>';
      msgResult.value = 'Thinking up your messages and workflows…';

      try {
        const resp = await callJson('/api/ai-message', {
          channel,
          goal,
          details,
          audience,
          tone,
          followups,
          variants,
        });

        let display = '';

        if (Array.isArray(resp.variants)) {
          resp.variants.forEach((variant, idx) => {
            display += '=== Campaign Option ' + (idx + 1) + ' ===\\n\\n';
            if (variant.primaryMessage) {
              display += 'Primary Message:\\n' + variant.primaryMessage + '\\n\\n';
            }
            if (Array.isArray(variant.campaign)) {
              display += 'Follow-up Workflow:\\n';
              variant.campaign.forEach((step, sIdx) => {
                display +=
                  '\\nStep ' + (sIdx + 1) +
                  ' - Day ' + (step.dayOffset ?? '?') +
                  ' (' + (step.channel || 'sms') + ')';
                if (step.purpose) display += '\\nPurpose: ' + step.purpose;
                if (step.message) display += '\\nMessage: ' + step.message;
                display += '\\n';
              });
            }
            display += '\\n';
          });
        } else {
          display = 'No variants data returned from AI.';
        }

        msgResult.value = display || 'No data returned.';
      } catch (err) {
        console.error(err);
        msgResult.value = 'Error generating AI message workflow. Try again.';
      } finally {
        messageGenerateButton.disabled = false;
        messageGenerateButton.innerHTML = oldText;
      }
    }

    messageGenerateButton.addEventListener('click', generateMessages);

    // initial render
    renderObjectionChat();
  </script>
</body>
</html>`);
});

// ---------------- Start server ----------------

app.listen(port, () => {
  console.log(`Lot Rocket server running on port ${port}`);
});
