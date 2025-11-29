// app.js – Lot Rocket backend (Express + OpenAI + scraping)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const OpenAI = require('openai');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

// --- OpenAI client ---
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

// Serve static frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

// Root route -> index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------------------------------------
// Helper: scrape useful text from dealer URL
// ------------------------------------------------------------
async function scrapePageText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Scrape failed: status', res.status);
      return { title: '', description: '', text: '' };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = ($('title').text() || '').trim();
    const description =
      ($('meta[name="description"]').attr('content') || '').trim();

    // Grab a bunch of text from likely content areas
    let chunks = [];
    $('h1, h2, h3, .vehicle-title, .vehicle-details, .price, .description, .specs')
      .each((_, el) => {
        const t = $(el).text().replace(/\s+/g, ' ').trim();
        if (t && !chunks.includes(t)) chunks.push(t);
      });

    const combined = chunks.join('\n');

    return {
      title,
      description,
      text: combined.slice(0, 6000), // keep it reasonable
    };
  } catch (err) {
    console.error('Error scraping page:', err);
    return { title: '', description: '', text: '' };
  }
}

// Small helper to talk to OpenAI safely
async function chatJSON(systemPrompt, userPrompt) {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '';

  // Try to parse JSON; fall back to a simple object if it fails.
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('JSON parse failed, returning raw text instead.');
    return { raw };
  }
}

// ------------------------------------------------------------
// POST /api/social-kit
// Builds the initial full kit (all platforms, script, design, etc.)
// ------------------------------------------------------------
app.post('/api/social-kit', async (req, res) => {
  const { url, label, price } = req.body || {};

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'Missing url',
    });
  }

  try {
    const scraped = await scrapePageText(url);

    const systemPrompt = `
You are an elite automotive copywriter who writes high-converting social media copy
for car salespeople (not dealerships). You MUST respond with valid JSON only.

JSON shape:
{
  "facebook": "...",
  "instagram": "...",
  "tiktok": "...",
  "linkedin": "...",
  "twitter": "...",
  "text": "...",           // short SMS / DM follow-up
  "marketplace": "...",    // FB Marketplace style listing
  "hashtags": "...",       // line of hashtags
  "videoScript": "...",    // 30-45s selfie-style script
  "videoShotPlan": "...",  // bullet list of shots for reels/TikTok
  "designIdea": "..."      // Canva layout checklist
}
Keep language friendly, confident and easy to paste directly into social posts.
Do not include explanations outside the JSON.
    `.trim();

    const userPrompt = `
Vehicle label: ${label || 'This vehicle'}
Deal info: ${price || 'Message for current pricing'}

Scraped page title:
${scraped.title}

Scraped description:
${scraped.description}

Scraped text:
${scraped.text}
    `.trim();

    const kit = await chatJSON(systemPrompt, userPrompt);

    // Basic guard: ensure keys exist
    const safeKit = {
      facebook: kit.facebook || kit.raw || '',
      instagram: kit.instagram || '',
      tiktok: kit.tiktok || '',
      linkedin: kit.linkedin || '',
      twitter: kit.twitter || '',
      text: kit.text || '',
      marketplace: kit.marketplace || '',
      hashtags: kit.hashtags || '',
      videoScript: kit.videoScript || '',
      videoShotPlan: kit.videoShotPlan || '',
      designIdea: kit.designIdea || '',
    };

    res.json({ success: true, kit: safeKit });
  } catch (err) {
    console.error('Error in /api/social-kit:', err);
    res.status(500).json({
      success: false,
      error: 'Server error building social kit',
    });
  }
});

// ------------------------------------------------------------
// POST /api/new-post  (spin a fresh post for a platform)
// ------------------------------------------------------------
app.post('/api/new-post', async (req, res) => {
  const { platform, url, label, price } = req.body || {};

  if (!platform || !url) {
    return res.status(400).json({ success: false, error: 'Missing platform or url' });
  }

  try {
    const scraped = await scrapePageText(url);

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: `
You are a high-converting social media copywriter for car salespeople.
Write one post tailored for the given platform. No intro, no explanation.
Just the finished post text the salesperson can paste.
          `.trim(),
        },
        {
          role: 'user',
          content: `
Platform: ${platform}
Vehicle: ${label || 'This vehicle'}
Deal info: ${price || 'Message for current pricing'}

Scraped details:
${scraped.title}
${scraped.description}
${scraped.text}
          `.trim(),
        },
      ],
    });

    const post = completion.choices[0]?.message?.content || '';
    res.json({ success: true, post });
  } catch (err) {
    console.error('Error in /api/new-post:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ------------------------------------------------------------
// POST /api/new-script – generate a fresh selfie video script
// ------------------------------------------------------------
app.post('/api/new-script', async (req, res) => {
  const { url, label, price } = req.body || {};

  if (!url) {
    return res.status(400).json({ success: false, error: 'Missing url' });
  }

  try {
    const scraped = await scrapePageText(url);

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `
You write tight 30–45 second selfie video scripts for car salespeople.
Use a strong hook, 3–4 punchy points, and a clear CTA to message or call.
Return ONLY the script, no extra commentary.
          `.trim(),
        },
        {
          role: 'user',
          content: `
Vehicle: ${label || 'This vehicle'}
Deal info: ${price || 'Message for current pricing'}

Details:
${scraped.title}
${scraped.description}
${scraped.text}
          `.trim(),
        },
      ],
    });

    const script = completion.choices[0]?.message?.content || '';
    res.json({ success: true, script });
  } catch (err) {
    console.error('Error in /api/new-script:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ------------------------------------------------------------
// POST /api/grab-photos – very simple image URL scraper
// ------------------------------------------------------------
app.post('/api/grab-photos', async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ success: false, error: 'Missing url' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res
        .status(500)
        .json({ success: false, error: 'Failed to fetch dealer page' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const photos = [];

    $('img').each((_, el) => {
      let src = $(el).attr('data-src') || $(el).attr('src');
      if (!src) return;

      // absolute-ize relative URLs
      try {
        const u = new URL(src, url);
        src = u.toString();
      } catch (_) {
        // ignore bad URLs
      }

      // basic filter to avoid tiny icons etc.
      const width = parseInt($(el).attr('width') || '0', 10);
      const height = parseInt($(el).attr('height') || '0', 10);
      if (width < 200 && height < 200) return;

      if (!photos.includes(src)) photos.push(src);
    });

    res.json({ success: true, photos });
  } catch (err) {
    console.error('Error in /api/grab-photos:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ------------------------------------------------------------
// POST /api/video-from-photos – quick shot plan from photo list
// ------------------------------------------------------------
app.post('/api/video-from-photos', async (req, res) => {
  const { photos, label } = req.body || {};

  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ success: false, error: 'No photos provided' });
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: `
You help car salespeople turn a batch of photos into a simple vertical video shot plan
for Reels/TikTok. Output a numbered list: which photos to show in what order,
what motion (pan/zoom), and on-screen text ideas.
          `.trim(),
        },
        {
          role: 'user',
          content: `
Vehicle: ${label || 'This vehicle'}
There are ${photos.length} photos available.

Give me a short, step-by-step shot plan.
          `.trim(),
        },
      ],
    });

    const plan = completion.choices[0]?.message?.content || '';
    res.json({ success: true, plan });
  } catch (err) {
    console.error('Error in /api/video-from-photos:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ------------------------------------------------------------
// POST /api/design-idea – Canva layout checklist
// ------------------------------------------------------------
app.post('/api/design-idea', async (req, res) => {
  const { type, url, label, price } = req.body || {};

  if (!url) {
    return res.status(400).json({ success: false, error: 'Missing url' });
  }

  try {
    const scraped = await scrapePageText(url);

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `
You are a Canva layout planner for automotive creatives.
Return a bullet/checklist style plan: where to put headline, photo,
badges, price, CTA, and any overlays or accents.
          `.trim(),
        },
        {
          role: 'user',
          content: `
Creative type: ${type || 'Facebook / Instagram feed post'}
Vehicle: ${label || 'This vehicle'}
Deal info: ${price || 'Message for current pricing'}

Details:
${scraped.title}
${scraped.description}
${scraped.text}
          `.trim(),
        },
      ],
    });

    const design = completion.choices[0]?.message?.content || '';
    res.json({ success: true, design });
  } catch (err) {
    console.error('Error in /api/design-idea:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ------------------------------------------------------------
// POST /api/objection-coach – objection handling chat
// ------------------------------------------------------------
app.post('/api/objection-coach', async (req, res) => {
  const { messages, label, price } = req.body || {};
  const history = Array.isArray(messages) ? messages : [];

  try {
    const chatMessages = [
      {
        role: 'system',
        content: `
You are an objection-handling coach for a car salesperson.
Be concise, positive, and honest. Use plain language.
Treat "user" messages as the salesperson describing the customer's objection.
Respond with how the salesperson should reply.
        `.trim(),
      },
      ...history.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
      })),
      {
        role: 'system',
        content: `Vehicle: ${label || 'This vehicle'} | Deal info: ${
          price || 'Message for current pricing'
        }`,
      },
    ];

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: chatMessages,
    });

    const reply = completion.choices[0]?.message?.content || '';
    res.json({ success: true, reply });
  } catch (err) {
    console.error('Error in /api/objection-coach:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ------------------------------------------------------------
// (Optional) simple helpers for payment / income / messages
// If your frontend calls them, they’ll be available.
// ------------------------------------------------------------
app.post('/api/payment-helper', async (req, res) => {
  const { price, termMonths, rateApr } = req.body || {};
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You help estimate car payments. Be concise. Return a short explanation and approximate monthly payment.',
        },
        {
          role: 'user',
          content: `Price: ${price}, Term: ${termMonths} months, APR: ${rateApr}%`,
        },
      ],
    });
    const result = completion.choices[0]?.message?.content || '';
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error in /api/payment-helper:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/income-helper', async (req, res) => {
  const { targetPayment } = req.body || {};
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You help estimate what income might be needed for a target car payment. Be clear that this is a rough rule-of-thumb, not financial advice.',
        },
        {
          role: 'user',
          content: `Target payment: ${targetPayment} per month`,
        },
      ],
    });
    const result = completion.choices[0]?.message?.content || '';
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error in /api/income-helper:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/message-helper', async (req, res) => {
  const { context } = req.body || {};
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content:
            'You draft short, friendly follow-up messages for car shoppers. Respond with just the message text.',
        },
        {
          role: 'user',
          content: context || 'Follow up with a shopper who inquired yesterday.',
        },
      ],
    });
    const result = completion.choices[0]?.message?.content || '';
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error in /api/message-helper:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------
app.listen(port, () => {
  console.log(`Lot Rocket backend running on port ${port}`);
});
