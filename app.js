/**
 * app.js — Lot Rocket Backend (CLEAN / DEDUPED / CONSISTENT)
 * Version: 2.6-clean (ROCKET-6) — SINGLE BOOST SOURCE OF TRUTH
 *
 * KEY FIXES (THIS PASS):
 * ✅ NO req.body inside helper functions (buildKitForUrl has NO req scope)
 * ✅ processPhotosRequested/processPhotos exist ONLY inside routes (no redeclare crash)
 * ✅ Step 2 payload always includes: description (string) + posts (string[]) + named fields
 * ✅ HARD-BAN URL-only “posts” (sanitizeCopy kills URL-only + strips URLs)
 */

require("dotenv").config();
const HAS_OPENAI_KEY = !!process.env.OPENAI_API_KEY;

// Node 18+ has global fetch (Render uses Node 22) — safe fallback
let fetchFn = global.fetch;
if (typeof fetchFn !== "function") {
  try {
    // eslint-disable-next-line global-require
    fetchFn = require("node-fetch");
  } catch {
    throw new Error("Fetch is not available. Use Node 18+ or install node-fetch.");
  }
}

const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const archiver = require("archiver");

const app = express();

// -------------------- OpenAI Client --------------------
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -------------------- Middleware --------------------
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
// ======================================================
// PROMPT LIBRARY (GLOBAL – USED BY ALL AI ROUTES)
// ======================================================

const PROMPTS = {
  SOCIAL_POST: `
You are a master automotive marketer.
Write high-conversion social media posts.
Be punchy, modern, confident, and persuasive.
No links. No emojis unless appropriate.
`,

  SOCIAL_REWRITE: `
Rewrite the post with a fresh angle.
Short, emotional, scroll-stopping.
No emojis unless natural.
`,

  VIDEO_SCRIPT: `
You are a short-form video script expert.
Write natural spoken dialogue.
No narration tags. No scene labels.
`,

  MESSAGE_REPLY: `
Write a friendly, human response to a customer message.
No pressure. No salesy tone.
`,

  GENERIC: `
You are a helpful automotive assistant.
Respond clearly and professionally.
`
};

// ======================================================
// Text helpers
// ======================================================
function cleanText(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

// ✅ URL guards (prevents “web address only” Step 2)
function isUrlOnly(s) {
  const t = String(s || "").trim();
  return /^https?:\/\/\S+$/i.test(t);
}
function stripUrlsFromText(s) {
  return String(s || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function sanitizeCopy(s) {
  const t = cleanText(s);
  if (!t) return "";
  if (isUrlOnly(t)) return "";
  const noUrls = stripUrlsFromText(t);
  if (!noUrls) return "";
  if (noUrls.length < 10) return "";
  return noUrls;
}

// --------------------------------------------------
// Extract description from HTML (safe + robust)
// --------------------------------------------------
function extractVehicleDescriptionFromHtml($, html) {
  const meta =
    cleanText($('meta[name="description"]').attr("content")) ||
    cleanText($('meta[property="og:description"]').attr("content"));

  if (meta && meta.length > 40) return meta;

  // JSON-LD structured data
  try {
    const ldNodes = $('script[type="application/ld+json"]');

    for (let i = 0; i < ldNodes.length; i++) {
      const raw = $(ldNodes[i]).text();
      if (!raw) continue;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const obj of items) {
        const desc =
          cleanText(obj?.description) ||
          cleanText(obj?.offers?.description) ||
          cleanText(obj?.itemOffered?.description);

        if (desc && desc.length > 40) return desc;
      }
    }
  } catch {
    // ignore
  }

  // DOM fallbacks
  const selectors = [
    ".vehicle-description",
    ".vdp-description",
    ".description",
    "#description",
    ".dealer-comments",
    ".comments",
    ".remarks",
    "[data-testid='vehicle-description']",
  ];

  for (const sel of selectors) {
    const text = cleanText($(sel).first().text());
    if (text && text.length > 40) return text;
  }

  const bodyText = cleanText(($("body").text() || "").slice(0, 600));
  if (bodyText.length > 80) return bodyText;

  return "";
}

// --------------------------------------------------
// Fallback post generator (NO AI REQUIRED)
// ✅ NO URL APPEND
// --------------------------------------------------
function buildFallbackPosts({ label, price, description }) {
  const baseTags = ["#CarForSale", "#NewCar", "#UsedCars", "#AutoDeals", "#CarShopping", "#TestDrive"];

  const labelTags = cleanText(label)
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => "#" + w.replace(/[^\w]/g, ""))
    .filter((t) => t.length > 2);

  const tags = [...new Set([...labelTags, ...baseTags])].slice(0, 10).join(" ");
  const line = description ? `\n\n${cleanText(description).slice(0, 220)}…` : "";

  return [
    `🔥 JUST IN: ${label || "Fresh Inventory"}${price ? ` • ${price}` : ""}\n✅ Ready for a quick approval + easy test drive?\n📲 Message me “INFO” and I’ll send details.${line}\n\n${tags}`.trim(),
    `🚗 ${label || "Available now"}${price ? ` • ${price}` : ""}\n💥 Clean, sharp, and ready to roll.\n📩 Comment “YES” and I’ll DM the full rundown + next steps.${line}\n\n${tags}`.trim(),
    `⚡️ Hot pick: ${label || "This one won’t last"}${price ? ` • ${price}` : ""}\n🕒 Want to see it today?\n📲 Send “APPT” and I’ll lock in a time.${line}\n\n${tags}`.trim(),
  ];
}

// ======================================================
// Photo URL normalizer (DEDUP / CLEAN)
// ======================================================
function normalizePhotoUrl(u) {
  if (!u) return "";
  try {
    const url = new URL(u);

    [
      "width",
      "height",
      "w",
      "h",
      "fit",
      "crop",
      "quality",
      "q",
      "auto",
      "fm",
      "fmt",
      "dpr",
      "cache",
      "cb",
    ].forEach((k) => url.searchParams.delete(k));

    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return String(u).trim();
  }
}

function uniqPhotos(urls, cap = 300) {
  const seen = new Set();
  const out = [];
  for (const raw of urls || []) {
    const n = normalizePhotoUrl(raw);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= cap) break;
  }
  return out;
}

// ======================================================
// Helpers (single source of truth)
// ======================================================
function normalizeUrl(raw) {
  if (!raw) return null;
  let url = String(raw).trim();
  if (!url) return null;

  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url.replace(/^\/+/, "");
  }

  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function getResponseText(response) {
  return response?.output?.[0]?.content?.[0]?.text || "";
}

function isRateLimitError(err) {
  const msg = ((err && (err.message || err.error?.message || "")) || "").toLowerCase();
  if (msg.includes("rate limit")) return true;
  if (msg.includes("quota") || msg.includes("billing")) return true;
  if (msg.includes("insufficient") && msg.includes("quota")) return true;
  if (err?.code === "rate_limit_exceeded") return true;
  if (err?.error?.type === "rate_limit_exceeded") return true;
  if (err?.status === 429) return true;
  if (err?.response?.status === 429) return true;
  return false;
}

function sendAIError(res, err, friendlyMessage) {
  console.error("🔴 AI error:", friendlyMessage, err);

  const rawMsg = (err && (err.message || err.error?.message || "")) || "Unknown error";

  if (isRateLimitError(err)) {
    const lower = rawMsg.toLowerCase();
    const isQuotaOrBilling =
      lower.includes("quota") ||
      lower.includes("billing") ||
      (lower.includes("insufficient") && lower.includes("balance"));

    return res.status(429).json({
      error: isQuotaOrBilling ? "quota" : "rate_limit",
      message: isQuotaOrBilling
        ? "Lot Rocket’s AI quota / billing looks tapped on the server. Check the OpenAI key and billing settings."
        : "Lot Rocket hit the AI rate limit for a moment. Wait 20–30 seconds and try again.",
      rawMessage: rawMsg,
    });
  }

  return res.status(500).json({
    error: "server_error",
    message: friendlyMessage,
    rawMessage: rawMsg,
  });
}

function isBlockedProxyTarget(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname?.toLowerCase() || "";

    if (host === "localhost" || host.endsWith(".localhost")) return true;

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      if (host.startsWith("127.")) return true;
      if (host.startsWith("10.")) return true;
      if (host.startsWith("192.168.")) return true;
      if (host.startsWith("169.254.")) return true;

      const parts = host.split(".").map((n) => Number(n));
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    }

    return false;
  } catch {
    return true;
  }
}

// ======================================================
// Photo cleaning (DEDUPED + CONSISTENT)
// ======================================================
function normalizeImgUrl(u) {
  if (!u) return "";
  return String(u).trim().replace(/&amp;/g, "&");
}

function isLikelyJunkImage(url) {
  const u = (url || "").toLowerCase();
  if (!u.startsWith("http")) return true;
  if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(u)) return true;

  const bad = [
    "logo",
    "brand",
    "dealer",
    "dealership",
    "icon",
    "favicon",
    "sprite",
    "badge",
    "placeholder",
    "blank",
    "spacer",
    "loading",
    "loader",
    "spinner",
    "button",
    "cta",
    "banner",
    "header",
    "footer",
    "facebook",
    "instagram",
    "tiktok",
    "youtube",
    "carfax",
    "autocheck",
    "kbb",
    "edmunds",
    "special",
    "offer",
    "sale",
    "finance",
    "payment",
    "play",
    "video",
    "overlay",
    "watermark",
    ".svg",
  ];

  if (bad.some((w) => u.includes(w))) return true;
  return false;
}

function cleanPhotoList(urls, max = 300) {
  const seen = new Set();
  const out = [];

  for (const raw of urls || []) {
    const u = normalizeImgUrl(raw);
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);

    if (isLikelyJunkImage(u)) continue;

    out.push(u);
    if (out.length >= max) break;
  }

  return out;
}

function preferVehicleGalleryPhotos(cleanedUrls) {
  const re =
    /inventory|vehicle|vdp|media|photos|images|cdn|cloudfront|dealerinspire|vauto|cargurus|dealer\.com|spincar|imagerelay|gubagoo/i;

  const preferred = (cleanedUrls || []).filter((u) => re.test(String(u)));
  return preferred.length ? preferred : (cleanedUrls || []);
}
// ======================================================
// FAST CACHE (Boost speed-up)
// ======================================================
const PAGE_CACHE = new Map(); // url -> { ts, value }
const PAGE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PAGE_CACHE_MAX = 50;

function cacheGet(key) {
  const hit = PAGE_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > PAGE_CACHE_TTL_MS) {
    PAGE_CACHE.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  // basic size control
  if (PAGE_CACHE.size >= PAGE_CACHE_MAX) {
    const oldestKey = PAGE_CACHE.keys().next().value;
    if (oldestKey) PAGE_CACHE.delete(oldestKey);
  }
  PAGE_CACHE.set(key, { ts: Date.now(), value });
}

// ======================================================
// Scraping (single path) — FAST + CACHED
// ======================================================
async function scrapePage(url) {
  // ✅ cache hit = instant
  const cached = cacheGet(url);
  if (cached) return cached;

  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    },
    12000 // ✅ faster timeout (was 20000)
  );

  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") || "";

  // FAST TEXT EXTRACTION (no full DOM walk)
  const bodyText = cleanText($("body").text() || "");
  const visibleText = bodyText.slice(0, 3500);

  const out = { title, metaDesc, visibleText, html, $ };

  // ✅ save cache
  cacheSet(url, out);

  return out;
}


function scrapeVehiclePhotosFromCheerio($, baseUrl) {
  const urls = new Set();

  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const MAX_URLS = 350; // hard safety cap

  const addUrl = (raw) => {
    if (!raw) return;
    if (urls.size >= MAX_URLS) return;

    const s = String(raw).trim();
    if (!s) return;

    try {
      const cleaned = s.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
      const abs = new URL(cleaned, base).href;
      urls.add(abs);
    } catch {
      // ignore invalid urls
    }
  };

  $("img").each((_, el) => {
    addUrl($(el).attr("src"));
    addUrl($(el).attr("data-src"));
    addUrl($(el).attr("data-lazy"));
    addUrl($(el).attr("data-original"));
  });

  $("source").each((_, el) => {
    addUrl($(el).attr("srcset"));
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const match = style.match(/url\(([^)]+)\)/i);
    if (match) addUrl(match[1]);
  });

  return Array.from(urls);
}

// ======================================================
// AI: Photo Processing (gpt-image-1)
// ======================================================
async function processSinglePhoto(_photoUrl, vehicleLabel = "") {
  const prompt = `
Ultra-realistic, cinematic dealership marketing photo of THIS car,
isolated on a dramatic but clean showroom-style background.
Soft reflections, high dynamic range, subtle vignette, sharp detail,
movie-quality lighting. No people, no text, no dealer logos or watermarks.
Vehicle context (optional): ${vehicleLabel || "n/a"}
  `.trim();

  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    n: 1,
  });

  const base64 = result.data?.[0]?.b64_json;
  if (!base64) throw new Error("AI image model returned no data");

  return `data:image/png;base64,${base64}`;
}

async function processPhotoBatch(photoUrls, vehicleLabel = "") {
  const results = [];
  for (const url of photoUrls || []) {
    if (!url) continue;
    try {
      const processedUrl = await processSinglePhoto(url, vehicleLabel);
      results.push({ originalUrl: url, processedUrl });
    } catch (err) {
      console.error("Photo processing failed:", url, err);
      results.push({ originalUrl: url, processedUrl: url });
    }
  }
  return results;
}

// ======================================================
// AI: Social Kit Builder
// ======================================================
async function buildSocialKit({ pageInfo, labelOverride, priceOverride, photos, pageUrl, description }) {
  const hasKey = !!process.env.OPENAI_API_KEY;

  const titleGuess = cleanText(pageInfo?.title || "");
  const labelGuess = titleGuess.split("|")[0]?.trim?.() || titleGuess || "";

  const baseLabel = cleanText(labelOverride || labelGuess);
  const basePrice = cleanText(priceOverride || "");

  if (!hasKey) {
    const fallbackPosts = buildFallbackPosts({ label: baseLabel, price: basePrice, description });

    return {
      vehicleLabel: baseLabel,
      priceInfo: basePrice,
      facebook: fallbackPosts[0] || "",
      instagram: fallbackPosts[1] || "",
      tiktok: fallbackPosts[2] || "",
      linkedin: fallbackPosts[0] || "",
      twitter: fallbackPosts[1] || "",
      text: fallbackPosts[2] || "",
      marketplace: fallbackPosts[0] || "",
      hashtags: "",
      selfieScript: "",
      shotPlan: "",
      designIdea: "",
      photos: photos || [],
      sourceUrl: pageUrl || "",
      posts: fallbackPosts,
    };
  }

  const { title, metaDesc, visibleText } = pageInfo;

  const system = `
You are Lot Rocket's Social Media War Room — a viral automotive copywriter.

CRITICAL OUTPUT RULES:
- Output MUST be a single VALID JSON object.
- NO intro, NO outro, NO markdown.
- ABSOLUTELY NO URLS OR LINKS anywhere in any field.
  - Do NOT include dealership website links, social profile links, or "http".
  - Do NOT include "www.".
  - Do NOT include platform handles as links.
- Write original sales copy (captions) only.

Use these keys EXACTLY:
{
  "label":       string,
  "price":       string,

  "facebook":    string,
  "instagram":   string,
  "tiktok":      string,
  "linkedin":    string,
  "twitter":     string,
  "text":        string,
  "marketplace": string,

  "hashtags":    string,

  "selfieScript": string,
  "videoPlan":    string,
  "canvaIdea":    string
}
`.trim();

  const user = `
Dealer page data:
TITLE: ${title}
META: ${metaDesc}
TEXT SNIPPET:
${visibleText.slice(0, 3000)}

Description extracted:
${cleanText(description).slice(0, 1500)}

Optional custom label: ${labelOverride || "none"}
Optional custom price: ${priceOverride || "none"}

If overrides exist, prefer them in the copy.
Remember: OUTPUT ONLY raw JSON with the required keys, and include ZERO URLS.
`.trim();

  try {
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = getResponseText(response) || "{}";
    const parsed = safeJsonParse(raw, {}) || {};

    const vehicleLabel = cleanText(labelOverride || parsed.label || baseLabel);
    const priceInfo = cleanText(priceOverride || parsed.price || basePrice);

    const kit = {
      vehicleLabel,
      priceInfo,

      facebook: sanitizeCopy(parsed.facebook),
      instagram: sanitizeCopy(parsed.instagram),
      tiktok: sanitizeCopy(parsed.tiktok),
      linkedin: sanitizeCopy(parsed.linkedin),
      twitter: sanitizeCopy(parsed.twitter),
      text: sanitizeCopy(parsed.text),
      marketplace: sanitizeCopy(parsed.marketplace),

      hashtags: sanitizeCopy(parsed.hashtags),

      selfieScript: sanitizeCopy(parsed.selfieScript),
      shotPlan: sanitizeCopy(parsed.videoPlan),
      designIdea: sanitizeCopy(parsed.canvaIdea),

      photos: photos || [],
      sourceUrl: pageUrl || "",
    };

    kit.posts = [
      kit.facebook,
      kit.instagram,
      kit.tiktok,
      kit.linkedin,
      kit.twitter,
      kit.text,
      kit.marketplace,
      kit.hashtags ? `Hashtags:\n${kit.hashtags}` : "",
      kit.selfieScript ? `Selfie Script:\n${kit.selfieScript}` : "",
      kit.shotPlan ? `Video Plan:\n${kit.shotPlan}` : "",
      kit.designIdea ? `Design Idea:\n${kit.designIdea}` : "",
    ]
      .map(sanitizeCopy)
      .filter((s) => cleanText(s).length > 0);

    if (!kit.posts.length) {
      const fallbackPosts = buildFallbackPosts({ label: vehicleLabel, price: priceInfo, description });

      kit.posts = fallbackPosts;
      kit.facebook = fallbackPosts[0] || "";
      kit.instagram = fallbackPosts[1] || "";
      kit.tiktok = fallbackPosts[2] || "";
      kit.marketplace = fallbackPosts[0] || "";
      kit.twitter = fallbackPosts[1] || "";
      kit.text = fallbackPosts[2] || "";
      kit.linkedin = fallbackPosts[0] || "";
    }

    return kit;
  } catch (err) {
    console.error("buildSocialKit AI failure:", err);

    const fallbackPosts = buildFallbackPosts({ label: baseLabel, price: basePrice, description });

    return {
      vehicleLabel: baseLabel,
      priceInfo: basePrice,
      facebook: fallbackPosts[0] || "",
      instagram: fallbackPosts[1] || "",
      tiktok: fallbackPosts[2] || "",
      linkedin: fallbackPosts[0] || "",
      twitter: fallbackPosts[1] || "",
      text: fallbackPosts[2] || "",
      marketplace: fallbackPosts[0] || "",
      hashtags: "",
      selfieScript: "",
      shotPlan: "",
      designIdea: "",
      photos: photos || [],
      sourceUrl: pageUrl || "",
      posts: fallbackPosts,
    };
  }
}

// ======================================================
// Build Kit (shared)  ✅ NO req.body in here (no scope)
// ======================================================
async function buildKitForUrl({ pageUrl, labelOverride = "", priceOverride = "", processPhotos = true }) {
  const pageInfo = await scrapePage(pageUrl);

  const description = extractVehicleDescriptionFromHtml(pageInfo.$, pageInfo.html);

  const rawPhotos = scrapeVehiclePhotosFromCheerio(pageInfo.$, pageUrl);
  const cleaned = cleanPhotoList(rawPhotos, 300);
  const preferred = preferVehicleGalleryPhotos(cleaned);
  const finalPhotos = uniqPhotos(preferred, 300);

  const kit = await buildSocialKit({
    pageInfo,
    labelOverride,
    priceOverride,
    photos: finalPhotos,
    pageUrl,
    description,
  });

  kit.description = cleanText(description || "");
  kit.posts = Array.isArray(kit.posts) ? kit.posts : [];

  kit.posts = kit.posts.map(sanitizeCopy).filter(Boolean);

  kit.editedPhotos = processPhotos
    ? await processPhotoBatch(finalPhotos.slice(0, 24), kit.vehicleLabel || labelOverride || "")
    : [];

  kit._debugPhotos = {
    rawCount: rawPhotos.length,
    cleanedCount: cleaned.length,
    finalCount: finalPhotos.length,
    rawSample: rawPhotos.slice(0, 30),
    finalSample: finalPhotos.slice(0, 30),
  };

  return kit;
}

// ======================================================
// Routes
// ======================================================
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --------------------------------------------------
// IMAGE PROXY (Fixes CORS tainted canvas)
// Supports both:
//   /api/proxy-image?url=...
//   /api/image-proxy?url=... (back-compat)
// --------------------------------------------------
async function proxyImageHandler(req, res) {
  try {
    const target = req.query.url;
    if (!target) return res.status(400).json({ error: "Missing url parameter" });

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({ error: "Invalid protocol" });
    }

    if (isBlockedProxyTarget(target)) {
      return res.status(400).json({ error: "Blocked proxy target" });
    }

    const upstream = await fetchWithTimeout(target, {}, 20000);
    if (!upstream.ok) {
      console.error("proxy-image upstream error:", upstream.status, target);
      return res.status(502).json({ error: `Upstream error ${upstream.status}` });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(buf);
  } catch (err) {
    console.error("proxy-image error:", err);
    if (!res.headersSent) return res.status(500).json({ error: "Image proxy error" });
  }
}

app.get("/api/proxy-image", proxyImageHandler);
app.get("/api/image-proxy", proxyImageHandler);

// --------------------------------------------------
// /api/process-photos
// --------------------------------------------------
app.post("/api/process-photos", async (req, res) => {
  try {
    const { photoUrls, vehicleLabel } = req.body || {};

    if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
      return res.status(400).json({ error: "No photoUrls provided" });
    }

    const editedPhotos = await processPhotoBatch(photoUrls.slice(0, 24), vehicleLabel || "");
    return res.json({ editedPhotos });
  } catch (err) {
    return sendAIError(res, err, "Photo processing failed.");
  }
});

// --------------------------------------------------
// /api/ai-cinematic-photo
// --------------------------------------------------
app.post("/api/ai-cinematic-photo", async (req, res) => {
  try {
    const photoUrl = req.body?.photoUrl;
    const vehicleLabel = req.body?.vehicleLabel || "";

    if (!photoUrl) {
      return res.status(400).json({
        error: "missing_photo",
        message: "No photo selected for AI Cinematic Background.",
      });
    }

    const processedUrl = await processSinglePhoto(photoUrl, vehicleLabel);
    return res.json({ processedUrl, vehicleLabel });
  } catch (err) {
    return sendAIError(res, err, "Lot Rocket couldn't complete the cinematic background edit.");
  }
});

// --------------------------------------------------
// /boost (PRIMARY) + /api/boost (back-compat)
// --------------------------------------------------
async function boostHandler(req, res) {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    const labelOverride = req.body?.labelOverride || "";
    const priceOverride = req.body?.priceOverride || "";

    // ✅ ONLY HERE (NO DUPES ANYWHERE ELSE)
    const processPhotosRequested = req.body?.processPhotos !== false;
    const processPhotos = HAS_OPENAI_KEY && processPhotosRequested;

    if (!pageUrl) {
      return res.status(400).json({ error: "bad_url", message: "Invalid or missing URL." });
    }

    const kit = await buildKitForUrl({
      pageUrl,
      labelOverride,
      priceOverride,
      processPhotos,
    });

    console.log("✅ BOOST:", {
      url: pageUrl,
      photos: kit.photos?.length || 0,
      edited: kit.editedPhotos?.length || 0,
      descriptionLength: (kit.description || "").length,
      posts: Array.isArray(kit.posts) ? kit.posts.length : 0,
      processPhotos,
    });

    return res.json({
      ...kit,
      description: kit.description || "",
      posts: Array.isArray(kit.posts) ? kit.posts : [],
      socialPosts: Array.isArray(kit.posts) ? kit.posts : [],
      captions: Array.isArray(kit.posts) ? kit.posts : [],
      success: true,
    });
  } catch (err) {
    return sendAIError(res, err, "Boost failed.");
  }
}

app.post("/boost", boostHandler);
app.post("/api/boost", boostHandler);

// --------------------------------------------------
// /api/social-kit
// --------------------------------------------------
app.post("/api/social-kit", async (req, res) => {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    const labelOverride = req.body?.labelOverride || "";
    const priceOverride = req.body?.priceOverride || "";

    // ✅ ONLY HERE (NO DUPES ANYWHERE ELSE)
    const processPhotosRequested = req.body?.processPhotos !== false;
    const processPhotos = HAS_OPENAI_KEY && processPhotosRequested;

    if (!pageUrl) {
      return res.status(400).json({
        error: "bad_url",
        message: "Invalid or missing URL. Please paste a full dealer link.",
      });
    }

    const kit = await buildKitForUrl({ pageUrl, labelOverride, priceOverride, processPhotos });

    console.log("✅ /api/social-kit:", {
      url: pageUrl,
      final: kit.photos?.length || 0,
      edited: kit.editedPhotos?.length || 0,
      processPhotos,
    });

    return res.json(kit);
  } catch (err) {
    return sendAIError(res, err, "Failed to build social kit.");
  }
});

// --------------------------------------------------
// /api/social-photos-zip
// --------------------------------------------------
app.post("/api/social-photos-zip", async (req, res) => {
  try {
    const urls = Array.isArray(req.body?.urls) ? req.body.urls.filter(Boolean) : [];
    if (!urls.length) return res.status(400).json({ message: "No photo URLs provided." });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="lot-rocket-photos.zip"');

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("ZIP archive error:", err);
      if (!res.headersSent) res.status(500).end("Error creating ZIP.");
      else res.destroy(err);
    });

    archive.pipe(res);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (isBlockedProxyTarget(url)) continue;

      try {
        const resp = await fetchWithTimeout(url, {}, 20000);
        if (!resp.ok || !resp.body) {
          console.warn("Skipping bad photo URL:", url, resp.status);
          continue;
        }
        archive.append(resp.body, { name: `photo-${i + 1}.jpg` });
      } catch (err) {
        console.warn("Error fetching photo for zip:", url, err);
      }
    }

    archive.finalize();
  } catch (err) {
    console.error("social-photos-zip handler error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to build ZIP of photos." });
  }
});

// --------------------------------------------------
// /api/new-post
// --------------------------------------------------
app.post("/api/new-post", async (req, res) => {
  try {
    const platform = req.body?.platform;
    const pageUrl = normalizeUrl(req.body?.url);
    const label = req.body?.label || req.body?.labelOverride || "";
    const price = req.body?.price || req.body?.priceOverride || "";

    if (!platform || !pageUrl) {
      return res.status(400).json({ error: "Missing platform or URL for new post." });
    }

    const pageInfo = await scrapePage(pageUrl);
    const { title, metaDesc, visibleText } = pageInfo;

    const system = `
You are Lot Rocket, an elite automotive copywriter.
Return ONLY the copy for the requested platform, no labels, no JSON, no explanation.
ABSOLUTELY NO URLS OR LINKS. Do not include http, https, or www.
`.trim();

    const user = `
Dealer page:
TITLE: ${title}
META: ${metaDesc}
TEXT:
${visibleText.slice(0, 3000)}

Platform: ${platform}
Optional custom label: ${label || "none"}
Optional custom price: ${price || "none"}

Write ONE high-performing piece of content for this platform.
Include a call-to-action to DM or message the salesperson.
No links.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = sanitizeCopy((getResponseText(completion) || "").trim());
    return res.json({ text: text || "No post returned. Try again." });
  } catch (err) {
    return sendAIError(res, err, "Failed to regenerate post.");
  }
});

// --------------------------------------------------
// /api/new-script
// --------------------------------------------------
app.post("/api/new-script", async (req, res) => {
  try {
    const { kind, url, vehicle, hook, style, length } = req.body || {};

    let system = "";
    let user = "";

    if (kind === "selfie") {
      const pageUrl = normalizeUrl(url);
      if (!pageUrl) {
        return res.status(400).json({ error: "Invalid or missing URL for selfie script." });
      }

      const pageInfo = await scrapePage(pageUrl);
      const { title, metaDesc, visibleText } = pageInfo;

      system = `
You are Lot Rocket, an expert vertical video script writer.
Write natural, spoken, short-form video scripts.
NO links. No markdown. Plain text only.
`.trim();

      user = `
Dealer page:
TITLE: ${title}
META: ${metaDesc}
TEXT:
${visibleText.slice(0, 2500)}

Write a 30–60 second selfie-style video script.
Friendly, confident, sales-focused.
End with a soft call to action.
`.trim();
    } else {
      system = `
You are Lot Rocket, an expert short-form video copywriter.
Return ONLY clean spoken dialogue.
No links. No markdown.
`.trim();

      user = `
Vehicle: ${vehicle || "Not specified"}
Hook: ${hook || "Catch attention fast"}
Style: ${style || "confident, friendly"}
Length: ~${length || 30} seconds

Write a natural spoken script suitable for Reels/TikTok.
`.trim();
    }

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const script =
      (getResponseText(completion) || "").trim() ||
      "No script returned. Please try again.";

    return res.json({ script });
  } catch (err) {
    console.error("❌ Script generation error:", err);
    return res.status(500).json({ error: "Failed to generate script." });
  }
});



// --------------------------------------------------
// /api/video-from-photos
// --------------------------------------------------
app.post("/api/video-from-photos", async (req, res) => {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    if (!pageUrl) return res.status(400).json({ error: "Invalid or missing URL" });

    const pageInfo = await scrapePage(pageUrl);

    const rawPhotos = scrapeVehiclePhotosFromCheerio(pageInfo.$, pageUrl);
    const cleaned = cleanPhotoList(rawPhotos, 300);
    const finalPhotos = preferVehicleGalleryPhotos(cleaned);

    const system = `
You are Lot Rocket, a video director for car salespeople.
You design shot lists / storyboards for short vertical videos.
Return plain text with bullet points or numbered steps.
NO LINKS.
`.trim();

    const user = `
Dealer page title: ${pageInfo.title}
Meta: ${pageInfo.metaDesc}

You have ${finalPhotos.length} exterior/interior still photos.
Create a shot plan for a 30–45 second vertical video that uses these photos
with text overlays and pacing notes.
No links.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const plan = sanitizeCopy((getResponseText(completion) || "").trim());
    return res.json({ plan: plan || "No plan returned. Try again." });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate shot plan.");
  }
});

// --------------------------------------------------
// /api/design-idea
// --------------------------------------------------
app.post("/api/design-idea", async (req, res) => {
  try {
    const { type, creativeType, headline, cta, vibe, label } = req.body || {};

    const system = `
You are Lot Rocket, a senior marketing designer.
You output clear bullet-point layout blueprints for Canva or similar tools.
Return plain text.
NO LINKS.
`.trim();

    const user = `
Creative type: ${creativeType || type || "story / feed post"}
Vehicle / headline context: ${label || headline || "(you decide it's strong)"}
CTA: ${cta || "(you decide a strong one)"}
Brand vibe: ${vibe || "bold, trustworthy, premium"}

Describe:
- Overall layout (top / middle / bottom)
- Where the vehicle photo(s) should go
- Where headline & CTA sit
- Any supporting text or badges
- Suggested color / style notes
No links.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const idea = sanitizeCopy((getResponseText(completion) || "").trim());
    return res.json({ idea: idea || "No idea returned. Try again." });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate design idea.");
  }
});

// --------------------------------------------------
// /api/objection-coach
// --------------------------------------------------
app.post("/api/objection-coach", async (req, res) => {
  try {
    const { objection, history } = req.body || {};

    const system = `
You are Lot Rocket's Grandmaster Objection Coach for car sales professionals.

For each objection, respond with four parts:
1) Diagnosis
2) Emotional Pivot (1–2 validation lines)
3) Kill Shot Response (ethical rebuttal)
4) Teacher’s Breakdown (tone, pauses, word choice)

Formatting:
- Clearly label each section.
- Tight and practical.
`.trim();

    const user = `
Conversation history (if any):
${history || "(none)"}

New customer objection:
${objection || "(none provided)"}

Write a suggested response the salesperson can send, plus 1–2 coaching tips in [brackets] at the end.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const answer = (getResponseText(completion) || "").trim();
    return res.json({ answer });
  } catch (err) {
    return sendAIError(res, err, "Failed to coach objection.");
  }
});

// --------------------------------------------------
// /api/payment-helper
// --------------------------------------------------
app.post("/api/payment-helper", (req, res) => {
  try {
    const price = Number(req.body.price || 0);
    const down = Number(req.body.down || 0);
    const trade = Number(req.body.trade || 0);
    const payoff = Number(req.body.payoff || 0);
    const aprPct = Number(req.body.rate || 0);
    const term = Number(req.body.term || 0);
    const taxPct = Number(req.body.tax || 0);
    const fees = Number(req.body.fees || 0);
    const rebate = Number(req.body.rebate || 0);
    const state = String(req.body.state || "MI").trim().toUpperCase();

    if (!price || !term) {
      return res.status(400).json({
        error: "missing_inputs",
        message: "Price and term (in months) are required for payment.",
      });
    }

    const STATE_RULES = {
      MI: { taxTradeCredit: true, taxFees: true, rebateReducesTaxable: false },
      OH: { taxTradeCredit: true, taxFees: true, rebateReducesTaxable: false },
      IN: { taxTradeCredit: true, taxFees: true, rebateReducesTaxable: false },
      IL: { taxTradeCredit: true, taxFees: true, rebateReducesTaxable: false },
      PA: { taxTradeCredit: true, taxFees: true, rebateReducesTaxable: false },
      NY: { taxTradeCredit: true, taxFees: true, rebateReducesTaxable: false },
      NJ: { taxTradeCredit: true, taxFees: true, rebateReducesTaxable: false },
      FL: { taxTradeCredit: true, taxFees: true, rebateReducesTaxable: false },
      TX: { taxTradeCredit: true, taxFees: true, rebateReducesTaxable: false },
      CA: { taxTradeCredit: true, taxFees: true, rebateReducesTaxable: false },
    };

    const rules = STATE_RULES[state] || STATE_RULES.MI;

    const taxTradeCredit =
      typeof req.body.taxTradeCredit === "boolean" ? req.body.taxTradeCredit : rules.taxTradeCredit;
    const taxFees = typeof req.body.taxFees === "boolean" ? req.body.taxFees : rules.taxFees;
    const rebateReducesTaxable =
      typeof req.body.rebateReducesTaxable === "boolean"
        ? req.body.rebateReducesTaxable
        : rules.rebateReducesTaxable;

    const tradeEquity = trade - payoff;
    const negativeEquity = Math.max(payoff - trade, 0);

    const feesTaxable = taxFees ? fees : 0;
    const tradeTaxCredit = taxTradeCredit ? trade : 0;
    const rebateTaxableReduction = rebateReducesTaxable ? rebate : 0;

    const taxableBase = Math.max(price + feesTaxable - tradeTaxCredit - rebateTaxableReduction, 0);
    const taxRate = taxPct / 100;
    const taxAmount = taxableBase * taxRate;

    const amountFinanced = Math.max(price + fees + taxAmount - down - trade + payoff - rebate, 0);

    const monthlyRate = aprPct / 100 / 12;

    let payment;
    if (!monthlyRate) payment = amountFinanced / term;
    else {
      payment =
        (amountFinanced * monthlyRate * Math.pow(1 + monthlyRate, term)) /
        (Math.pow(1 + monthlyRate, term) - 1);
    }

    const money = (n) =>
      `$${Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    const equityLine = tradeEquity >= 0 ? `+${money(tradeEquity)}` : `${money(tradeEquity)}`;

    const breakdown = {
      state,
      price,
      fees,
      taxableBase,
      taxRate: taxPct,
      taxAmount,
      down,
      trade,
      payoff,
      tradeEquity,
      negativeEquity,
      rebate,
      amountFinanced,
      aprPct,
      term,
      assumptions: { taxTradeCredit, taxFees, rebateReducesTaxable },
    };

    const breakdownText = [
      `~${money(payment)}/mo (estimate — not a binding quote).`,
      "",
      "Breakdown:",
      `• State: ${state}`,
      `• Price: ${money(price)}`,
      `• Dealer Fees/Add-ons: ${money(fees)}`,
      `• Taxable Base: ${money(taxableBase)}`,
      `• Tax (${taxPct.toFixed(2)}%): ${money(taxAmount)}`,
      `• Rebate: ${money(rebate)}`,
      `• Down: ${money(down)}`,
      `• Trade: ${money(trade)} | Payoff: ${money(payoff)}`,
      `• Trade Equity: ${equityLine} (${tradeEquity >= 0 ? "positive equity" : "negative equity"})`,
      `• Amount Financed: ${money(amountFinanced)}`,
      `• APR: ${aprPct.toFixed(2)}% | Term: ${term} months`,
      "",
      "Assumptions:",
      `• Trade-in credit ${taxTradeCredit ? "DOES" : "does NOT"} reduce taxable base`,
      `• Dealer fees/add-ons ${taxFees ? "ARE" : "are NOT"} taxable`,
      `• Rebates ${rebateReducesTaxable ? "DO" : "do NOT"} reduce taxable base`,
      `• Sales tax calculated before down payment`,
      `• Estimate only — dealer & state rules may vary`,
    ].join("\n");

    return res.json({
      result: `~${money(payment)} per month (rough estimate only, not a binding quote).`,
      breakdown,
      breakdownText,
    });
  } catch (err) {
    console.error("payment-helper error", err);
    return res.status(500).json({ error: "Failed to estimate payment" });
  }
});

// --------------------------------------------------
// /api/income-helper
// --------------------------------------------------
app.post("/api/income-helper", (req, res) => {
  try {
    const grossToDate = Number(req.body.mtd || req.body.monthToDate || req.body.grossToDate || 0);
    const lastPayDateStr =
      req.body.lastPayDate || req.body.lastCheck || req.body.lastPaycheckDate || req.body.date;

    if (!grossToDate || !lastPayDateStr) {
      return res.status(400).json({
        error: "income_inputs",
        message: "Month-to-date / year-to-date income and last paycheck date are required.",
      });
    }

    const lastPayDate = new Date(lastPayDateStr);
    if (Number.isNaN(lastPayDate.getTime())) {
      return res.status(400).json({
        error: "bad_date",
        message: "Could not read the last paycheck date.",
      });
    }

    const year = lastPayDate.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysIntoYear = Math.floor((lastPayDate - startOfYear) / msPerDay) + 1;
    const weeksIntoYear = daysIntoYear / 7;

    if (weeksIntoYear <= 0) {
      return res.status(400).json({
        error: "date_range",
        message: "Last paycheck date must be after Jan 1.",
      });
    }

    const estimatedYearly = (grossToDate / weeksIntoYear) * 52;
    const estimatedMonthly = estimatedYearly / 12;

    const formatMoney = (n) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    const result = `Estimated Yearly Gross: ${formatMoney(
      estimatedYearly
    )} | Weeks into Year: ${weeksIntoYear.toFixed(1)} | Estimated Average Monthly Income: ${formatMoney(
      estimatedMonthly
    )}`;

    return res.json({ result });
  } catch (err) {
    console.error("income-helper error", err);
    return res.status(500).json({ error: "Failed to estimate income" });
  }
});

// --------------------------------------------------
// /ai/workflow
// --------------------------------------------------
app.post("/ai/workflow", async (req, res) => {
  try {
    const { goal, tone, channel, days, touches } = req.body || {};

    const workflowPrompt = `
You are Lot Rocket's Lead Resurrection Specialist & Automotive Behavioral Psychologist.

Rules:
1) Never say "just checking in".
2) Keep SMS/DMs under 3 short lines. End with a question.
3) Human, not robotic.

Inputs:
- Primary Goal: ${goal || "Set the Appointment"}
- Desired Tone: ${tone || "Persuasive, Low-Pressure, High-Value"}
- Primary Channel: ${channel || "Multi-Channel (SMS, Video, Call, Social)"}
- Duration: ${days || 10} days
- Total Touches: ${touches || 6}

Output (Markdown):
1. Strategy Overview: 2–3 sentences.
2. The Workflow: Touch 1, Touch 2...
For each touch:
- Day [X] - [Time of Day]
- Channel:
- Psychology:
- Script/Action:
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: workflowPrompt,
    });

    const text = (getResponseText(completion) || "").trim() || "No workflow returned. Try again.";
    return res.json({ text });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate workflow.");
  }
});

// --------------------------------------------------
// /api/message-helper
// --------------------------------------------------
app.post("/api/message-helper", async (req, res) => {
  try {
    const body = req.body || {};
    const { mode, ...fields } = body;

    if (!mode) return res.status(400).json({ message: "Missing mode in request body." });

    const rawContext = Object.entries(fields)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    let systemPrompt = "";
    let userPrompt = "";

    switch (mode) {
      case "video-brief": {
        const hookStyle = fields.hookStyle || "pattern-interrupt";
        const length = fields.length || "30";
        const describe = fields.prompt || "";
        const context = fields.context || "";
        const tone = fields.tone || "";
        const platform = fields.platform || "TikTok / Reels";

        systemPrompt = `
You are Lot Rocket's AI Video Director.
Return ONLY valid JSON (no markdown, no extra text) with these keys:
{
  "script": string,
  "shotList": string,
  "aiPrompt": string,
  "thumbPrompt": string
}
No links.
`.trim();

        userPrompt = `
Platform: ${platform}
Hook style: ${hookStyle}
Target length (seconds): ${length}
Tone: ${tone || "confident, trustworthy, sales pro"}
Video description:
"${describe || "Walkaround of a car"}"

Vehicle/offer context:
${context || "(none)"}

Write:
- script: spoken lines (short + punchy)
- shotList: numbered timeline beats
- aiPrompt: for Pika/Runway/Luma (camera, lighting, vibe)
- thumbPrompt: cinematic thumbnail idea
No links.
`.trim();
        break;
      }

      case "workflow":
        systemPrompt = `You are Lot Rocket's AI Workflow Expert. Be concise, direct, action-focused for car sales pros.`.trim();
        userPrompt = fields.prompt || rawContext || "Help me with my sales workflow.";
        break;

      case "message":
        systemPrompt = `You are Lot Rocket's AI Message Builder. Write high-converting, friendly, conversational messages for car shoppers.`.trim();
        userPrompt = fields.prompt || rawContext || "Write a follow-up message to a car lead.";
        break;

      case "ask":
        systemPrompt = `You are Lot Rocket's general AI assistant for car salespeople. Answer clearly and practically with a focus on selling more cars.`.trim();
        userPrompt = fields.prompt || rawContext || "Answer this question for a car salesperson.";
        break;

      case "car":
        systemPrompt = `You are The Master Automotive Analyst. Be technical, precise, blunt, and confident.`.trim();
        userPrompt = fields.prompt || rawContext || "Explain this vehicle to a customer.";
        break;

      case "image-brief":
        systemPrompt = `You are Lot Rocket's AI Image Brief generator. Return ONLY the prompt text. No links.`.trim();
        userPrompt = fields.prompt || rawContext || "Generate an image brief for a dealership post.";
        break;

      default:
        systemPrompt = `You are Lot Rocket's AI assistant for car dealers.`.trim();
        userPrompt = fields.prompt || rawContext || "Help me with sales & marketing.";
        break;
    }

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text =
      (getResponseText(completion) || "").trim() ||
      "Lot Rocket could not generate a response. Please try again.";

    if (mode === "video-brief") {
      const parsed = safeJsonParse(text, null);
      if (parsed && typeof parsed === "object") {
        return res.json({
          text,
          script: sanitizeCopy(parsed.script || ""),
          shotList: sanitizeCopy(parsed.shotList || ""),
          aiPrompt: sanitizeCopy(parsed.aiPrompt || ""),
          thumbPrompt: sanitizeCopy(parsed.thumbPrompt || ""),
        });
      }
    }

    return res.json({ text: sanitizeCopy(text) || text });
  } catch (err) {
    return sendAIError(res, err, "Lot Rocket hit an error talking to AI.");
  }
});

// ======================================================
// Start Server
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
