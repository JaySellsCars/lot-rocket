// app.js
// Lot Rocket – Social Media Kit + Photo & Video Helper (single-file app)

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// --------- Helper: basic URL validation ----------
function isLikelyUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// --------- Helper: build the AI prompt for social kit ----------
function buildSocialKitPrompt(url) {
  return `
You are "Lot Rocket", a social media and sales copy engine for car salespeople.

You will be given a dealer vehicle detail page URL:
${url}

1. First, infer:
   - Year, Make, Model, Trim
   - City and State if visible
   - Whether it's NEW or USED
   - Any obvious deal language (price, markdown, "Reduced by $X", etc.)

2. Then create:
   A. "label" – short vehicle label, for example:
      - "2024 Kia Sorento X-Line SX in NOVI, MI"
      - "2025 Chevrolet Tahoe RST Plymouth MI – Used"

   B. "priceInfo" – short human-friendly deal text, for example:
      - "$35,995"
      - "Reduced by $2,000 since Oct 18, 2025"
      - "Message for current pricing"

   C. Social posts that feel sharp, confident, and sales-focused.
      Do NOT use "\\n" escape characters – just real new lines.

      1) facebookPost
      2) instagramCaption
      3) tiktokCaption
      4) linkedinPost
      5) twitterPost
      6) textBlurb
      7) marketplaceDescription
      8) hashtags – a compact line of tags (no more than 10–14 tags)

   D. A 30–40 second "videoScript" you can read on camera.
      Make it natural, confident, and easy to read – no "[HOOK]" labels in the text itself.

   E. A "shotPlan" – 5–7 simple shot ideas for a vertical video.

Tone:
- Confident, helpful, and real – like a high-performing salesperson.
- Avoid cringe or over-hyped slang.
- Use "you" and "this one" naturally.

Return JSON with this shape, and nothing else:

{
  "label": "...",
  "priceInfo": "...",
  "facebookPost": "...",
  "instagramCaption": "...",
  "tiktokCaption": "...",
  "linkedinPost": "...",
  "twitterPost": "...",
  "textBlurb": "...",
  "marketplaceDescription": "...",
  "hashtags": "...",
  "videoScript": "...",
  "shotPlan": "..."
}
  `.trim();
}

// ---------- AI: main social kit ----------
app.post("/api/social-kit", async (req, res) => {
  try {
    const { url } = req.body;
    if (!isLikelyUrl(url)) {
      return res.status(400).json({ error: "Please provide a valid dealer vehicle URL." });
    }

    const prompt = buildSocialKitPrompt(url);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.85,
      messages: [
        {
          role: "system",
          content:
            "You are Lot Rocket, an AI assistant helping car salespeople create social media content that is confident and easy to use. Always answer in valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content || "{}";
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "AI returned invalid JSON." });
    }

    const {
      label = "",
      priceInfo = "",
      facebookPost = "",
      instagramCaption = "",
      tiktokCaption = "",
      linkedinPost = "",
      twitterPost = "",
      textBlurb = "",
      marketplaceDescription = "",
      hashtags = "",
      videoScript = "",
      shotPlan = "",
    } = data;

    res.json({
      label,
      priceInfo,
      facebookPost,
      instagramCaption,
      tiktokCaption,
      linkedinPost,
      twitterPost,
      textBlurb,
      marketplaceDescription,
      hashtags,
      videoScript,
      shotPlan,
    });
  } catch (err) {
    console.error("Error in /api/social-kit:", err);
    res.status(500).json({ error: "Something went wrong generating the social kit." });
  }
});

// ---------- AI: new single post variation ----------
app.post("/api/new-social-post", async (req, res) => {
  try {
    const { type, label, priceInfo, previousPost } = req.body;

    const typeName =
      {
        facebook: "Facebook post",
        instagram: "Instagram caption",
        tiktok: "TikTok caption",
        linkedin: "LinkedIn post",
        twitter: "X / Twitter post",
        text: "Text or DM blurb",
        marketplace: "Facebook Marketplace description",
      }[type] || "social media post";

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content:
            "You are Lot Rocket, an AI that writes confident, sales-driven social content for car listings. Avoid cringe slang. Output only the post text.",
        },
        {
          role: "user",
          content: `
Vehicle: ${label || "this vehicle"}
Deal: ${priceInfo || "Message for current pricing"}

Platform: ${typeName}

Previous version of this post (for variety, don't repeat it exactly):
${previousPost || "(none provided)"}

Write a fresh version of this post for that platform.
Keep it tight, confident, and easy to copy-paste.
Do NOT include any JSON, markup, or commentary – ONLY the raw post text.
          `.trim(),
        },
      ],
    });

    res.json({ post: completion.choices[0].message.content || "" });
  } catch (err) {
    console.error("Error in /api/new-social-post:", err);
    res.status(500).json({ error: "Could not generate a new post." });
  }
});

// ---------- AI: new video script ----------
app.post("/api/new-script", async (req, res) => {
  try {
    const { label, priceInfo, previousScript } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content:
            "You are Lot Rocket, an AI that writes 30–40 second vertical video scripts for car salespeople. Output only script text, no labels.",
        },
        {
          role: "user",
          content: `
Vehicle: ${label || "this vehicle"}
Deal: ${priceInfo || "Message for current pricing"}

Previous script (for variety – do not repeat):
${previousScript || "(none)"}

Write a new 30–40 second script that can be read straight to camera.
Keep it conversational and confident, and mention that they can DM 'INFO' or reach out for details.
          `.trim(),
        },
      ],
    });

    res.json({ script: completion.choices[0].message.content || "" });
  } catch (err) {
    console.error("Error in /api/new-script:", err);
    res.status(500).json({ error: "Could not generate a new script." });
  }
});

// ---------- AI: new hashtags ----------
app.post("/api/new-tags", async (req, res) => {
  try {
    const { label, priceInfo, previousTags } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content:
            "You are Lot Rocket, an AI that creates compact, high-signal hashtags for car listings. Output a single line of #hashtags with spaces in between.",
        },
        {
          role: "user",
          content: `
Vehicle: ${label || "this vehicle"}
Deal: ${priceInfo || "Message for current pricing"}

Previous tags (for variety):
${previousTags || "(none)"}

Create a new line of 8–14 relevant hashtags for Instagram/TikTok/X.
          `.trim(),
        },
      ],
    });

    res.json({ hashtags: completion.choices[0].message.content || "" });
  } catch (err) {
    console.error("Error in /api/new-tags:", err);
    res.status(500).json({ error: "Could not generate new hashtags." });
  }
});

// ---------- Photo scraper ----------
async function scrapeImageUrls(pageUrl, maxImages = 30) {
  const urls = new Set();

  const res = await fetch(pageUrl, { redirect: "follow" });
  const html = await res.text();

  // Very simple <img ... src="..."> finder
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) && urls.size < maxImages) {
    let src = match[1];
    if (!src || src.startsWith("data:")) continue;
    try {
      const absolute = new URL(src, pageUrl).href;
      // basic filter for vehicle-style photos (jpeg/png/webp)
      if (/\.(jpe?g|png|webp)(\?|#|$)/i.test(absolute)) {
        urls.add(absolute);
      }
    } catch {
      // ignore bad URLs
    }
  }

  return Array.from(urls);
}

app.post("/api/grab-photos", async (req, res) => {
  try {
    const { url } = req.body;
    if (!isLikelyUrl(url)) {
      return res.status(400).json({ error: "Please provide a valid dealer vehicle URL." });
    }

    const photos = await scrapeImageUrls(url, 40);
    res.json({ photos });
  } catch (err) {
    console.error("Error in /api/grab-photos:", err);
    res.status(500).json({ error: "Could not grab photos from the URL." });
  }
});

// ---------- NEW: Build video plan from photos ----------
app.post("/api/video-from-photos", async (req, res) => {
  try {
    const { label, priceInfo, photos } = req.body;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return res
        .status(400)
        .json({ error: "No photos provided. Grab dealer photos first, then build a video plan." });
    }

    // We won't send the raw URLs (can be long); just tell the model how many there are.
    const photoCount = photos.length;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.85,
      messages: [
        {
          role: "system",
          content:
            "You are Lot Rocket, an AI assistant helping car salespeople plan short-form videos using the photos they already have. Output a clear, numbered shot list.",
        },
        {
          role: "user",
          content: `
Vehicle: ${label || "this vehicle"}
Deal info: ${priceInfo || "Message for current pricing"}
Number of available photos: ${photoCount}

The salesperson has a gallery of vehicle photos scraped from the dealer page.
Create a tight 20–35 second vertical video plan that:

- Uses 5–10 clips.
- References photos by index, starting at 1. Example: "Clip 1 – Photo 1 (front 3/4 exterior)".
- Suggests approximate duration per clip (in seconds).
- Suggests on-screen text or captions for a few clips.
- Ends with a strong CTA (DM 'INFO', schedule test drive, etc.).
- Includes one short line about recommended music vibe (for example: "Use chill upbeat hip-hop" or "Fast-paced rock").

Do NOT try to guess exact content of each photo – just assume there are typical vehicle angles
(front, side, interior, dash, wheels, cargo, etc.). Be practical and easy to follow.

Output plain text only (no JSON, no markdown).
        `.trim(),
        },
      ],
    });

    const plan = completion.choices[0].message.content || "";
    res.json({ plan });
  } catch (err) {
    console.error("Error in /api/video-from-photos:", err);
    res.status(500).json({ error: "Could not build a video plan from photos." });
  }
});

// ---------- Front-end UI ----------
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Lot Rocket – Social Media Kit</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg: #050509;
      --card-bg: #11111a;
      --accent: #ff4b2b;
      --accent-soft: #ff9a76;
      --text: #ffffff;
      --muted: #a0a0b8;
      --border: #262637;
      --radius-lg: 18px;
      --radius-sm: 10px;
      --shadow-soft: 0 18px 45px rgba(0, 0, 0, 0.65);
      --transition-fast: 0.15s ease-out;
      --font-main: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: var(--font-main);
      background: radial-gradient(circle at top left, #201022, #050509 55%);
      color: var(--text);
      min-height: 100vh;
    }

    .page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 16px 40px;
    }

    header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 28px;
    }

    .logo-title {
      font-size: 1.9rem;
      font-weight: 800;
      letter-spacing: 0.02em;
    }

    .logo-title span:first-child {
      color: var(--accent);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: linear-gradient(135deg, rgba(255, 75, 43, 0.28), transparent);
      font-size: 0.78rem;
      color: var(--muted);
    }

    .badge span {
      font-size: 1rem;
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.1fr);
      gap: 20px;
    }

    @media (max-width: 900px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .card {
      background: radial-gradient(circle at top left, #1b1220, #0c0c14 50%);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-soft);
      padding: 18px 18px 16px;
      position: relative;
      overflow: hidden;
    }

    h1, h2, h3 {
      margin: 0 0 8px;
    }

    h2 {
      font-size: 1.1rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--muted);
    }

    label {
      display: block;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 6px;
    }

    input[type="text"], textarea {
      width: 100%;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: rgba(10, 10, 22, 0.9);
      color: var(--text);
      padding: 10px 11px;
      font-size: 0.9rem;
      outline: none;
      resize: vertical;
      min-height: 0;
      transition: border var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
    }

    input[type="text"]:focus, textarea:focus {
      border-color: var(--accent-soft);
      box-shadow: 0 0 0 1px rgba(255, 75, 43, 0.35);
      background: rgba(8, 8, 20, 0.95);
    }

    textarea {
      min-height: 120px;
      font-family: var(--font-main);
      line-height: 1.35;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 999px;
      padding: 9px 14px;
      font-size: 0.86rem;
      border: none;
      background: linear-gradient(120deg, var(--accent), #ff7a3c);
      color: #fff;
      cursor: pointer;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      box-shadow: 0 10px 30px rgba(255, 75, 43, 0.4);
      transition: transform var(--transition-fast), box-shadow var(--transition-fast), filter var(--transition-fast);
    }

    .btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.04);
      box-shadow: 0 14px 35px rgba(255, 75, 43, 0.55);
    }

    .btn:disabled {
      opacity: 0.45;
      cursor: default;
      box-shadow: none;
      transform: none;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      box-shadow: none;
      text-transform: none;
      letter-spacing: 0.01em;
      font-weight: 500;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.08);
      box-shadow: none;
    }

    .muted {
      color: var(--muted);
      font-size: 0.8rem;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: var(--muted);
    }

    .section-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .posts-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }

    .post-card {
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      padding: 10px 10px 8px;
      background: rgba(4, 4, 10, 0.9);
    }

    .post-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .post-header h3 {
      font-size: 0.86rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }

    .post-header .pill {
      font-size: 0.72rem;
    }

    .post-body textarea {
      font-size: 0.86rem;
      min-height: 90px;
    }

    .copy-btn {
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.11);
      color: var(--muted);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }

    .chips span {
      font-size: 0.7rem;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--muted);
    }

    .two-col {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
      gap: 12px;
      margin-top: 10px;
    }

    .photo-grid {
      margin-top: 8px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 6px;
    }

    .photo-grid img {
      width: 100%;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      object-fit: cover;
      height: 70px;
      cursor: pointer;
      transition: transform 0.1s ease-out, box-shadow 0.15s ease-out;
    }

    .photo-grid img:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(0, 0, 0, 0.6);
    }

    .tagline {
      color: var(--muted);
      font-size: 0.9rem;
      max-width: 480px;
    }

    .listing-summary {
      margin-top: 8px;
      padding: 10px 11px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: rgba(5, 5, 15, 0.96);
      font-size: 0.86rem;
    }

    .listing-summary strong {
      color: var(--accent-soft);
    }

    .pill-small {
      font-size: 0.72rem;
      padding: 2px 6px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: var(--muted);
    }

    footer {
      margin-top: 24px;
      text-align: center;
      font-size: 0.72rem;
      color: var(--muted);
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div>
        <div class="logo-title">
          <span>Lot Rocket</span> <span>Social Media Kit</span>
        </div>
        <div class="tagline">
          Paste a dealer vehicle URL. Get ready-to-use posts for every platform, plus a video script, shot plan, and dealer photos you can use for content.
        </div>
      </div>
      <div class="badge">
        <span>🚀</span>
        <span>Prototype – for salespeople, not stores</span>
      </div>
    </header>

    <div class="grid">
      <!-- LEFT COLUMN: URL + listing summary + media tools -->
      <div class="card">
        <div class="section-title-row">
          <h2>Step 1 · Dealer URL</h2>
          <span class="pill">Paste full vehicle detail page</span>
        </div>
        <label for="urlInput">Dealer vehicle URL</label>
        <input type="text" id="urlInput" placeholder="https://dealer.com/vehicle-detail-page" />

        <div style="margin-top: 12px; display: flex; gap: 10px; align-items: center;">
          <button class="btn" id="boostBtn">🚀 Boost This Listing</button>
          <span id="statusText" class="muted">Paste the URL and hit Boost.</span>
        </div>

        <div class="listing-summary" id="listingSummary" style="margin-top: 16px; display:none;">
          <div><strong id="summaryLabel"></strong></div>
          <div id="summaryPrice" style="margin-top:4px;"></div>
          <div style="margin-top:4px;" class="muted">You can edit these below before generating fresh posts or scripts.</div>
        </div>

        <div class="two-col" style="margin-top: 16px;">
          <div>
            <label for="labelInput">Vehicle label (editable)</label>
            <input type="text" id="labelInput" placeholder="2024 Kia Sorento X-Line SX in NOVI, MI" />
          </div>
          <div>
            <label for="priceInput">Price / deal info (editable)</label>
            <input type="text" id="priceInput" placeholder="$35,995 or 'Reduced by $2,000 since Oct 18, 2025'" />
          </div>
        </div>

        <h2 style="margin-top:22px;">Media Tools</h2>
        <p class="muted" style="margin-bottom:10px;">Grab photos from the dealer page and turn them into a simple video plan.</p>

        <div class="card" style="margin:0; padding:12px 12px 10px;">
          <div class="section-title-row">
            <h3 style="font-size:0.95rem;">📸 Dealer Photos</h3>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
            <button class="btn-secondary" id="grabPhotosBtn">📸 Grab Photos From URL</button>
            <button class="btn-secondary" id="buildVideoFromPhotosBtn" disabled>🎬 Build Video from Photos</button>
          </div>
          <div id="photosStatus" class="muted">No photos grabbed yet.</div>
          <div id="photosGrid" class="photo-grid"></div>
        </div>

        <div class="card" style="margin-top:10px; padding:12px 12px 10px;">
          <div class="section-title-row">
            <h3 style="font-size:0.95rem;">🎬 Video From Photos Plan</h3>
            <span class="pill-small">Use for CapCut / Reels / TikTok</span>
          </div>
          <textarea id="videoFromPhotosPlan" placeholder="Hit 'Build Video from Photos' after grabbing them." rows="9" readonly></textarea>
        </div>
      </div>

      <!-- RIGHT COLUMN: social posts + video script + shot plan -->
      <div class="card">
        <div class="section-title-row">
          <h2>Step 2 · Social kit</h2>
          <span class="pill">Copy, tweak, and post</span>
        </div>
        <p class="muted" style="margin-bottom:10px;">Each box is ready-to-use. Hit “New Post” to spin a fresh version for that platform.</p>

        <div class="posts-grid">
          <!-- Facebook -->
          <div class="post-card">
            <div class="post-header">
              <h3>📘 Facebook Post</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" id="fbNewBtn">🔁 New Post</button>
                <button class="copy-btn" data-target="facebookPost">📋 Copy</button>
              </div>
            </div>
            <div class="post-body">
              <textarea id="facebookPost" placeholder="Your Facebook post will appear here."></textarea>
            </div>
          </div>

          <!-- Instagram -->
          <div class="post-card">
            <div class="post-header">
              <h3>📸 Instagram Caption</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" id="igNewBtn">🔁 New Post</button>
                <button class="copy-btn" data-target="instagramCaption">📋 Copy</button>
              </div>
            </div>
            <div class="post-body">
              <textarea id="instagramCaption" placeholder="Your Instagram caption will appear here."></textarea>
            </div>
          </div>

          <!-- TikTok -->
          <div class="post-card">
            <div class="post-header">
              <h3>🎵 TikTok Caption</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" id="ttNewBtn">🔁 New Post</button>
                <button class="copy-btn" data-target="tiktokCaption">📋 Copy</button>
              </div>
            </div>
            <div class="post-body">
              <textarea id="tiktokCaption" placeholder="Your TikTok caption will appear here."></textarea>
            </div>
          </div>

          <!-- LinkedIn -->
          <div class="post-card">
            <div class="post-header">
              <h3>💼 LinkedIn Post</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" id="liNewBtn">🔁 New Post</button>
                <button class="copy-btn" data-target="linkedinPost">📋 Copy</button>
              </div>
            </div>
            <div class="post-body">
              <textarea id="linkedinPost" placeholder="Your LinkedIn post will appear here."></textarea>
            </div>
          </div>

          <!-- X / Twitter -->
          <div class="post-card">
            <div class="post-header">
              <h3>🐦 X / Twitter Post</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" id="twNewBtn">🔁 New Post</button>
                <button class="copy-btn" data-target="twitterPost">📋 Copy</button>
              </div>
            </div>
            <div class="post-body">
              <textarea id="twitterPost" placeholder="Your X / Twitter post will appear here."></textarea>
            </div>
          </div>

          <!-- Text / DM -->
          <div class="post-card">
            <div class="post-header">
              <h3>💬 Text / DM Blurb</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" id="txtNewBtn">🔁 New Text</button>
                <button class="copy-btn" data-target="textBlurb">📋 Copy</button>
              </div>
            </div>
            <div class="post-body">
              <textarea id="textBlurb" placeholder="Your short text / DM blurb will appear here."></textarea>
            </div>
          </div>

          <!-- Marketplace -->
          <div class="post-card">
            <div class="post-header">
              <h3>🛒 Facebook Marketplace Description</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" id="mpNewBtn">🔁 New Post</button>
                <button class="copy-btn" data-target="marketplaceDescription">📋 Copy</button>
              </div>
            </div>
            <div class="post-body">
              <textarea id="marketplaceDescription" placeholder="Your Marketplace description will appear here."></textarea>
            </div>
          </div>

          <!-- Hashtags -->
          <div class="post-card">
            <div class="post-header">
              <h3>🏷 Hashtags</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" id="tagsNewBtn">🔁 New Tags</button>
                <button class="copy-btn" data-target="hashtags">📋 Copy</button>
              </div>
            </div>
            <div class="post-body">
              <textarea id="hashtags" placeholder="#tags will appear here"></textarea>
            </div>
          </div>

          <!-- Video script & shot plan -->
          <div class="post-card">
            <div class="post-header">
              <h3>🎥 Viral Video Script</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn-secondary" id="scriptNewBtn">🔁 New Script</button>
                <button class="copy-btn" data-target="videoScript">📋 Copy</button>
              </div>
            </div>
            <div class="post-body">
              <textarea id="videoScript" placeholder="Your 30–40 second script for Reels / TikTok / Shorts will appear here."></textarea>
            </div>
          </div>

          <div class="post-card">
            <div class="post-header">
              <h3>👀 Viral Visual Shot Plan</h3>
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="copy-btn" data-target="shotPlan">📋 Copy</button>
              </div>
            </div>
            <div class="post-body">
              <textarea id="shotPlan" placeholder="Simple shot plan will appear here." rows="7"></textarea>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer>
      Prototype for salespeople. Copy, tweak, and make it yours. 🚀
    </footer>
  </div>

  <script>
    const boostBtn = document.getElementById("boostBtn");
    const urlInput = document.getElementById("urlInput");
    const statusText = document.getElementById("statusText");

    const summaryBox = document.getElementById("listingSummary");
    const summaryLabel = document.getElementById("summaryLabel");
    const summaryPrice = document.getElementById("summaryPrice");
    const labelInput = document.getElementById("labelInput");
    const priceInput = document.getElementById("priceInput");

    const facebookPostEl = document.getElementById("facebookPost");
    const instagramCaptionEl = document.getElementById("instagramCaption");
    const tiktokCaptionEl = document.getElementById("tiktokCaption");
    const linkedinPostEl = document.getElementById("linkedinPost");
    const twitterPostEl = document.getElementById("twitterPost");
    const textBlurbEl = document.getElementById("textBlurb");
    const marketplaceDescriptionEl = document.getElementById("marketplaceDescription");
    const hashtagsEl = document.getElementById("hashtags");
    const videoScriptEl = document.getElementById("videoScript");
    const shotPlanEl = document.getElementById("shotPlan");

    const fbNewBtn = document.getElementById("fbNewBtn");
    const igNewBtn = document.getElementById("igNewBtn");
    const ttNewBtn = document.getElementById("ttNewBtn");
    const liNewBtn = document.getElementById("liNewBtn");
    const twNewBtn = document.getElementById("twNewBtn");
    const txtNewBtn = document.getElementById("txtNewBtn");
    const mpNewBtn = document.getElementById("mpNewBtn");
    const tagsNewBtn = document.getElementById("tagsNewBtn");
    const scriptNewBtn = document.getElementById("scriptNewBtn");

    const grabPhotosBtn = document.getElementById("grabPhotosBtn");
    const buildVideoFromPhotosBtn = document.getElementById("buildVideoFromPhotosBtn");
    const photosStatus = document.getElementById("photosStatus");
    const photosGrid = document.getElementById("photosGrid");
    const videoFromPhotosPlan = document.getElementById("videoFromPhotosPlan");

    let dealerPhotos = [];

    function setStatus(msg) {
      statusText.textContent = msg;
    }

    async function callJson(url, payload) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || ("Request failed: " + res.status));
      }
      return res.json();
    }

    // Boost – main social kit
    boostBtn.addEventListener("click", async () => {
      const url = urlInput.value.trim();
      if (!url) {
        setStatus("Please paste a dealer vehicle URL first.");
        return;
      }

      boostBtn.disabled = true;
      setStatus("Working on your social kit…");

      try {
        const data = await callJson("/api/social-kit", { url });

        labelInput.value = data.label || "";
        priceInput.value = data.priceInfo || "";

        if (data.label || data.priceInfo) {
          summaryBox.style.display = "block";
          summaryLabel.textContent = data.label || "";
          summaryPrice.textContent = data.priceInfo || "";
        }

        facebookPostEl.value = data.facebookPost || "";
        instagramCaptionEl.value = data.instagramCaption || "";
        tiktokCaptionEl.value = data.tiktokCaption || "";
        linkedinPostEl.value = data.linkedinPost || "";
        twitterPostEl.value = data.twitterPost || "";
        textBlurbEl.value = data.textBlurb || "";
        marketplaceDescriptionEl.value = data.marketplaceDescription || "";
        hashtagsEl.value = data.hashtags || "";
        videoScriptEl.value = data.videoScript || "";
        shotPlanEl.value = data.shotPlan || "";

        setStatus("Social kit ready. Review, tweak, and post.");
      } catch (err) {
        console.error(err);
        setStatus("Something went wrong generating your kit.");
        alert("Error: " + err.message);
      } finally {
        boostBtn.disabled = false;
      }
    });

    // Copy buttons
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const el = document.getElementById(targetId);
        if (!el) return;
        el.select();
        document.execCommand("copy");
        btn.textContent = "✅ Copied";
        setTimeout(() => (btn.textContent = "📋 Copy"), 1300);
      });
    });

    // Helpers to get current label/price
    function currentLabel() {
      return labelInput.value.trim() || summaryLabel.textContent.trim();
    }
    function currentPriceInfo() {
      return priceInput.value.trim() || summaryPrice.textContent.trim();
    }

    // New post buttons
    fbNewBtn.addEventListener("click", () =>
      spinNewPost("facebook", facebookPostEl, fbNewBtn)
    );
    igNewBtn.addEventListener("click", () =>
      spinNewPost("instagram", instagramCaptionEl, igNewBtn)
    );
    ttNewBtn.addEventListener("click", () =>
      spinNewPost("tiktok", tiktokCaptionEl, ttNewBtn)
    );
    liNewBtn.addEventListener("click", () =>
      spinNewPost("linkedin", linkedinPostEl, liNewBtn)
    );
    twNewBtn.addEventListener("click", () =>
      spinNewPost("twitter", twitterPostEl, twNewBtn)
    );
    txtNewBtn.addEventListener("click", () =>
      spinNewPost("text", textBlurbEl, txtNewBtn)
    );
    mpNewBtn.addEventListener("click", () =>
      spinNewPost("marketplace", marketplaceDescriptionEl, mpNewBtn)
    );

    async function spinNewPost(type, textareaEl, buttonEl) {
      try {
        buttonEl.disabled = true;
        buttonEl.textContent = "…";
        const data = await callJson("/api/new-social-post", {
          type,
          label: currentLabel(),
          priceInfo: currentPriceInfo(),
          previousPost: textareaEl.value,
        });
        textareaEl.value = data.post || "";
      } catch (err) {
        console.error(err);
        alert("Error generating new post: " + err.message);
      } finally {
        buttonEl.disabled = false;
        buttonEl.textContent = "🔁 New Post";
      }
    }

    // New script button
    scriptNewBtn.addEventListener("click", async () => {
      try {
        scriptNewBtn.disabled = true;
        scriptNewBtn.textContent = "…";
        const data = await callJson("/api/new-script", {
          label: currentLabel(),
          priceInfo: currentPriceInfo(),
          previousScript: videoScriptEl.value,
        });
        videoScriptEl.value = data.script || "";
      } catch (err) {
        console.error(err);
        alert("Error generating new script: " + err.message);
      } finally {
        scriptNewBtn.disabled = false;
        scriptNewBtn.textContent = "🔁 New Script";
      }
    });

    // New tags button
    tagsNewBtn.addEventListener("click", async () => {
      try {
        tagsNewBtn.disabled = true;
        tagsNewBtn.textContent = "…";
        const data = await callJson("/api/new-tags", {
          label: currentLabel(),
          priceInfo: currentPriceInfo(),
          previousTags: hashtagsEl.value,
        });
        hashtagsEl.value = data.hashtags || "";
      } catch (err) {
        console.error(err);
        alert("Error generating new tags: " + err.message);
      } finally {
        tagsNewBtn.disabled = false;
        tagsNewBtn.textContent = "🔁 New Tags";
      }
    });

    // --- Dealer photos ---
    grabPhotosBtn.addEventListener("click", async () => {
      const url = urlInput.value.trim();
      if (!url) {
        alert("Paste the dealer vehicle URL first.");
        return;
      }
      grabPhotosBtn.disabled = true;
      photosStatus.textContent = "Grabbing photos from the dealer page…";
      photosGrid.innerHTML = "";
      dealerPhotos = [];
      buildVideoFromPhotosBtn.disabled = true;
      videoFromPhotosPlan.value = "";

      try {
        const data = await callJson("/api/grab-photos", { url });
        dealerPhotos = data.photos || [];
        if (!dealerPhotos.length) {
          photosStatus.textContent = "No suitable images found on that page.";
          return;
        }
        photosStatus.textContent = \`Found \${dealerPhotos.length} photos. Click any to open full size.\`;
        buildVideoFromPhotosBtn.disabled = false;

        dealerPhotos.forEach((src) => {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "Vehicle photo";
          img.addEventListener("click", () => window.open(src, "_blank"));
          photosGrid.appendChild(img);
        });
      } catch (err) {
        console.error(err);
        photosStatus.textContent = "Error grabbing photos.";
        alert("Error: " + err.message);
      } finally {
        grabPhotosBtn.disabled = false;
      }
    });

    // --- Video from photos plan ---
    buildVideoFromPhotosBtn.addEventListener("click", async () => {
      if (!dealerPhotos.length) {
        alert("Grab photos first, then build a video plan.");
        return;
      }
      buildVideoFromPhotosBtn.disabled = true;
      buildVideoFromPhotosBtn.textContent = "Building…";
      videoFromPhotosPlan.value = "Building a plan from your photos…";

      try {
        const data = await callJson("/api/video-from-photos", {
          label: currentLabel(),
          priceInfo: currentPriceInfo(),
          photos: dealerPhotos,
        });
        videoFromPhotosPlan.value = data.plan || "";
      } catch (err) {
        console.error(err);
        videoFromPhotosPlan.value = "Error building video plan.";
        alert("Error: " + err.message);
      } finally {
        buildVideoFromPhotosBtn.disabled = false;
        buildVideoFromPhotosBtn.textContent = "🎬 Build Video from Photos";
      }
    });
  </script>
</body>
</html>`);
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`Lot Rocket listening on port ${PORT}`);
});
