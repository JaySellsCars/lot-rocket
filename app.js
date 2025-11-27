// app.js – Lot Rocket backend (APIs only, frontend served from /public/index.html)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const cheerio = require('cheerio');
const path = require('path');

// If your Node version is older than 18, uncomment this:
// const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

Vehicle label: "${label}"
Pricing/deal phrase: "${price || 'Message for current pricing'}"
Vehicle URL: ${url}

Goal:
- Copy/paste-ready posts for all platforms.
- Strong hooks, modern writing.
- Human salesperson tone.

Return ONLY JSON:
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

Rules:
- 900 char max each
- No explanations or code blocks
- No hashtags inside posts (only inside "hashtags")
- TikTok = short lines
- Marketplace = clean description with light emojis
- videoScript = 30–40 seconds
- shotPlan = 5–10 bullets
`;
}

function buildSinglePostPrompt({ platform, label, price, url }) {
  return `
You are writing a scroll-stopping social media post for a car salesperson.

Platform: ${platform}
Vehicle: "${label}"
Pricing/deal phrase: "${price || 'Message for current pricing'}"
Vehicle URL: ${url}

Tone:
- Confident, friendly salesperson
- Modern, real, high-energy

Rules:
- facebook/instagram/linkedin/marketplace: 3–10 short lines
- tiktok: 3–8 punchy lines
- twitter: 1–3 lines allowed to have inline hashtags
- textBlurb: super short 1–3 lines
- hashtags: ONLY hashtag line

Return ONLY the post text.
`;
}

function buildVideoScriptPrompt({ label, price, url }) {
  return `
Write a 30–40s vertical video script for a car salesperson.

Vehicle: "${label}"
Pricing/deal phrase: "${price || 'Message for current pricing'}"
URL: ${url}

Style:
- High-energy, confident, ethical
- Talks to viewer like a human
- 4–8 short paragraphs
- CTA at end

Return ONLY the script.
`;
}

function buildObjectionSystemPrompt({ label, price }) {
  return `
You are an automotive objections specialist (Andy Elliott style).

Vehicle: "${label || 'this vehicle'}"
Deal phrase: "${price || 'Message for current pricing'}"

Rules:
- Talk to the salesperson, not the customer.
- SHORT, punchy lines.
- Each answer:
  1) Acknowledge + align
  2) Reframe logically/emotionally
  3) Ask 1–2 strong questions
  4) Give word tracks they can say

Be ethical. No pressure tactics. Modern, confident coaching.
`;
}

function buildDesignPrompt({ type, label, price, url }) {
  return `
You are helping a car salesperson design a social graphic (Canva style).

Type: ${type}
Vehicle: "${label}"
Deal phrase: "${price || 'Message for current pricing'}"
URL: ${url}

Return sections:
1) TITLE text (big, bold)
2) SUBHEAD line
3) BODY bullet benefits (3–6, emojis allowed)
4) CTA text
5)
