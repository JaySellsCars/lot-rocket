// app.js – Lot Rocket V2 backend with new AI tools

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Middleware ----------
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------

async function fetchHtml(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status}`);
  }
  return await res.text();
}

function extractMainText(html, pageUrl) {
  const $ = cheerio.load(html);

  const title = $('title').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';

  let textChunks = [];
  $('p, h1, h2, h3, li').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length > 30 && t.length < 600) {
      textChunks.push(t);
    }
  });

  const bodyText = textChunks.join('\n');

  return {
    title,
    metaDesc,
    bodyText,
    pageUrl,
  };
}

function extractPhotos(html, pageUrl) {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);

  const urls = new Set();

  $('img').each((_, el) => {
    let src =
      $(el).attr('data-src') ||
      $(el).attr('data-lazy-src') ||
      $(el).attr('src');

    if (!src) return;

    if (/logo|icon|sprite|placeholder|spacer/i.test(src)) return;
    if (src.startsWith('data:')) return;

    try {
      const abs = new URL(src, base).href;
      urls.add(abs);
    } catch {
      // ignore
    }
  });

  // TODO: future: scan <script> JSON blobs for image URLs

  return Array.from(urls).slice(0, 24);
}

function safeFirstTextFromResponse(result, fallback) {
  try {
    const c = result.output?.[0]?.content?.[0];
    if (!c) return fallback;
    if (typeof c.text === 'string') return c.text.trim() || fallback;
    if (typeof c === 'string') return c.trim() || fallback;
    return fallback;
  } catch {
    return fallback;
  }
}

// ---------- Routes ----------

// Root – serve app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Scraper: full social kit ----
app.post('/api/social-kit', async (req, res) => {
  const { url, label, price } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }

  try {
    const html = await fetchHtml(url);
    const scraped = extractMainText(html, url);
    const photos = extractPhotos(html, url);

    const payload = {
      vehicleLabel: label || scraped.title || '',
      priceInfo: price || '',
      metaDescription: scraped.metaDesc || '',
      mainText: scraped.bodyText || '',
      photos,
      sourceUrl: url,
    };

    const promptUser = `
You are Lot Rocket, an elite AI for automotive social media content.

You will receive scraped listing data for a single vehicle. 
Return ONLY JSON with fields:

{
  "facebook": "...",
  "instagram": "...",
  "tiktok": "...",
  "linkedin": "...",
  "twitter": "...",
  "sms": "...",
  "marketplace": "...",
  "hashtags": "...",
  "selfie_script": "...",
  "shot_plan": "...",
  "canva_idea": "..."
}

- Write like a top-performing car salesperson.
- Strong hooks and CTAs.
- Assume the salesperson is honest, friendly, and high-energy.
- DO NOT include explanations, backticks, or any extra keys.
- "hashtags" should be a single string with hashtags separated by spaces.
- "shot_plan" should be a short multi-step list in plain text.

SCRAPED DATA:
${JSON.stringify(payload, null, 2)}
`;

    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content:
            'You output STRICT JSON for an automotive social kit. No commentary.',
        },
        { role: 'user', content: promptUser },
      ],
      response_format: { type: 'json' },
    });

    let parsed;
    try {
      const raw = safeFirstTextFromResponse(result, '{}');
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('JSON parse error /api/social-kit', err);
      return res.status(500).json({ error: 'Failed to parse AI JSON.' });
    }

    res.json({
      kit: parsed,
      photos,
      meta: {
        label: payload.vehicleLabel,
        price: payload.priceInfo,
        url,
      },
    });
  } catch (err) {
    console.error('Error /api/social-kit:', err);
    res.status(500).json({ error: 'Failed to generate social kit.' });
  }
});

// ---- Scraper: photos only ----
app.post('/api/grab-photos', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required.' });

  try {
    const html = await fetchHtml(url);
    const photos = extractPhotos(html, url);
    res.json({ photos });
  } catch (err) {
    console.error('Error /api/grab-photos:', err);
    res.status(500).json({ error: 'Failed to grab photos.' });
  }
});

// ---- Regenerate a single platform post ----
app.post('/api/new-post', async (req, res) => {
  const { platform, context } = req.body || {};
  if (!platform) {
    return res.status(400).json({ error: 'platform is required.' });
  }

  const ctx = context || '';

  const sysPrompt =
    'You are Lot Rocket, writing high-converting posts for car salespeople. Keep it punchy, persuasive, honest, and platform-aware.';
  const userPrompt = `
Platform: ${platform}
Context:
${ctx}

Write a new post for this platform only. No hashtags unless it is Instagram or TikTok.
`;

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No post generated. Try again.'
    );
    res.json({ post: text });
  } catch (err) {
    console.error('Error /api/new-post:', err);
    res.status(500).json({ error: 'Failed to generate new post.' });
  }
});

// ---- New script (selfie video etc.) ----
app.post('/api/new-script', async (req, res) => {
  const { context } = req.body || {};
  const sys =
    'You are a charismatic car sales video script writer. You write short, punchy scripts designed to be recorded selfie-style on a phone.';
  const user = `
Context for the vehicle / offer / situation:
${context || ''}

Write a short, 30-60 second selfie video script in first person POV from the salesperson.
`;

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No script generated. Try again.'
    );
    res.json({ script: text });
  } catch (err) {
    console.error('Error /api/new-script:', err);
    res.status(500).json({ error: 'Failed to generate script.' });
  }
});

// ---- Video shot plan from photos ----
app.post('/api/video-from-photos', async (req, res) => {
  const { photoUrls, vehicleLabel } = req.body || {};
  const sys =
    'You are a video storyboard planner for social media car sales content.';
  const user = `
You will receive photo URLs and a vehicle label.
Suggest a short vertical video shot plan using those angles.

Vehicle: ${vehicleLabel || ''}

Photos:
${JSON.stringify(photoUrls || [], null, 2)}
`;

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No shot plan generated. Try again.'
    );
    res.json({ shotPlan: text });
  } catch (err) {
    console.error('Error /api/video-from-photos:', err);
    res.status(500).json({ error: 'Failed to generate shot plan.' });
  }
});

// ---- Canva layout idea ----
app.post('/api/design-idea', async (req, res) => {
  const { creativeType, headline, cta, vibe } = req.body || {};
  const sys =
    'You are a marketing designer describing simple Canva layout ideas for car sales graphics.';
  const user = `
Creative type: ${creativeType || 'social graphic'}
Headline: ${headline || ''}
CTA: ${cta || ''}
Vibe: ${vibe || ''}

Describe a simple layout in bullet points that someone could build in Canva.
`;

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No layout idea generated. Try again.'
    );
    res.json({ layout: text });
  } catch (err) {
    console.error('Error /api/design-idea:', err);
    res.status(500).json({ error: 'Failed to generate layout idea.' });
  }
});

// ---- Objection coach ----
app.post('/api/objection-coach', async (req, res) => {
  const { objection, context } = req.body || {};
  const sys =
    'You are an automotive sales trainer coaching a salesperson on how to respond to objections. You speak in script form.';
  const user = `
Customer objection:
${objection || ''}

Context:
${context || ''}

Give the salesperson 2-3 different word-for-word ways to respond.
`;

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No coaching script generated.'
    );
    res.json({ advice: text });
  } catch (err) {
    console.error('Error /api/objection-coach:', err);
    res.status(500).json({ error: 'Failed to coach objection.' });
  }
});

// ---- Payment helper ----
app.post('/api/payment-helper', async (req, res) => {
  const { price, down, termMonths, rate } = req.body || {};

  const sys =
    'You are a car payment explainer. You help salespeople estimate payments and explain options. Do not give legal or binding finance advice.';
  const user = `
Vehicle price: ${price || ''}
Down payment: ${down || ''}
Term months: ${termMonths || ''}
Interest rate guess: ${rate || ''}

1) Give a rough estimated monthly payment.
2) Offer 2-3 alternative structures (more down, shorter term, etc.).
3) Write a short text message the salesperson can send to the customer.
`;

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No payment help generated.'
    );
    res.json({ paymentHelp: text });
  } catch (err) {
    console.error('Error /api/payment-helper:', err);
    res.status(500).json({ error: 'Failed to generate payment help.' });
  }
});

// ---- Income helper ----
app.post('/api/income-helper', async (req, res) => {
  const { paymentTarget, otherDebts, termMonths, rate } = req.body || {};

  const sys =
    'You are a car income explainer. You help estimate how much income a person might need for a target car payment. You are approximate and conservative.';
  const user = `
Target payment: ${paymentTarget || ''}
Other monthly debts: ${otherDebts || ''}
Term months: ${termMonths || ''}
Interest rate guess: ${rate || ''}

1) Roughly estimate income needed to comfortably handle this payment.
2) Explain in simple language.
3) Write a short text message the salesperson can send to the customer.
`;

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No income help generated.'
    );
    res.json({ incomeHelp: text });
  } catch (err) {
    console.error('Error /api/income-helper:', err);
    res.status(500).json({ error: 'Failed to generate income help.' });
  }
});

// ---- Message helper (old AI message expert / workflow-ish) ----
app.post('/api/message-helper', async (req, res) => {
  const { situation, customerType } = req.body || {};

  const sys =
    'You are a follow-up messaging coach for car salespeople. You help them decide how to structure their outreach.';
  const user = `
Customer situation:
${situation || ''}

Customer type:
${customerType || ''}

1) Suggest a basic follow-up workflow (how many touches, in what order).
2) Give examples of what to say in each step.
`;

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No workflow generated.'
    );
    res.json({ workflow: text });
  } catch (err) {
    console.error('Error /api/message-helper:', err);
    res.status(500).json({ error: 'Failed to generate workflow.' });
  }
});

// ---- NEW: AI Message Builder (pure copy expert) ----
app.post('/api/message-builder', async (req, res) => {
  const { type, goal, details } = req.body || {};

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content:
            'You are an elite automotive sales copywriter. You write short, high-converting messages. Be clear, friendly, confident, and persuasive.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            type: type || 'text',
            goal: goal || '',
            details: details || '',
          }),
        },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No message was generated. Try again with more details.'
    );
    res.json({ message: text });
  } catch (err) {
    console.error('Error /api/message-builder:', err);
    res.status(500).json({ error: 'Failed to generate message.' });
  }
});

// ---- NEW: Ask A.I. (general brain) ----
app.post('/api/ask-ai', async (req, res) => {
  const { question } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content:
            'You are a helpful, general-purpose AI assistant built into a tool called Lot Rocket. Answer clearly and helpfully.',
        },
        { role: 'user', content: question },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No answer generated. Try rephrasing your question.'
    );
    res.json({ answer: text });
  } catch (err) {
    console.error('Error /api/ask-ai:', err);
    res.status(500).json({ error: 'Failed to answer question.' });
  }
});

// ---- NEW: AI Car Expert ----
app.post('/api/car-expert', async (req, res) => {
  const { question } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  try {
    const result = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content:
            'You are an automotive product specialist and sales trainer. You know trims, features, warranties, financing, leasing, and how to explain vehicles to normal people. Speak like a friendly, confident car expert. Avoid made-up hard numbers.',
        },
        { role: 'user', content: question },
      ],
    });

    const text = safeFirstTextFromResponse(
      result,
      'No automotive answer generated.'
    );
    res.json({ answer: text });
  } catch (err) {
    console.error('Error /api/car-expert:', err);
    res.status(500).json({ error: 'Failed to answer automotive question.' });
  }
});

// ---------- Start server ----------
app.listen(port, () => {
  console.log(`Lot Rocket server running on port ${port}`);
});
