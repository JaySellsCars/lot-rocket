// app.js - Lot Rocket (single file)

// ----------------- SETUP -----------------
const express = require('express');
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
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const titleText = titleMatch[1].trim();
    const inIdx = titleText.toLowerCase().indexOf(' in ');
    const pipeIdx = titleText.indexOf('|');
    let core = titleText;

    if (pipeIdx > -1) core = core.slice(0, pipeIdx).trim();
    if (inIdx > -1) {
      const left = core.slice(0, inIdx).trim();
      const right = core.slice(inIdx + 4).trim();
      return `${left} in ${right}`;
    }
    return core;
  }

  // Fallback: parse from URL segments
  try {
    const u = new URL(fallbackUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    const candidate = parts.find(p => /\d{4}/.test(p)) || parts[parts.length - 1];
    const cleaned = decodeURIComponent(candidate)
      .replace(/[-+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'this vehicle';
  } catch {
    return 'this vehicle';
  }
}

// Extract price or "Reduced by" phrase
function extractPriceFromHtml(html) {
  const reducedMatch = html.match(/Reduced by\s*\$?([0-9,]+)[^<]{0,60}?since[^<]{0,60}?(\d{4})/i);
  if (reducedMatch) {
    return `Reduced by $${reducedMatch[1]} since ${reducedMatch[2]}`;
  }

  const reducedFullMatch = html.match(/Reduced by[^<]+/i);
  if (reducedFullMatch) {
    return reducedFullMatch[0].trim();
  }

  const priceMatch = html.match(/\$\s*[0-9]{2,3},[0-9]{3}/);
  if (priceMatch) {
    return priceMatch[0].replace(/\s+/g, '');
  }

  return 'Message for current pricing';
}

// ----------------- OPENAI HELPERS -----------------

async function callOpenAI(messages) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages
  });
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
- Do NOT use "\\n" literally; use real line breaks.
- Use emojis where appropriate, like 🚗, 💰, 🔥, etc.
- Facebook: scroll-stopping hook, bullet list of benefits, strong CTA.
- Instagram: similar but slightly tighter and optimized for caption style.
- TikTok: more casual, can mention "algorithm" or "if this showed up on your feed".
- LinkedIn: more professional, tie to daily life, work, family, dependability.
- Twitter: short punchy version with CTA.
- textBlurb: 1–3 short sentences for SMS/DM outreach.
- marketplace: title + body like a Facebook Marketplace listing.
- hashtags: one line of hashtags that mixes general (e.g. #carsforsale) and specific that include the label, but remove commas.
- script: 30–40 second vertical video script with HOOK, EXTERIOR, INTERIOR, BENEFIT, CTA.
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
  res.send(`<!DOCTYPE html>
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

  </div>

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
</html>`);
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
