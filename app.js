// app.js
// Lot Rocket unified server:
// - Scrapes vehicle photos (skeleton)
// - AI message + multi-campaign workflow generator
// - Simple frontend with toolbar, calculators, and AI tool

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 10000; // Render will use its own PORT env

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- Helper: scrape vehicle photos (with URL validation) ----------------

async function scrapeVehiclePhotos(pageUrl) {
  try {
    // Make sure we actually got a URL, not a VIN or random text
    let urlObj;
    try {
      urlObj = new URL(pageUrl);
    } catch {
      console.error(
        'scrapeVehiclePhotos: invalid pageUrl, expected a full URL but got:',
        pageUrl
      );
      return [];
    }

    const res = await fetch(urlObj.toString());
    if (!res.ok) {
      console.error('Failed to fetch page for photos:', res.status);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const urls = new Set();

    $('img').each((i, el) => {
      let src = $(el).attr('data-src') || $(el).attr('src');
      if (!src) return;

      // Resolve relative URLs against the page URL
      try {
        const full = new URL(src, urlObj).toString();
        urls.add(full);
      } catch (e) {
        console.warn('Bad image URL, skipping:', src);
      }
    });

    return Array.from(urls);
  } catch (err) {
    console.error('Error scraping vehicle photos:', err.message);
    return [];
  }
}

// ---------------- API: main vehicle processing pipeline ----------------

app.post('/api/process-vehicle', async (req, res) => {
  const { dealerUrl } = req.body;
  if (!dealerUrl) {
    return res.status(400).json({ error: 'dealerUrl is required' });
  }

  // Validate that dealerUrl is a real URL (not a bare VIN)
  let validDealerUrl;
  try {
    validDealerUrl = new URL(dealerUrl).toString();
  } catch {
    return res.status(400).json({
      error:
        'dealerUrl must be a full URL, e.g. https://example.com/vehicle/123',
      received: dealerUrl,
    });
  }

  try {
    // 1) Scrape photos
    const photos = await scrapeVehiclePhotos(validDealerUrl);

    // 2) TODO: call image enhancement pipeline (watermark removal, quality boost)

    // 3) TODO: call OpenAI to generate high-converting copy + video script

    // 4) TODO: (future) auto-post to Facebook Marketplace + social channels

    res.json({
      dealerUrl: validDealerUrl,
      photos,
      message:
        'Pipeline skeleton working. Next step: plug in image + copy + video + posting logic.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------- AI Message & Multi-Campaign Generator API ----------------

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

    // Clamp variants & followups to sane ranges
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
      return res.status(500).json({ error: 'AI response was not valid JSON.', raw });
    }

    if (!Array.isArray(parsed.variants)) {
      return res.status(500).json({
        error: 'AI response JSON missing "variants" array.',
        raw,
      });
    }

    res.json(parsed);
  } catch (err) {
    console.error('Error in /api/ai-message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------- Simple Frontend UI: Toolbar + Calculators + AI Tool ----------------

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-widt
