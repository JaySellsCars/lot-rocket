// app.js – Lot Rocket Social Media Kit with Objection Coach + Design Lab + Tool Modals

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

// AI Message & Campaign Builder prompt
function buildAiMessagePrompt({ channel, goal, details, audience, tone, followups, variants }) {
  return `
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
- Only output JSON. Do not include any extra commentary, markdown, or code fences.`;
}

// ---------------- OpenAI helpers ----------------

async function callOpenAIForJSON(prompt) {
  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: prompt,
  });

  const content = response.output[0].content[0].text;
  return JSON.parse(content);
}

async function callOpenAIForText(prompt) {
  const response = await client.responses.create({
    model: 'gpt-4.1-mini',
    input: prompt,
  });

  const parts = response.output[0].content;
  const textPart = parts.find((p) => p.type === 'output_text') || parts[0];
  return textPart.text;
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
    const pro
