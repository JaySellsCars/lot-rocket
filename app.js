// app.js - Lot Rocket (single file)

// ----------------- SETUP -----------------
const express = require('express');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());

// ----------------- SIMPLE SCRAPERS -----------------

// Grab HTML from dealer page
async function fetchHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch dealer page');
  return await res.text();
}

// Extract a basic label (year make model + city/state if present)
function extractLabelFromHtml(html, fallbackUrl) {
  // Try <title> first
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const titleText = titleMatch[1].trim();
    // Example: "Used 2024 Kia Sorento X-Line SX in NOVI, MI | Feldman ..."
    const inIdx = titleText.toLowerCase().indexOf(' in ');
    const pipeIdx = titleText.indexOf('|');
    let core = titleText;

    if (pipeIdx > -1) core = core.slice(0, pipeIdx).trim();
    if (inIdx > -1) {
      const left = core.slice(0, inIdx).trim();
      const right = core.slice(inIdx + 4).trim(); // after " in "
      return `${left} in ${right}`;
    }
    return core;
  }

  // Fallback: parse from URL segments
  try {
    const u = new URL(fallbackUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    // look for segment that contains year-make-model
    const candidate = parts.find(p => /\d{4}/.test(p)) || parts[parts.length - 1];
    const cleaned = decodeURIComponent(candidate)
      .replace(/[-+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  } catch {
    return 'this vehicle';
  }
}

// Extract price or "Reduced by" phrase
function extractPriceFromHtml(html) {
  // Try "Reduced by $X since ..." first
  const reducedMatch = html.match(/Reduced by\s*\$?([0-9,]+)[^<]{0,60}?since[^<]{0,60}?(\d{4})/i);
  if (reducedMatch) {
    return `Reduced by $${reducedMatch[1]} since ${reducedMatch[2]}`;
  }

  // Try generic "Reduced by $X since <date>"
  const reducedFullMatch = html.match(/Reduced by[^<]+/i);
  if (reducedFullMatch) {
    return reducedFullMatch[0].trim();
  }

  // Try a standard "$XX,XXX" price
  const priceMatch = html.match(/\$\s*[0-9]{2,3},[0-9]{3}/);
  if (priceMatch) {
    return priceMatch[0].replace(/\s+/g, '');
  }

  return 'Message for current pricing';
}

// ----------------- OPENAI HELPERS -----------------

async function callOpenAI(messages, responseFormatJson = false) {
  const params = {
    model: 'gpt-4o-mini',
    messages
  };

  // We keep it simple and just parse JSON manually
  const completion = await openai.chat.completions.create(params);
  return completion.choices[0].message.content;
}

// Build prompt for full kit
function buildKitPrompt(label, price) {
  return [
    {
      role: 'system',
      content:
        'You are Lot Rocket, an expert automotive social media copywriter. ' +
        'Given a vehicle label and price, you create high-converting social media copy ' +
        'for multiple platforms PLUS a viral video script and shot plan. ' +
        'You ALWAYS respond in pure JSON, no extra text.'
    },
    {
      role: 'user',
      content: `
Vehicle label: ${label}
Price info: ${price}

Create a social media kit with this structure:

{
  "facebook": "...",
  "instagram": "...",
  "tiktok": "...",
  "linkedin": "...",
  "twitter": "...",
  "textBlurb": "...",
  "marketplace": "...",
  "hashtags": "...",
  "script": "...",
  "shotPlan": "..."
}

Rules:
- Style: like a sharp, confident car salesperson speaking to real buyers.
- Do NOT use \\n literally; use real line breaks.
- Use emojis where appropriate, like examples we've used: 🚗, 💰, 🔥, etc.
- Facebook: scroll-stopping hook, bullet list of benefits, strong CTA.
- Instagram: similar but slightly tighter and optimized for caption style.
- TikTok: more casual, mentions "algorithm" or "if this showed up on your feed" sometimes.
- LinkedIn: more professional, tie to daily life, work, family, dependability.
- Twitter: short punchy version with CTA.
- textBlurb: 1–3 short sentences for SMS/DM outreach.
- marketplace: title + body like a Facebook Marketplace listing.
- hashtags: one line of hashtags that mixes general (e.g. #carsforsale) and specific that include the label, but remove commas, use only # words.
- script: 30–40 second vertical video script with HOOK, EXTERIOR, INTERIOR, BENEFIT, CTA, written as text they can read on camera.
- shotPlan: 5–7 shot plan with simple directions.

Write everything directly referencing the label and price info provided.
      `.trim()
    }
  ];
}

// Prompt for regenerating one post
function buildRegeneratePrompt(label, price, channel, previousText) {
  return [
    {
      role: 'system',
      content:
        'You are Lot Rocket, an expert automotive copywriter. You are regenerating ONE social post variant for a specific channel. ' +
        'Return ONLY the text for the requested channel, no JSON, no extra commentary.'
    },
    {
      role: 'user',
      content: `
Vehicle label: ${label}
Price info: ${price}
Channel: ${channel}

Previous version of this channel (for reference, do NOT repeat exactly):

${previousText || '(none provided)'}

Write a fresh, scroll-stopping new version for this channel that fits the platform style. 
Do NOT say "Here is your post". Just output the post text.
      `.trim()
    }
  ];
}

// Prompt for new script
function buildNewScriptPrompt(label, price, previousScript) {
  return [
    {
      role: 'system',
      content:
        'You are Lot Rocket, an expert automotive short-form video script writer. ' +
        'You write viral-style scripts for Reels, TikTok, and Shorts. ' +
        'Return ONLY the new script text, no extra commentary.'
    },
    {
      role: 'user',
      content: `
Vehicle label: ${label}
Price info: ${price}

Previous script (for reference, do NOT repeat exactly):

${previousScript || '(none provided)'}

Write a new 30–40 second script with:
- HOOK
- EXTERIOR
- INTERIOR & FEATURES
- BENEFIT HOOK
- CTA

Style: confident, clear, easy to read on camera.
      `.trim()
    }
  ];
}

// ----------------- ROUTES -----------------

// Main page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Lot Rocket Social Media Kit</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg: #050816;
      --bg-card: #0b1020;
      --accent: #f97316;
      --accent-soft: rgba(249,115,22,0.1);
      --border-subtle: #1f2937;
      --text-main: #f9fafb;
      --text-muted: #9ca3af;
      --radius-lg: 16px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at top, #1f2937 0, #020617 45%, #000 100%);
      color: var(--text-main);
      min-height: 100vh;
    }
    .app-shell {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    .header {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    h1 {
      font-size: 1.8rem;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      font-size: 0.8rem;
      border-radius: 999px;
      padding: 2px 10px;
      border: 1px solid var(--accent-soft);
      color: var(--accent);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .badge span {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .subtitle {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .card {
      background: radial-gradient(circle at top left, #111827 0, #020617 60%);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
      padding: 16px 18px;
      margin-bottom: 16px;
      box-shadow: 0 12px 30px rgba(15,23,42,0.5);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      gap: 8px;
    }
    .card-header h2,
    .card-header h3 {
      margin: 0;
      font-size: 1rem;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .col {
      flex: 1 1 min(420px, 100%);
    }
    label {
      font-size: 0.85rem;
      color: var(--text-muted);
      display: block;
      margin-bottom: 4px;
    }
    input[type="text"] {
      width: 100%;
      padding: 10px 12px;
      border-radius: 999px;
      border: 1px solid var(--border-subtle);
      background: rgba(15,23,42,0.9);
      color: var(--text-main);
      font-size: 0.9rem;
      outline: none;
    }
    input[type="text"]::placeholder {
      color: #6b7280;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      resize: vertical;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid var(--border-subtle);
      background: rgba(15,23,42,0.9);
      color: var(--text-main);
      font-size: 0.85rem;
      line-height: 1.4;
      outline: none;
    }
    .btn-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .btn {
      border-radius: 999px;
      padding: 8px 14px;
      border: none;
      cursor: pointer;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .btn-primary {
      background: linear-gradient(to right, #f97316, #facc15);
      color: #111827;
      font-weight: 600;
    }
    .btn-secondary {
      background: rgba(15,23,42,0.8);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
    }
    .status {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .pill {
      border-radius: 999px;
      background: rgba(15,23,42,0.8);
      border: 1px solid var(--border-subtle);
      padding: 4px 10px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .section-title {
      margin: 24px 0 4px;
      font-size: 1rem;
    }
    .section-subtitle {
      margin: 0 0 8px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    hr {
      border: none;
      border-top: 1px solid var(--border-subtle);
    }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .photo-grid img {
      width: 100%;
      height: 100px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid #1f2937;
    }
    .photo-item {
      position: relative;
      overflow: hidden;
    }
    .status-line {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 4px;
    }
    @media (max-width: 768px) {
      .app-shell {
        padding: 16px 12px 32px;
      }
      h1 {
        font-size: 1.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <header class="header">
      <div class="title-row">
        <h1>🚀 Lot Rocket</h1>
        <span class="badge">Social Media Kit <span>Prototype</span></span>
      </div>
      <p class="subtitle">
        Paste a dealer vehicle URL. Get ready-to-use posts for Facebook, Instagram, TikTok, LinkedIn, X, Marketplace, text/DM – plus a viral video script & shot plan.
      </p>
    </header>

    <!-- URL + Boost -->
    <div class="card">
      <div class="card-header">
        <h2>Paste Dealer Vehicle URL</h2>
        <span class="pill">Step 1</span>
      </div>
      <div class="row">
        <div class="col">
          <label for="dealer-url">Dealer vehicle URL</label>
          <input id="dealer-url" type="text" placeholder="https://www.exampledealer.com/used-2024-Your-Vehicle-Here" />
        </div>
        <div class="col" style="max-width: 280px;">
          <label>&nbsp;</label>
          <div class="btn-row">
            <button id="btn-boost" class="btn btn-primary" type="button">
              🚀 Boost This Listing
            </button>
            <span id="status-main" class="status"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary -->
    <div class="card">
      <div class="card-header">
        <h2>Listing Summary</h2>
        <span class="pill" id="summary-label-pill">Waiting for URL…</span>
      </div>
      <div class="row">
        <div class="col">
          <label>Vehicle label (editable)</label>
          <input id="label-input" type="text" placeholder="2024 Kia Sorento X-Line SX in NOVI, MI" />
        </div>
        <div class="col">
          <label>Price / deal info (editable)</label>
          <input id="price-input" type="text" placeholder="$35,995" />
        </div>
      </div>
    </div>

    <!-- Social outputs -->
    <h2 class="section-title">Social Media Posts</h2>
    <p class="section-subtitle">Copy, tweak, and paste into each platform. Tap "New Post" to spin a fresh version.</p>

    <div class="row">
      <div class="col">
        <div class="card">
          <div class="card-header">
            <h3>📘 Facebook Post</h3>
            <div class="btn-row">
              <button class="btn btn-secondary btn-new-post" data-channel="facebook" type="button">🔁 New Post</button>
            </div>
          </div>
          <textarea id="facebook-output" placeholder="Facebook copy will appear here…"></textarea>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>📸 Instagram Caption</h3>
            <div class="btn-row">
              <button class="btn btn-secondary btn-new-post" data-channel="instagram" type="button">🔁 New Post</button>
            </div>
          </div>
          <textarea id="instagram-output" placeholder="Instagram caption will appear here…"></textarea>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>🎵 TikTok Caption</h3>
            <div class="btn-row">
              <button class="btn btn-secondary btn-new-post" data-channel="tiktok" type="button">🔁 New Post</button>
            </div>
          </div>
          <textarea id="tiktok-output" placeholder="TikTok caption will appear here…"></textarea>
        </div>
      </div>

      <div class="col">
        <div class="card">
          <div class="card-header">
            <h3>💼 LinkedIn Post</h3>
            <div class="btn-row">
              <button class="btn btn-secondary btn-new-post" data-channel="linkedin" type="button">🔁 New Post</button>
            </div>
          </div>
          <textarea id="linkedin-output" placeholder="LinkedIn post will appear here…"></textarea>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>🐦 X / Twitter Post</h3>
            <div class="btn-row">
              <button class="btn btn-secondary btn-new-post" data-channel="twitter" type="button">🔁 New Post</button>
            </div>
          </div>
          <textarea id="twitter-output" placeholder="X / Twitter copy will appear here…"></textarea>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>💬 Text / DM Blurb</h3>
            <div class="btn-row">
              <button class="btn btn-secondary btn-new-post" data-channel="textBlurb" type="button">🔁 New Text</button>
            </div>
          </div>
          <textarea id="text-output" placeholder="Short SMS / DM blurb will appear here…"></textarea>
        </div>
      </div>
    </div>

    <!-- Marketplace + Hashtags -->
    <div class="row">
      <div class="col">
        <div class="card">
          <div class="card-header">
            <h3>🛒 Facebook Marketplace Description</h3>
            <div class="btn-row">
              <button class="btn btn-secondary btn-new-post" data-channel="marketplace" type="button">🔁 New Post</button>
            </div>
          </div>
          <textarea id="marketplace-output" placeholder="Marketplace description will appear here…"></textarea>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-header">
            <h3>🏷 Hashtags</h3>
            <div class="btn-row">
              <button class="btn btn-secondary btn-new-post" data-channel="hashtags" type="button">🔁 New Tags</button>
            </div>
          </div>
          <textarea id="hashtags-output" placeholder="#hashtags will appear here…"></textarea>
        </div>
      </div>
    </div>

    <!-- Video script + shot plan -->
    <h2 class="section-title">Video Engine</h2>
    <p class="section-subtitle">Script + shot plan you can read on camera and follow for Reels, TikTok, Shorts, or Facebook Reels.</p>

    <div class="row">
      <div class="col">
        <div class="card">
          <div class="card-header">
            <h3>🎥 Viral Video Script</h3>
            <div class="btn-row">
              <button id="btn-new-script" class="btn btn-secondary" type="button">🔁 New Script</button>
            </div>
          </div>
          <textarea id="script-output" placeholder="Viral script will appear here…"></textarea>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-header">
            <h3>👀 Viral Visual Shot Plan</h3>
          </div>
          <textarea id="shotplan-output" placeholder="Shot plan will appear here…"></textarea>
        </div>
      </div>
    </div>

    <!-- Media tools -->
    <hr class="mt-8 mb-4" />
    <h2 class="section-title">Media Tools</h2>
    <p class="section-subtitle">Grab photos from the dealer page. Video tools come next.</p>

    <div class="card">
      <div class="card-header">
        <h3>📸 Dealer Photos</h3>
        <button id="btn-photos" class="btn btn-secondary" type="button">
          📸 Grab Photos From URL
        </button>
      </div>
      <div id="photo-status" class="status-line"></div>
      <div id="photo-grid" class="photo-grid"></div>
    </div>

  </div> <!-- app-shell -->

  <script>
    const urlInput = document.getElementById('dealer-url');
    const btnBoost = document.getElementById('btn-boost');
    const statusMain = document.getElementById('status-main');

    const labelInput = document.getElementById('label-input');
    const priceInput = document.getElementById('price-input');
    const labelPill = document.getElementById('summary-label-pill');

    const facebookOutput = document.getElementById('facebook-output');
    const instagramOutput = document.getElementById('instagram-output');
    const tiktokOutput = document.getElementById('tiktok-output');
    const linkedinOutput = document.getElementById('linkedin-output');
    const twitterOutput = document.getElementById('twitter-output');
    const textOutput = document.getElementById('text-output');
    const marketplaceOutput = document.getElementById('marketplace-output');
    const hashtagsOutput = document.getElementById('hashtags-output');
    const scriptOutput = document.getElementById('script-output');
    const shotplanOutput = document.getElementById('shotplan-output');

    const btnNewScript = document.getElementById('btn-new-script');

    const btnPhotos = document.getElementById('btn-photos');
    const photoStatus = document.getElementById('photo-status');
    const photoGrid = document.getElementById('photo-grid');

    function setMainStatus(msg) {
      statusMain.textContent = msg || '';
    }

    function fillOutputs(data) {
      if (data.label) {
        labelInput.value = data.label;
        labelPill.textContent = data.label;
      }
      if (data.priceInfo) {
        priceInput.value = data.priceInfo;
      }
      if (data.facebook) facebookOutput.value = data.facebook;
      if (data.instagram) instagramOutput.value = data.instagram;
      if (data.tiktok) tiktokOutput.value = data.tiktok;
      if (data.linkedin) linkedinOutput.value = data.linkedin;
      if (data.twitter) twitterOutput.value = data.twitter;
      if (data.textBlurb) textOutput.value = data.textBlurb;
      if (data.marketplace) marketplaceOutput.value = data.marketplace;
      if (data.hashtags) hashtagsOutput.value = data.hashtags;
      if (data.script) scriptOutput.value = data.script;
      if (data.shotPlan) shotplanOutput.value = data.shotPlan;
    }

    // ---- Boost button -> /generate ----
    if (btnBoost) {
      btnBoost.addEventListener('click', async () => {
        const dealerUrl = urlInput.value.trim();
        if (!dealerUrl) {
          alert('Paste a dealer vehicle URL first.');
          return;
        }

        setMainStatus('Building your social kit…');
        btnBoost.disabled = true;

        try {
          const res = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: dealerUrl })
          });
          if (!res.ok) {
            setMainStatus('Error generating kit. Check URL or try again.');
            btnBoost.disabled = false;
            return;
          }
          const data = await res.json();
          fillOutputs(data);
          setMainStatus('Social kit ready. Review, tweak, and post.');
        } catch (err) {
          console.error(err);
          setMainStatus('Something went wrong. Try again.');
        } finally {
          btnBoost.disabled = false;
        }
      });
    }

    // ---- New Post buttons -> /regenerate ----
    document.querySelectorAll('.btn-new-post').forEach(btn => {
      btn.addEventListener('click', async () => {
        const channel = btn.dataset.channel;
        const dealerUrl = urlInput.value.trim();
        const label = labelInput.value.trim() || labelPill.textContent || 'this vehicle';
        const priceInfo = priceInput.value.trim() || 'Message for current pricing';

        if (!dealerUrl) {
          alert('Paste a dealer vehicle URL first.');
          return;
        }

        // Existing content for context
        let previousText = '';
        switch (channel) {
          case 'facebook': previousText = facebookOutput.value; break;
          case 'instagram': previousText = instagramOutput.value; break;
          case 'tiktok': previousText = tiktokOutput.value; break;
          case 'linkedin': previousText = linkedinOutput.value; break;
          case 'twitter': previousText = twitterOutput.value; break;
          case 'textBlurb': previousText = textOutput.value; break;
          case 'marketplace': previousText = marketplaceOutput.value; break;
          case 'hashtags': previousText = hashtagsOutput.value; break;
        }

        btn.disabled = true;
        const originalLabel = btn.textContent;
        btn.textContent = '⏳ Spinning…';

        try {
          const res = await fetch('/regenerate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: dealerUrl, label, priceInfo, channel, previousText })
          });
          if (!res.ok) {
            btn.textContent = 'Error';
            return;
          }
          const data = await res.json();
          const content = data.content || '';

          switch (channel) {
            case 'facebook': facebookOutput.value = content; break;
            case 'instagram': instagramOutput.value = content; break;
            case 'tiktok': tiktokOutput.value = content; break;
            case 'linkedin': linkedinOutput.value = content; break;
            case 'twitter': twitterOutput.value = content; break;
            case 'textBlurb': textOutput.value = content; break;
            case 'marketplace': marketplaceOutput.value = content; break;
            case 'hashtags': hashtagsOutput.value = content; break;
          }
        } catch (err) {
          console.error(err);
          btn.textContent = 'Error';
        } finally {
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = originalLabel;
          }, 600);
        }
      });
    });

    // ---- New Script -> /new-script ----
    if (btnNewScript) {
      btnNewScript.addEventListener('click', async () => {
        const dealerUrl = urlInput.value.trim();
        const label = labelInput.value.trim() || labelPill.textContent || 'this vehicle';
        const priceInfo = priceInput.value.trim() || 'Message for current pricing';

        if (!dealerUrl) {
          alert('Paste a dealer vehicle URL first.');
          return;
        }

        const previousScript = scriptOutput.value;

        btnNewScript.disabled = true;
        const originalLabel = btnNewScript.textContent;
        btnNewScript.textContent = '⏳ Writing…';

        try {
          const res = await fetch('/new-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: dealerUrl, label, priceInfo, previousScript })
          });
          if (!res.ok) {
            btnNewScript.textContent = 'Error';
            return;
          }
          const data = await res.json();
          if (data.script) scriptOutput.value = data.script;
          if (data.shotPlan) shotplanOutput.value = data.shotPlan;
        } catch (err) {
          console.error(err);
          btnNewScript.textContent = 'Error';
        } finally {
          setTimeout(() => {
            btnNewScript.disabled = false;
            btnNewScript.textContent = originalLabel;
          }, 600);
        }
      });
    }

    // ---- Photos -> /api/photos ----
    if (btnPhotos) {
      btnPhotos.addEventListener('click', async () => {
        const dealerUrl = urlInput.value.trim();
        if (!dealerUrl) {
          alert('Paste a dealer vehicle URL first.');
          return;
        }

        photoStatus.textContent = 'Scraping photos from the dealer page…';
        photoGrid.innerHTML = '';

        try {
          const res = await fetch('/api/photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: dealerUrl })
          });
          if (!res.ok) {
            photoStatus.textContent = 'Could not pull photos from that URL.';
            return;
          }
          const data = await res.json();
          const photos = data.photos || [];

          if (!photos.length) {
            photoStatus.textContent = 'No usable photos found on that page.';
            return;
          }

          photoStatus.textContent = 'Found ' + photos.length + ' photos. Click to open full size.';
          photoGrid.innerHTML = photos
            .map(src => (
              '<div class="photo-item">' +
                '<a href="' + src + '" target="_blank" rel="noopener noreferrer">' +
                  '<img src="' + src + '" alt="Vehicle photo" />' +
                '</a>' +
              '</div>'
            ))
            .join('');
        } catch (err) {
          console.error(err);
          photoStatus.textContent = 'Error grabbing photos. Try again or check the URL.';
        }
      });
    }
  </script>
</body>
</html>
  `);
});

// Generate full kit
app.post('/generate', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });

    const html = await fetchHtml(url);
    const label = extractLabelFromHtml(html, url);
    const priceInfo = extractPriceFromHtml(html);

    const messages = buildKitPrompt(label, priceInfo);
    const raw = await callOpenAI(messages);
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      } else {
        throw new Error('Failed to parse JSON from model');
      }
    }

    res.json({
      label,
      priceInfo,
      facebook: parsed.facebook || '',
      instagram: parsed.instagram || '',
      tiktok: parsed.tiktok || '',
      linkedin: parsed.linkedin || '',
      twitter: parsed.twitter || '',
      textBlurb: parsed.textBlurb || '',
      marketplace: parsed.marketplace || '',
      hashtags: parsed.hashtags || '',
      script: parsed.script || '',
      shotPlan: parsed.shotPlan || ''
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: 'Failed to generate kit' });
  }
});

// Regenerate one channel
app.post('/regenerate', async (req, res) => {
  try {
    const { url, label, priceInfo, channel, previousText } = req.body;
    if (!url || !channel) {
      return res.status(400).json({ error: 'Missing url or channel' });
    }

    const messages = buildRegeneratePrompt(label || 'this vehicle', priceInfo || 'Message for current pricing', channel, previousText || '');
    const text = await callOpenAI(messages);

    res.json({ channel, content: text.trim() });
  } catch (err) {
    console.error('Regenerate error:', err);
    res.status(500).json({ error: 'Failed to regenerate post' });
  }
});

// New script + shot plan
app.post('/new-script', async (req, res) => {
  try {
    const { url, label, priceInfo, previousScript } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const scriptMessages = buildNewScriptPrompt(label || 'this vehicle', priceInfo || 'Message for current pricing', previousScript || '');
    const scriptText = await callOpenAI(scriptMessages);

    // Now ask for a shot plan matching this script
    const shotMessages = [
      {
        role: 'system',
        content:
          'You are Lot Rocket, a practical automotive content director. ' +
          'Given a short-form video script, you write a simple 5–7 shot plan. ' +
          'Return only the shot plan text, nothing else.'
      },
      {
        role: 'user',
        content: `
Script:

${scriptText}

Write a "Viral Visual Shot Plan (Simple 5–7 shots)" that matches this script and is easy to follow on a phone.
        `.trim()
      }
    ];
    const shotText = await callOpenAI(shotMessages);

    res.json({
      script: scriptText.trim(),
      shotPlan: shotText.trim()
    });
  } catch (err) {
    console.error('New-script error:', err);
    res.status(500).json({ error: 'Failed to generate new script' });
  }
});

// Photo scraper
app.post('/api/photos', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });

    const html = await fetchHtml(url);

    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const seen = new Set();
    const images = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      let src = match[1];
      if (!src || src.length < 8) continue;
      if (src.includes('logo') || src.includes('icon') || src.includes('sprite')) continue;

      try {
        const absolute = new URL(src, url).href;
        if (!seen.has(absolute)) {
          seen.add(absolute);
          images.push(absolute);
        }
      } catch {
        // ignore
      }
    }

    res.json({ photos: images.slice(0, 20) });
  } catch (err) {
    console.error('Photo scrape error:', err);
    res.status(500).json({ error: 'Failed to scrape photos' });
  }
});

// ----------------- START SERVER -----------------
app.listen(PORT, () => {
  console.log('Lot Rocket running on port ' + PORT);
});
// app.js
// Lot Rocket – Social Media Post Kit (Viral mode, per-channel regen + improved randomness)

const express = require("express");
const cheerio = require("cheerio");

const app = express();
app.use(express.json({ limit: "5mb" }));

// ---------- FRONTEND ----------

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Lot Rocket – Social Media Post Kit</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #050505; color: #f5f5f5; }
    .app { max-width: 1000px; margin: 0 auto; padding: 32px 16px 96px; }
    h1 { font-size: 2rem; margin-bottom: 4px; }
    h1 span.brand { color: #ff3232; }
    p.sub { color: #aaa; margin-top: 0; }
    .card { background: #111; border-radius: 16px; padding: 20px; border: 1px solid #333; margin-top: 16px; }
    label { display: block; font-weight: 600; margin-bottom: 6px; }
    input[type="text"] {
      width: 100%; padding: 12px 14px; border-radius: 10px;
      border: 1px solid #333; background: #050505; color: #f5f5f5;
      font-size: 1rem;
    }
    input:focus { outline: 1px solid #ff3232; border-color: #ff3232; }
    button {
      border: none; border-radius: 999px; padding: 10px 16px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 6px;
      cursor: pointer; margin-top: 10px; font-size: 0.95rem;
      background: linear-gradient(135deg, #ff3232, #ff7b32); color: #fff;
      box-shadow: 0 8px 16px rgba(255, 50, 50, 0.4);
      transition: transform 0.08s ease, box-shadow 0.08s ease;
    }
    button:hover { transform: translateY(-1px); box-shadow: 0 12px 22px rgba(255, 50, 50, 0.6); }
    button:disabled { opacity: 0.4; cursor: default; box-shadow: none; transform: none; }
    .primary-btn { width: 100%; justify-content: center; }

    .pill {
      display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem;
      padding: 5px 10px; border-radius: 999px; background: #181818; color: #ccc;
    }
    .copy-box {
      background: #050505; border-radius: 12px; padding: 12px;
      border: 1px solid #333; white-space: pre-wrap;
      font-size: 0.9rem; min-height: 60px;
    }
    .small { font-size: 0.8rem; color: #777; margin-top: 8px; }
    .card-header {
      display: flex; justify-content: space-between; align-items: center;
      gap: 10px; flex-wrap: wrap;
    }
    .card-header-right {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .card-header button {
      margin-top: 0;
      box-shadow: none;
      padding: 6px 10px;
      font-size: 0.8rem;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }

    .copy-all-btn {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: 16px;
      width: min(480px, calc(100% - 32px));
      z-index: 50;
      justify-content: center;
    }

    @media (max-width: 768px) {
      body { font-size: 16px; }
      h1 { font-size: 1.6rem; }
      .app { padding: 24px 12px 96px; }
      .card { padding: 16px; }
    }

    @media (min-width: 769px) {
      .copy-all-btn { display: none; }
    }

    @media (max-width: 768px) {
      .copy-all-btn { display: inline-flex; }
    }
  </style>
</head>
<body>
  <div class="app">
    <h1><span class="brand">Lot Rocket</span> Social Media Kit</h1>
    <p class="sub">Paste a vehicle URL. Get ready-to-use posts for Facebook, Instagram, TikTok, LinkedIn, X, Marketplace, text/DM – plus a viral video script & shot plan. 🔥</p>

    <div class="card">
      <form id="lotrocket-form">
        <label for="url">Dealer vehicle URL</label>
        <input id="url" type="text" placeholder="Paste a full link from a vehicle details page" />
        <button type="submit" class="primary-btn">🚀 Boost This Listing</button>
      </form>
      <div id="status" class="small"></div>
      <div id="vehicle-summary" class="small" style="margin-top:6px; color:#ccc;"></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="pill">📘 Facebook Post</div>
          <div class="card-header-right">
            <button type="button" data-regen-channel="facebook">🔁 New Post</button>
            <button type="button" data-copy-target="fb-output">📋 Copy</button>
          </div>
        </div>
        <div id="fb-output" class="copy-box">Your Facebook post will appear here.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="pill">📸 Instagram Caption</div>
          <div class="card-header-right">
            <button type="button" data-regen-channel="instagram">🔁 New Post</button>
            <button type="button" data-copy-target="ig-output">📋 Copy</button>
          </div>
        </div>
        <div id="ig-output" class="copy-box">Your Instagram caption will appear here.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="pill">🎵 TikTok Caption</div>
          <div class="card-header-right">
            <button type="button" data-regen-channel="tiktok">🔁 New Post</button>
            <button type="button" data-copy-target="tt-output">📋 Copy</button>
          </div>
        </div>
        <div id="tt-output" class="copy-box">Your TikTok caption will appear here.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="pill">💼 LinkedIn Post</div>
          <div class="card-header-right">
            <button type="button" data-regen-channel="linkedin">🔁 New Post</button>
            <button type="button" data-copy-target="li-output">📋 Copy</button>
          </div>
        </div>
        <div id="li-output" class="copy-box">Your LinkedIn post will appear here.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="pill">🐦 X / Twitter Post</div>
          <div class="card-header-right">
            <button type="button" data-regen-channel="twitter">🔁 New Post</button>
            <button type="button" data-copy-target="tw-output">📋 Copy</button>
          </div>
        </div>
        <div id="tw-output" class="copy-box">Your X/Twitter post will appear here.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="pill">💬 Text / DM Blurb</div>
          <div class="card-header-right">
            <button type="button" data-regen-channel="sms">🔁 New Post</button>
            <button type="button" data-copy-target="sms-output">📋 Copy</button>
          </div>
        </div>
        <div id="sms-output" class="copy-box">Your short message will appear here.</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="pill">🛒 Facebook Marketplace Description</div>
        <div class="card-header-right">
          <button type="button" data-regen-channel="marketplace">🔁 New Post</button>
          <button type="button" data-copy-target="mp-output">📋 Copy</button>
        </div>
      </div>
      <div id="mp-output" class="copy-box">Your Facebook Marketplace description will appear here.</div>
      <p class="small">
        Use this in the Marketplace description box. For the title, use something like
        “YEAR MAKE MODEL – Clean, Sharp & Ready to Go!”.
      </p>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="pill">🏷 Hashtags</div>
        <div class="card-header-right">
          <button type="button" data-copy-target="hashtags-output">📋 Copy</button>
        </div>
      </div>
      <div id="hashtags-output" class="copy-box">Hashtags will appear here.</div>
      <p class="small">Use these on Instagram, TikTok, and X. You can always add store-specific tags or location tags.</p>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="pill">🎥 Viral Video Script</div>
        <div class="card-header-right">
          <button type="button" id="regen-video">🔁 New Script</button>
          <button type="button" data-copy-target="video-output">📋 Copy</button>
        </div>
      </div>
      <div id="video-output" class="copy-box">Your viral video script will appear here.</div>
      <p class="small">Read this on camera for Reels, TikTok, Shorts, or Facebook Reels.</p>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="pill">👀 Viral Visual Shot Plan</div>
        <div class="card-header-right">
          <button type="button" data-copy-target="shot-output">📋 Copy</button>
        </div>
      </div>
      <div id="shot-output" class="copy-box">Your shot plan will appear here.</div>
      <p class="small">Follow these shots so your video looks clean, confident, and high-impact.</p>
    </div>

    <p class="small">Prototype – full image and automatic video creation will come in a later version. For now, use this as your “done-for-you” social copy engine.</p>

    <button type="button" id="copy-all-btn" class="copy-all-btn">📋 Copy All Posts</button>
  </div>

  <script>
    const form = document.getElementById("lotrocket-form");
    const statusEl = document.getElementById("status");
    const vehicleSummaryEl = document.getElementById("vehicle-summary");

    const fbEl = document.getElementById("fb-output");
    const igEl = document.getElementById("ig-output");
    const ttEl = document.getElementById("tt-output");
    const liEl = document.getElementById("li-output");
    const twEl = document.getElementById("tw-output");
    const smsEl = document.getElementById("sms-output");
    const mpEl = document.getElementById("mp-output");
    const hashtagsEl = document.getElementById("hashtags-output");
    const videoEl = document.getElementById("video-output");
    const shotEl = document.getElementById("shot-output");
    const copyAllBtn = document.getElementById("copy-all-btn");
    const regenVideoBtn = document.getElementById("regen-video");

    const channelToElementId = {
      facebook: "fb-output",
      instagram: "ig-output",
      tiktok: "tt-output",
      linkedin: "li-output",
      twitter: "tw-output",
      sms: "sms-output",
      marketplace: "mp-output"
    };

    let lastVehicle = null;

    window.addEventListener("load", function () {
      const urlInput = document.getElementById("url");
      if (urlInput) {
        try { urlInput.focus(); } catch (e) {}
      }
    });

    async function handleCopy(targetId) {
      const el = document.getElementById(targetId);
      if (!el) return;
      const text = el.textContent || "";
      if (!text.trim()) {
        statusEl.textContent = "Nothing to copy yet.";
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        statusEl.textContent = "Copied to clipboard ✅";
      } catch (e) {
        console.error(e);
        statusEl.textContent = "Could not copy automatically – select and copy manually.";
      }
    }

    async function handleCopyAll() {
      const blocks = [
        { label: "Facebook", el: fbEl },
        { label: "Instagram", el: igEl },
        { label: "TikTok", el: ttEl },
        { label: "LinkedIn", el: liEl },
        { label: "X / Twitter", el: twEl },
        { label: "Text / DM", el: smsEl },
        { label: "Marketplace", el: mpEl },
        { label: "Hashtags", el: hashtagsEl },
        { label: "Viral Video Script", el: videoEl },
        { label: "Shot Plan", el: shotEl }
      ];

      const chunks = [];
      blocks.forEach(function (b) {
        if (!b.el) return;
        const text = (b.el.textContent || "").trim();
        if (!text) return;
        chunks.push("=== " + b.label + " ===\\n" + text);
      });

      if (!chunks.length) {
        statusEl.textContent = "Nothing to copy yet.";
        return;
      }

      const full = chunks.join("\\n\\n");
      try {
        await navigator.clipboard.writeText(full);
        statusEl.textContent = "All posts copied ✅";
      } catch (e) {
        console.error(e);
        statusEl.textContent = "Could not copy automatically – select and copy manually.";
      }
    }

    document.querySelectorAll("button[data-copy-target]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const target = btn.getAttribute("data-copy-target");
        handleCopy(target);
      });
    });

    if (copyAllBtn) {
      copyAllBtn.addEventListener("click", function () {
        handleCopyAll();
      });
    }

    if (regenVideoBtn) {
      regenVideoBtn.addEventListener("click", async function () {
        if (!lastVehicle) {
          statusEl.textContent = "Boost a listing first, then you can regenerate the script.";
          return;
        }
        statusEl.textContent = "Refreshing your video script...";
        try {
          const res = await fetch("/api/regenerate-video-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vehicle: lastVehicle })
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Server error");
          }
          const data = await res.json();
          videoEl.textContent = data.videoScript || "No video script generated.";
          statusEl.textContent = "New video script ready. 🎥";
          videoEl.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (err) {
          console.error(err);
          statusEl.textContent = "Error refreshing video script.";
        }
      });
    }

    // Per-channel "New Post" regen
    document.querySelectorAll("button[data-regen-channel]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!lastVehicle) {
          statusEl.textContent = "Boost a listing first, then you can refresh posts.";
          return;
        }
        const channel = btn.getAttribute("data-regen-channel");
        const targetId = channelToElementId[channel];
        if (!targetId) return;

        statusEl.textContent = "Refreshing " + channel + " post...";
        try {
          const res = await fetch("/api/regenerate-post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vehicle: lastVehicle, channel })
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Server error");
          }
          const data = await res.json();
          const elId = channelToElementId[data.channel] || targetId;
          const outEl = document.getElementById(elId);
          if (outEl) {
            outEl.textContent = data.content || ("No " + data.channel + " post generated.");
          }
          statusEl.textContent = "New " + data.channel + " post ready. ✨";
        } catch (err) {
          console.error(err);
          statusEl.textContent = "Error refreshing " + channel + " post.";
        }
      });
    });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const urlInput = document.getElementById("url");
      const url = urlInput.value.trim();

      if (!url) {
        statusEl.textContent = "Please paste a full vehicle URL.";
        return;
      }

      statusEl.textContent = "Building your social kit...";
      vehicleSummaryEl.textContent = "";
      fbEl.textContent = "";
      igEl.textContent = "";
      ttEl.textContent = "";
      liEl.textContent = "";
      twEl.textContent = "";
      smsEl.textContent = "";
      mpEl.textContent = "";
      hashtagsEl.textContent = "";
      videoEl.textContent = "";
      shotEl.textContent = "";

      try {
        const res = await fetch("/api/process-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url })
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Server error");
        }

        const data = await res.json();

        fbEl.textContent = (data.posts && data.posts.facebook) || "No Facebook post generated.";
        igEl.textContent = (data.posts && data.posts.instagram) || "No Instagram caption generated.";
        ttEl.textContent = (data.posts && data.posts.tiktok) || "No TikTok caption generated.";
        liEl.textContent = (data.posts && data.posts.linkedin) || "No LinkedIn post generated.";
        twEl.textContent = (data.posts && data.posts.twitter) || "No X/Twitter post generated.";
        smsEl.textContent = (data.posts && data.posts.sms) || "No short message generated.";
        mpEl.textContent = (data.posts && data.posts.marketplace) || "No Marketplace description generated.";
        hashtagsEl.textContent = (data.posts && data.posts.hashtags) || "";
        videoEl.textContent = (data.posts && data.posts.videoScript) || "No viral video script generated.";
        shotEl.textContent = (data.posts && data.posts.shotPlan) || "No shot plan generated.";

        if (data.vehicle) {
          lastVehicle = data.vehicle;
          const v = data.vehicle;
          const title = v.title || "Vehicle";
          const price = v.price ? "Price: " + v.price : "";
          vehicleSummaryEl.textContent = title + (price ? " • " + price : "");
        }

        statusEl.textContent = "Social kit ready. Review, tweak, and post. 💪";
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Error: " + (err.message || "Something went wrong.");
      }
    });
  </script>
</body>
</html>`);
});

// ---------- STRING HELPERS ----------

function cleanTitle(rawTitle) {
  if (!rawTitle) return "Vehicle";
  let t = rawTitle;

  t = t.split("|")[0];
  t = t.replace(/[A-HJ-NPR-Z0-9]{11,17}/g, " ");
  t = t.replace(/\bfor sale in\b.*$/i, "");
  t = t.replace(/\bfor sale near\b.*$/i, "");
  t = t.replace(/([a-z])([A-Z])/g, "$1 $2");
  t = t.replace(/\s{2,}/g, " ").trim();

  return t || "Vehicle";
}

function cleanPrice(raw) {
  if (!raw) return "";
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";

  const dollarLine = lines.find((l) => /\$\s*\d/.test(l));
  if (dollarLine) return dollarLine;

  const numericLine = lines.find((l) => /\d/.test(l) && !/^price$/i.test(l));
  if (numericLine) return numericLine;

  return "Message for current pricing";
}

// Fallback: parse from URL path when dealer blocks scraping
function vehicleFromUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname || "";
    const parts = path.split("/").filter(Boolean);

    let segment = null;
    for (const p of parts) {
      if (/(19|20)\d{2}/.test(p)) {
        segment = p;
        break;
      }
    }
    if (!segment) return null;

    let decoded = decodeURIComponent(segment);
    decoded = decoded.replace(/\.html?$/i, "");
    decoded = decoded.replace(/-/g, " ");
    decoded = decoded.replace(/\+/g, " ");
    decoded = decoded.replace(/[A-HJ-NPR-Z0-9]{11,17}$/i, "").trim();

    const yearMatch = decoded.match(/(19|20)\d{2}/);
    let year = "";
    if (yearMatch) year = yearMatch[1];

    let makeModel = year ? decoded.replace(year, "").trim() : decoded;
    makeModel = makeModel.replace(/\s{2,}/g, " ").trim();

    const title = (year ? year + " " : "") + makeModel;
    return {
      title: title || "Vehicle",
      year,
      makeModel,
      price: "Message for current pricing",
      condition: ""
    };
  } catch (e) {
    return null;
  }
}

// ---------- SCRAPE VEHICLE DATA ----------

async function scrapeVehicle(url) {
  try {
    const resp = await fetch(url);
    const html = await resp.text();
    const $ = cheerio.load(html);

    const pageTitle = $("title").text().toLowerCase();
    const pageText = $("body").text().toLowerCase();

    const blockedPhrases = [
      "sorry, you have been blocked",
      "access denied",
      "request blocked",
      "forbidden",
      "bot detected"
    ];

    if (blockedPhrases.some((p) => pageTitle.includes(p) || pageText.includes(p))) {
      throw new Error("SCRAPE_BLOCKED");
    }

    const rawTitle =
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      "Vehicle";

    const rawPrice =
      $('[class*="price"]').first().text().trim() ||
      $('meta[itemprop="price"]').attr("content") ||
      "";

    const cleanedTitle = cleanTitle(rawTitle);
    const price = cleanPrice(rawPrice);

    const yearMatch = cleanedTitle.match(/(20\d{2}|19\d{2})/);
    const year = yearMatch ? yearMatch[1] : "";

    const lowerTitle = cleanedTitle.toLowerCase();
    let condition = "";
    if (/\bnew\b/.test(lowerTitle)) {
      condition = "New";
    } else if (/certified|cpo/.test(lowerTitle)) {
      condition = "Certified Pre-Owned";
    } else if (/pre[-\s]?owned/.test(lowerTitle)) {
      condition = "Pre-Owned";
    } else if (/used/.test(lowerTitle)) {
      condition = "Used";
    }

    let makeModel = year ? cleanedTitle.replace(year, "").trim() : cleanedTitle;

    if (condition) {
      const condRegex = new RegExp("\\b" + condition.replace(/\s+/g, "\\s+") + "\\b", "i");
      makeModel = makeModel.replace(condRegex, " ");
    }

    makeModel = makeModel.replace(/\b(new|used|pre[-\s]?owned|certified|cpo)\b/gi, " ");
    makeModel = makeModel.replace(/\s{2,}/g, " ").trim();

    return {
      title: cleanedTitle,
      year,
      makeModel,
      price,
      condition
    };
  } catch (e) {
    if (e.message === "SCRAPE_BLOCKED") throw e;

    const fallback = vehicleFromUrl(url);
    if (fallback) return fallback;

    return {
      title: "Vehicle",
      year: "",
      makeModel: "",
      price: "Message for current pricing",
      condition: ""
    };
  }
}

// ---------- FEATURE STACK ----------

function generateFeatureStack(vehicle) {
  const baseLabel =
    (vehicle.year ? vehicle.year + " " : "") + (vehicle.makeModel || "Vehicle");
  const nameLower = (vehicle.makeModel || "").toLowerCase();

  const truckSuvKeywords = [
    "tahoe","suburban","silverado","sierra","ram","f-150","f150","bronco","explorer",
    "traverse","highlander","4runner","durango","tacoma","ridgeline","wrangler","gladiator",
    "grand cherokee","escape","equinox","ascent","pilot","telluride","seltos","palisade",
    "outlander","cr-v","rav4","acadia","trailblazer","trax","suv"
  ];

  const luxuryKeywords = [
    "bmw","mercedes","amg","audi","lexus","infiniti","acura","volvo","cadillac","lincoln",
    "genesis","porsche","jaguar","land rover","range rover","aston martin","maserati"
  ];

  const sportyKeywords = [
    "m3","m4","m5","m2","type s","sti","ss","gt","sport","srt","rs","si","z","nismo",
    "mustang","camaro","corvette","challenger","charger","gr","type-r","z06"
  ];

  const isTruckOrSuv = truckSuvKeywords.some((k) => nameLower.includes(k));
  const isLuxury = luxuryKeywords.some((k) => nameLower.includes(k));
  const isSporty = sportyKeywords.some((k) => nameLower.includes(k));

  const isPhevOrHybrid = /phev|plug[-\s]?in|plug in|plug-in|hybrid/.test(nameLower);
  const isEv = /\bev\b/.test(nameLower) || /electric/.test(nameLower) || /blazer ev/.test(nameLower);

  let baseFeatures;

  if (isTruckOrSuv && isLuxury) {
    baseFeatures = [
      "Confident stance that looks right on the road and in the driveway",
      "Upscale cabin with quality materials and a strong first impression",
      "Interior space that actually fits people, gear, and daily life",
      "Strong powertrain built to handle real-world driving and hauling",
      "Modern touchscreen with premium smartphone integration feel",
      "Backup camera and driver-assist tech that make it easy to maneuver",
      "Refined ride that feels quiet, solid, and controlled at speed",
      "Ready for family duty, work runs, and weekend escapes",
      "Smart storage and space use throughout the cabin",
      "Exactly the kind of SUV serious buyers hold onto"
    ];
  } else if (isTruckOrSuv) {
    baseFeatures = [
      "Confident stance that looks right on the road and in the driveway",
      "Interior space that actually fits people, gear, and daily life",
      "Strong powertrain built to handle real-world driving and hauling",
      "Modern touchscreen with practical connectivity for everyday use",
      "Backup camera that makes parking and tight spots simple",
      "Ride quality that feels planted, not sloppy",
      "Ready for work, family duty, and weekend runs",
      "Comfortable enough for long days behind the wheel",
      "Smart storage and space use throughout the cabin",
      "A truck/SUV that feels ready for whatever you throw at it"
    ];
  } else if (isLuxury || isSporty) {
    baseFeatures = [
      "Clean, athletic exterior styling that stands out in traffic",
      "Cabin that feels upscale the second you sit down",
      "Strong, confident acceleration that makes merging and passing easy",
      "Precise steering and composed handling that feels dialed-in",
      "Modern infotainment with intuitive controls and phone integration",
      "Supportive seats that feel right on both short drives and long trips",
      "Quiet, refined ride that still feels connected to the road",
      "Fit-and-finish that makes it feel like a level-up from the average car",
      "Braking and handling that inspire confidence in bad conditions",
      "The kind of car that says you pay attention to what you drive"
    ];
  } else {
    baseFeatures = [
      "Clean, sharp exterior styling that still looks modern",
      "Comfortable seating that is easy to live with every single day",
      "Practical fuel economy that makes sense for commuting and errands",
      "Modern touchscreen with straightforward smartphone connection",
      "Backup camera that makes parking and tight spots stress-free",
      "Smooth, quiet ride that does not beat you up on rough roads",
      "Easy to drive, easy to park, easy to live with",
      "Controls and layout that make sense the first time you sit in it",
      "Great daily driver for work, school, or family runs",
      "Serious value for the money in this segment"
    ];
  }

  if (isPhevOrHybrid || isEv) {
    const electrifiedFeatures = [
      "Electrified setup that gives you electric-style driving with gas backup for real-world range",
      "Lower fuel stops by using electricity for short trips and gas for the longer runs",
      "Smooth, quiet electric-feel driving around town",
      "Perfect for drivers who want SUV practicality with modern efficiency and tech"
    ];
    baseFeatures = electrifiedFeatures.concat(baseFeatures);
  }

  const selected = baseFeatures.slice(0, 10);

  return {
    label: baseLabel,
    bullets: selected
  };
}

// ---------- HASHTAGS ----------

function generateHashtags(vehicle) {
  const tags = new Set();
  const baseWords = [];

  if (vehicle.year) baseWords.push(vehicle.year);
  if (vehicle.makeModel) {
    vehicle.makeModel.split(/\s+/).forEach((w) => baseWords.push(w));
  }

  const fullString =
    (vehicle.year ? vehicle.year + " " : "") + (vehicle.makeModel || "");
  const fullLower = fullString.toLowerCase();

  if (/certified|cpo/.test(fullLower)) {
    tags.add("#certifiedpreowned");
  }

  const stopWords = new Set([
    "for","sale","in","at","the","a","an","near","with","on","and","or","of","this","all","wheel","drive"
  ]);

  baseWords.forEach((w) => {
    const clean = w.replace(/[^a-z0-9]/gi, "");
    if (!clean) return;
    const lower = clean.toLowerCase();
    if (stopWords.has(lower)) return;
    tags.add("#" + lower);
  });

  if (/phev|plug[-\s]?in|plug in|plug-in/.test(fullLower)) {
    tags.add("#hybrid");
    tags.add("#pluginhybrid");
  }
  if (/\bhybrid\b/.test(fullLower)) {
    tags.add("#hybrid");
  }
  if (/\bev\b/.test(fullLower) || /electric/.test(fullLower)) {
    tags.add("#ev");
    tags.add("#electricvehicle");
  }

  [
    "#carsforsale",
    "#carshopping",
    "#carbuying",
    "#cardeals",
    "#carsales",
    "#testdrive"
  ].forEach((t) => tags.add(t));

  const slug =
    (vehicle.year ? vehicle.year : "") +
    (vehicle.makeModel ? vehicle.makeModel.replace(/\s+/g, "").toLowerCase() : "");
  if (slug) {
    tags.add("#" + slug);
  }

  const list = Array.from(tags).filter((t) => t && t !== "#");
  return list.join(" ");
}

// ---------- VIRAL VIDEO SCRIPT & SHOT PLAN ----------

function buildViralVideoScript(vehicle) {
  const label =
    (vehicle.year ? vehicle.year + " " : "") +
    (vehicle.makeModel || "Vehicle");

  const hooks = [
    `Stop scrolling and look at this ${label}. If you have been waiting for the right one, this is it.`,
    `If this ${label} is still available while you are watching this, you might be looking at your next ride.`,
    `Pause for a second – this ${label} is the one people message me about later saying "I should have moved faster."`
  ];

  const exteriorLines = [
    "Check out the stance, wheels, and overall look on this one. It is clean, sharp, and it looks even better in person than it does online.",
    "From the front end to the taillights, this thing just looks right on the road – it has that double-take-in-the-parking-lot presence.",
    "You can see the body lines and details from here – this is not just another appliance, it actually has some style to it."
  ];

  const interiorLines = [
    "Inside is where you really feel the upgrade – comfortable seating, modern tech, and a layout that actually makes sense for daily life. This is built for real driving – work, family, and weekend runs.",
    "Take a look at the interior – screen, controls, and seating all dialed-in so you are not fighting the car, you are just enjoying the drive.",
    "From the driver seat you get that 'I could sit here every day' feeling – tech is easy to use, materials feel solid, and it does not wear you out on longer trips."
  ];

  const benefitHooks = [
    "If you are tired of settling for 'good enough' and you want something that actually feels like a win every time you drive it, this is that move.",
    "If your current ride feels more like a compromise than a reward, this is the upgrade that actually feels like it was worth it.",
    "If you have been scrolling for weeks saying 'I will know it when I see it,' this might be the one that finally checks the boxes."
  ];

  const ctas = [
    "If this fits what you have been looking for, DM me 'INFO' and I will send a quick walkaround, pricing, and options to make it yours before someone else grabs it.",
    "If this looks like it lines up with what you have been talking about, DM 'INFO' and I will send a quick video, numbers, and what it would take to get it in your driveway.",
    "If you can picture yourself in this, DM me 'INFO' and I will send you a walkaround and straight-up numbers so you can decide without the runaround."
  ];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const hook = pick(hooks);
  const exterior = pick(exteriorLines);
  const interior = pick(interiorLines);
  const benefit = pick(benefitHooks);
  const cta = pick(ctas);

  return `🎥 Viral Video Script (30–40 seconds)

HOOK (2–3 sec)
${hook}

EXTERIOR (5–10 sec)
${exterior}

INTERIOR & FEATURES (10–15 sec)
${interior}

BENEFIT HOOK (5–8 sec)
${benefit}

CTA (5–8 sec)
${cta}`;
}

function buildShotPlan() {
  return `👀 Viral Visual Shot Plan (Simple 5–7 shots)

1️⃣ Hook Shot (2–3 sec)
- Start with a close-up of the front corner, grille, or headlights while you deliver the hook line.

2️⃣ Full Body Pass (3–4 sec)
- Walk slowly from the front corner down the side to show the stance and overall look. Keep the camera steady at chest height.

3️⃣ Wheels & Details (2–3 sec)
- Quick close-up of wheels, brakes, or badging. Small slow pan over the details that make it look sharp.

4️⃣ Interior Flex (4–6 sec)
- Smooth pan across the dash, steering wheel, touchscreen, and seats. Hold steady for 1–2 seconds on the best angles.

5️⃣ Space & Practicality (3–4 sec)
- Show rear seats, cargo area, or 3rd row. Open the liftgate, fold a seat, or highlight how usable the space is.

6️⃣ Feature Moment (2–3 sec)
- Hit one button or feature on camera: remote start, sunroof, heated seats, backup camera, etc. Make it feel real and useful.

7️⃣ Power Ending (2–3 sec)
- Finish with you in frame (or the front of the vehicle) delivering the CTA: "DM 'INFO' before someone else grabs it."

🎯 Tips:
- Film vertical.
- Keep clips short (1–3 seconds).
- Use natural light when possible.
- Speak clearly, confident, and like you already know this unit will sell.`;
}

// ---------- SOCIAL POSTS (VIRAL MODE, RANDOM HOOKS) ----------

function buildSocialPosts(vehicle, hashtags) {
  const price = vehicle.price || "Message for current pricing";
  const featureData = generateFeatureStack(vehicle);
  const baseLabel = featureData.label;
  const bullets = featureData.bullets;

  const label = vehicle.condition
    ? `${baseLabel} – ${vehicle.condition}`
    : baseLabel;

  const featureLines = bullets.map((b) => `🔥 ${b}`).join("\n");

  const fullString =
    (vehicle.title || "") + " " + (vehicle.makeModel || "") + " " + (vehicle.condition || "");
  const isCertified = /certified|cpo/i.test(fullString);

  const certifiedLineLong = isCertified
    ? "\n✅ Certified gives you factory-backed confidence, inspection-backed quality, and extra peace of mind compared to ordinary used vehicles.\n"
    : "";

  const certifiedLineShort = isCertified
    ? " It is certified, which means extra inspection-backed peace of mind compared to typical used units."
    : "";

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const fbHooks = [
    "🔥 STOP SCROLLING. Read this before someone else buys it.",
    "🔥 If this matches what you have been looking for, do NOT scroll past.",
    "🔥 This is the one people message me about later saying, \"I should have moved faster.\""
  ];
  const fbHookLine = pick(fbHooks);

  const refName = label.toLowerCase().startsWith("this ")
    ? label
    : "this " + label;

  const fb = `${fbHookLine}

🚗 ${label}
💰 Price: ${price}

If you're serious about driving something that looks sharp, feels strong, and actually makes sense in real life, ${refName} is the kind of unit you move on – not think about for three weeks.${certifiedLineLong}
💎 Why this one hits different:
${featureLines}

When the right unit shows up, serious buyers move first. If this lines up with what you have been telling yourself you want, this is your green light to take action.

📲 Comment or DM “INFO” and I’ll get you pricing, photos, and a quick walkaround – straight answers, no nonsense.

${hashtags}`;

  const igIntros = [
    "If you have been waiting for the right one to pop up, this is the move. Clean, sharp, and built to actually enjoy driving – not just tolerate it.",
    "When you want something that feels good to drive and easy to live with every day, this is the kind of unit that earns its spot in your driveway.",
    "If your current ride feels \"just okay,\" this is the one that will make you look forward to getting in and going somewhere."
  ];
  const igIntro = pick(igIntros);

  const ig = `🚗 ${label}
💰 ${price}

${igIntro}${certifiedLineShort}

${featureLines}

👀 If this matches what you have been looking for, don’t overthink it.

📲 DM “INFO” and I’ll show you how easy it is to make it yours.

${hashtags}`;

  const ttIntros = [
    "If this showed up on your screen, that is your sign. This is the kind of unit people regret hesitating on.",
    "If the algorithm pushed this on your feed, take it as a hint – this might be the one that actually fits your life.",
    "If you have been scrolling past \"maybes,\" this is one of those pause-and-look-again kind of units."
  ];
  const ttIntro = pick(ttIntros);

  const tt = `🚗 ${label}
💰 ${price}

${ttIntro}${certifiedLineShort}

${featureLines}

⏳ Clean, dialed-in rides like this DO NOT sit.

📲 Comment or DM “INFO” and I’ll send you a quick breakdown and walkaround. Move fast – serious buyers don’t wait.

${hashtags}`;

  const subjectForChecks = refName.charAt(0).toUpperCase() + refName.slice(1);

  const liIntros = [
    `For the right driver, the vehicle they choose is a reflection of how they show up – prepared, sharp, and ready to handle business. ${subjectForChecks} checks those boxes.`,
    `How you show up to work, meetings, and life says a lot. ${subjectForChecks} sends the message that you value reliability, presence, and capability.`,
    `For a lot of professionals, the right vehicle is part of their toolkit. ${subjectForChecks} is built to handle the day-to-day while still feeling like an upgrade.`
  ];
  const liIntro = pick(liIntros);

  const li = `🚗 ${label} – Strong, Clean, and Ready for the Next Owner

${liIntro}${certifiedLineShort}

💰 Current pricing:
${price}

Key highlights:
${featureLines}

If you or someone in your network is in the market for something solid, professional, and dependable, I’m happy to share details, photos, or a quick video walkaround.

📩 Message me directly and I’ll respond with options and next steps – fast, simple, and straightforward.

${hashtags}`;

  const twIntros = [
    "Clean, strong, and dialed in. Units like this don’t sit – serious buyers move first.",
    "Dialed-in, ready to roll, and built to actually use every day – not just look at in the driveway.",
    "If you have been looking for the sign to upgrade, this might be it."
  ];
  const twIntro = pick(twIntros);

  const tw = `🚗 ${label}
💰 ${price}

${twIntro}${certifiedLineShort}

${hashtags}

📲 DM “INFO” for photos, a walkaround, and next steps.`;

  const smsIntros = [
    "Just pulled a",
    "I’ve got a fresh unit –",
    "Just hit my list – a"
  ];
  const smsIntro = pick(smsIntros);

  const sms = `${smsIntro} ${label} that checks a lot of boxes. It’s at ${price} right now and it’s clean, sharp, and ready to go.${certifiedLineShort} Want me to send you photos or a quick walkaround video?`;

  const mpIntros = [
    "just hit my list and it’s a legit, clean unit for someone who wants something that looks sharp, drives strong, and actually makes sense for real life.",
    "is the kind of unit that works for school runs, commutes, and weekend trips without feeling basic.",
    "isn’t just another listing – it’s the type of vehicle people usually message me about after it’s already sold."
  ];
  const mpIntro = pick(mpIntros);

  const marketplace = `Title idea:
${label} – Clean, Sharp & Ready to Go!

Suggested description for Facebook Marketplace:

🚗 This ${label} ${mpIntro}${certifiedLineShort}

💰 Current pricing:
${price}

🔥 Why this one is worth a serious look:
${featureLines}

If you’ve been waiting for the right one instead of just “another” vehicle, this is the kind you move on – not scroll past.

📲 Send a message if you want more photos, a walkaround video, or a simple breakdown of what it would take to put it in your driveway.

⏳ If it’s listed, it’s available – for now. Strong units don’t sit long.`;

  const videoScript = buildViralVideoScript(vehicle);
  const shotPlan = buildShotPlan();

  return {
    facebook: fb,
    instagram: ig,
    tiktok: tt,
    linkedin: li,
    twitter: tw,
    sms,
    marketplace,
    videoScript,
    shotPlan
  };
}

// ---------- API ROUTES ----------

app.post("/api/process-listing", async (req, res) => {
  const body = req.body || {};
  const url = body.url;
  if (!url || typeof url !== "string") {
    return res.status(400).send("Missing or invalid 'url'.");
  }

  try {
    const vehicle = await scrapeVehicle(url);
    const hashtags = generateHashtags(vehicle);
    const posts = buildSocialPosts(vehicle, hashtags);

    res.json({
      vehicle,
      posts: {
        facebook: posts.facebook,
        instagram: posts.instagram,
        tiktok: posts.tiktok,
        linkedin: posts.linkedin,
        twitter: posts.twitter,
        sms: posts.sms,
        marketplace: posts.marketplace,
        hashtags,
        videoScript: posts.videoScript,
        shotPlan: posts.shotPlan
      }
    });
  } catch (e) {
    if (e.message === "SCRAPE_BLOCKED") {
      return res
        .status(400)
        .send("This dealer website is blocking automated tools. Try a different vehicle URL (or a different site for the same vehicle).");
    }
    console.error(e);
    res.status(500).send("Failed to process listing.");
  }
});

app.post("/api/regenerate-video-script", (req, res) => {
  const body = req.body || {};
  const vehicle = body.vehicle;
  if (!vehicle || typeof vehicle !== "object") {
    return res.status(400).send("Missing vehicle data.");
  }

  const script = buildViralVideoScript(vehicle);
  res.json({ videoScript: script });
});

app.post("/api/regenerate-post", (req, res) => {
  const body = req.body || {};
  const vehicle = body.vehicle;
  const channel = body.channel;

  if (!vehicle || typeof vehicle !== "object") {
    return res.status(400).send("Missing vehicle data.");
  }
  if (!channel || typeof channel !== "string") {
    return res.status(400).send("Missing channel.");
  }

  const validChannels = new Set([
    "facebook",
    "instagram",
    "tiktok",
    "linkedin",
    "twitter",
    "sms",
    "marketplace"
  ]);

  if (!validChannels.has(channel)) {
    return res.status(400).send("Unsupported channel.");
  }

  const hashtags = generateHashtags(vehicle);
  const posts = buildSocialPosts(vehicle, hashtags);

  const content = posts[channel];
  res.json({ channel, content });
});

// ---------- START SERVER ----------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Lot Rocket running on http://localhost:" + PORT);
});
