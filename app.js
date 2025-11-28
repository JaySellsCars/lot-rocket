// app.js – Lot Rocket backend (APIs only, frontend served from /public/index.html)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// ---------- OpenAI client ----------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Middleware ----------
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

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

Write ONLY the post body text f
