// app.js – Lot Rocket Social Media Kit backend (Render-safe)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const cheerio = require('cheerio');
const OpenAI = require('openai');

// Use global fetch if available (Node 18+/22+). Fallback to node-fetch only if needed.
let fetchFn = global.fetch;
if (!fetchFn) {
  fetchFn = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args));
}
const fetch = (...args) => fetchFn(...args);

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Serve static app from /public
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------- Helper: scrape vehicle page ----------------

async function scrapeVehiclePage(pageUrl) {
  try {
    const res = await fetch(pageUrl);
    if (!res.ok) {
      console.error('SCRAPE ERROR: bad status', res.status, res.statusText);
      return {
        title: '',
        priceText: '',
        textBlob: '',
        photos: [],
      };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const base = new URL(pageUrl);

    // title & price guesses
    let title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text() ||
      '';
    title = title.trim();

    let priceText =
      $('[class*="price"], [id*="price"]')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim() || '';

    // text blob for context
    let textPieces = [];
    $('body')
      .find('p, li, h1, h2, h3, h4')
      .each((_, el) => {
        const t = $(el).text().replace(/\s+/g, ' ').trim();
        if (t.length > 40 && t.length < 400) {
          textPieces.push(t);
        }
      });
    const textBlob = textPieces.slice(0, 20).join('\n');

    // grab images
    const photoSet = new Set();
    $('img').each((_, el) => {
      let src = $(el).attr('data-src') || $(el).attr('src');
      if (!src) return;

      src = src.trim();
      if (!src) return;

      try {
        const url = new URL(src, base.origin);
        const urlStr = url.toString();

        if (
          urlStr.match(/logo|icon|sprite|badge|favicon/i) ||
          urlStr.match(/320x50|tracking|pixel/i)
        ) {
          return;
        }
        photoSet.add(urlStr);
      } catch {
        // ignore malformed URLs
      }
    });

    return {
      title,
      priceText,
      textBlob,
      photos: Array.from(photoSet),
    };
  } catch (err) {
    console.error('SCRAPE ERROR:', err);
    return {
      title: '',
      priceText: '',
      textBlob: '',
      photos: [],
    };
  }
}

// ---------------- /boost – main Social Kit engine ----------------

app.post('/boost', async (req, res) => {
  try {
    const { dealerUrl, vehicleLabel, priceInfo } = req.body || {};
    console.log('BOOST HIT with URL:', dealerUrl);

    if (!dealerUrl || typeof dealerUrl !== 'string') {
      console.error('BOOST ERROR: missing dealerUrl');
      return res.status(400).json({ error: 'Missing or invalid dealerUrl.' });
    }

    const safeVehicleLabel =
      (vehicleLabel && String(vehicleLabel).trim()) || 'this vehicle';
    const safePriceInfo =
      (priceInfo && String(priceInfo).trim()) || 'Message for current pricing';

    const scraped = await scrapeVehiclePage(dealerUrl);
    const {
      title: scrapedTitle,
      priceText: scrapedPriceText,
      textBlob,
      photos,
    } = scraped;

    const contextSummary = `
Dealer URL: ${dealerUrl}
Front-end label: ${safeVehicleLabel}
Front-end price note: ${safePriceInfo}

Scraped page title: ${scrapedTitle || '(none)'}
Scraped price text: ${scrapedPriceText || '(none)'}
Scraped text blob (snippets):
${textBlob || '(none)'}
    `.trim();

    const systemPrompt = `
You are Lot Rocket, an elite automotive social media copywriter.
You create concise, high-converting copy for car salespeople (NOT the store itself).

Return ONLY valid JSON with no explanation or Markdown. Use this exact JSON shape:

{
  "listingSummary": "short 2–4 sentence summary of the vehicle and its key selling points",
  "facebookPost": "high-converting FB post with hook, emojis optional, clear CTA to message salesperson",
  "instagramPost": "IG caption vibe, short hook, a few emojis, CTA to DM or comment",
  "tiktokPost": "TikTok-style caption with energy + emojis, CTA to comment or DM, 1–2 hooks",
  "linkedinPost": "More professional tone, focused on value, trust, and service",
  "twitterPost": "Short snappy X/Twitter post, under 240 characters",
  "textMessage": "SMS-style, friendly but direct, invites reply. No more than 2–3 sentences.",
  "marketplacePost": "Description suitable for Facebook Marketplace, mentions condition, mileage (if given), payment/contact angle",
  "hashtags": "a compact line of relevant hashtags, tuned for this specific vehicle (NOT generic junk)",
  "videoScript": "Short vertical video script the salesperson can read on camera in ~25–35 seconds",
  "shotPlan": "Bullet-style shot list for a 20–30 second vertical video using typical dealer photos",
  "designLayout": "A simple Canva-style layout plan in 4–7 bullet points for a single static graphic"
}

Guidelines:
- Assume the salesperson will tweak details like price/miles if missing or approximate.
- Speak as the salesperson, first person singular ("I", "me") where appropriate.
- Do NOT mention scraping or AI.
- Strong but honest – no unrealistic claims.
    `.trim();

    const userPrompt = `
Use this context about the vehicle and dealer page:

${contextSummary}

Vehicle label the salesperson is using:
"${safeVehicleLabel}"

Preferred price/deal note on the front-end:
"${safePriceInfo}"

Now generate the JSON object described in the instructions.
    `.trim();

    let parsed = {};
    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content || '{}';
      parsed = JSON.parse(raw);
    } catch (modelErr) {
      console.error('OPENAI /boost ERROR:', modelErr);
      parsed = {};
    }

    const payload = {
      listingSummary: parsed.listingSummary || '',
      facebookPost: parsed.facebookPost || '',
      instagramPost: parsed.instagramPost || '',
      tiktokPost: parsed.tiktokPost || '',
      linkedinPost: parsed.linkedinPost || '',
      twitterPost: parsed.twitterPost || '',
      textMessage: parsed.textMessage || '',
      marketplacePost: parsed.marketplacePost || '',
      hashtags: parsed.hashtags || '',
      videoScript: parsed.videoScript || '',
      shotPlan: parsed.shotPlan || '',
      designLayout: parsed.designLayout || '',
      photos,
      scrapedTitle,
      scrapedPriceText,
    };

    res.json(payload);
  } catch (err) {
    console.error('BOOST FATAL ERROR:', err);
    res.status(500).json({
      error: 'Something went wrong boosting this listing. Try again in a moment.',
    });
  }
});

// ---------------- Objection Coach ----------------

app.post('/api/objection-coach', async (req, res) => {
  try {
    const { history, objection, vehicleLabel } = req.body || {};

    const safeHistory = Array.isArray(history) ? history : [];
    const safeObjection = (objection || '').toString().trim();
    const safeVehicle = (vehicleLabel || 'this vehicle').toString().trim();

    if (!safeObjection) {
      return res.status(400).json({ error: 'Missing objection text.' });
    }

    const historyText = safeHistory
      .map((item, idx) => `#${idx + 1} ${item}`)
      .join('\n');

    const systemPrompt = `
You are an elite automotive objection-handling coach.
You help a car salesperson respond calmly and confidently.

Return a SHORT playbook:
- 1–2 sentences acknowledging the objection.
- 3–5 bullet points: how to respond and what to say.
- Optional closing line calling them to next step (visit, test drive, or call).

Tone: confident, kind, no pressure, very human.
Do NOT mention AI or that this is "coaching".
    `.trim();

    const userPrompt = `
Vehicle: ${safeVehicle}

Latest customer objection:
"${safeObjection}"

Recent conversation history (if any):
${historyText || '(none given)'}

Give me a short objection-handling playbook the salesperson can use right now.
    `.trim();

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || '';
    res.json({ reply });
  } catch (err) {
    console.error('OBJECTION ERROR:', err);
    res.status(500).json({ error: 'Error generating objection response.' });
  }
});

// ---------------- Payment Helper ----------------

app.post('/api/payment-helper', async (req, res) => {
  try {
    const {
      vehicleLabel,
      priceInfo,
      creditProfile,
      targetPayment,
    } = req.body || {};

    const safeVehicle = (vehicleLabel || 'this vehicle').toString().trim();
    const safePrice = (priceInfo || '').toString().trim();
    const safeProfile = (creditProfile || '').toString().trim();
    const safeTarget = (targetPayment || '').toString().trim();

    const systemPrompt = `
You help car salespeople talk about payments in a clear, honest way.
You are NOT giving financial advice. You are giving talk tracks.

Return:
1) A short script (3–6 sentences) the salesperson can say.
2) 3–5 bullet points with ways to position the deal (terms, down payment, trade, etc.).
Keep everything high-level with disclaimers; no specific financial guarantees.
    `.trim();

    const userPrompt = `
Vehicle: ${safeVehicle}
Price / deal info: ${safePrice || '(none given)'}
Customer credit or situation: ${safeProfile || '(not specified)'}
Target payment mentioned: ${safeTarget || '(not specified)'}

Give me a brief talk track + bullets I can use to discuss payments safely and clearly.
    `.trim();

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content || '';
    res.json({ text });
  } catch (err) {
    console.error('PAYMENT HELPER ERROR:', err);
    res.status(500).json({ error: 'Error generating payment helper text.' });
  }
});

// ---------------- Income Helper ----------------

app.post('/api/income-helper', async (req, res) => {
  try {
    const { vehicleLabel, householdIncome, otherDebts } = req.body || {};

    const safeVehicle = (vehicleLabel || 'this vehicle').toString().trim();
    const safeIncome = (householdIncome || '').toString().trim();
    const safeDebts = (otherDebts || '').toString().trim();

    const systemPrompt = `
You help car salespeople talk about "comfortable" payment ranges
in a general, educational way. You are NOT giving formal financial advice.

Return:
- 2–3 sentences explaining how people can think about a comfortable payment range.
- 3–4 bullet points on questions to ask and how to guide them.
Include a gentle disclaimer that final decisions should be based on the customer's budget and any lender guidelines.
    `.trim();

    const userPrompt = `
Vehicle: ${safeVehicle}
Customer household income mentioned: ${safeIncome || '(not specified)'}
Other debts or obligations mentioned: ${safeDebts || '(not specified)'}

Give me language I can use to talk about a comfortable payment range in general terms.
    `.trim();

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content || '';
    res.json({ text });
  } catch (err) {
    console.error('INCOME HELPER ERROR:', err);
    res.status(500).json({ error: 'Error generating income helper text.' });
  }
});

// ---------------- Message Helper ----------------

app.post('/api/message-helper', async (req, res) => {
  try {
    const {
      channel,
      vibe,
      context,
      vehicleLabel,
      customerName,
    } = req.body || {};

    const safeChannel = (channel || 'text').toString().trim();
    const safeVibe = (vibe || 'friendly, confident').toString().trim();
    const safeContext = (context || '').toString().trim();
    const safeVehicle = (vehicleLabel || 'this vehicle').toString().trim();
    const safeName = (customerName || '').toString().trim();

    const systemPrompt = `
You write short, highly usable outreach messages for car salespeople.

Requirements:
- 1–3 sentences max; super tight.
- Sound like a real human, not a template robot.
- Include a clear but low-pressure call to action.
- Adapt tone for the channel: text, DM, email, etc.
    `.trim();

    const userPrompt = `
Channel: ${safeChannel}
Tone / vibe: ${safeVibe}
Customer name (if any): ${safeName || '(none given)'}
Vehicle: ${safeVehicle}
Context: ${safeContext || '(no extra context)'}

Write ONE message I can copy-paste and send.
    `.trim();

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
    });

    const text = completion.choices[0]?.message?.content || '';
    res.json({ text });
  } catch (err) {
    console.error('MESSAGE HELPER ERROR:', err);
    res.status(500).json({ error: 'Error generating message helper text.' });
  }
});

// ---------------- Start server ----------------

app.listen(port, () => {
  console.log(`Lot Rocket backend running on port ${port}`);
});
