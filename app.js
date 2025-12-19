/**
 * app.js — Lot Rocket Backend (CLEAN / DEDUPED / CONSISTENT)
 * Version: 2.6-clean
 *
 * What this file does:
 * - Scrapes dealer page (title/meta/text) + pulls up to 24 non-logo images
 * - Generates social kit copy (multi-platform JSON)
 * - Generates/edits photos via gpt-image-1 (returns data URLs)
 * - Provides regen endpoints (single platform post, scripts, shot plans, design ideas)
 * - Provides tool endpoints (objection coach, payment calc, income calc, workflow, message helper)
 * - Provides CORS-safe image proxy for canvas/konva/fabric loading
 * - Provides ZIP download for photos
 *
 * Cleanup goals:
 * - Single naming conventions
 * - No duplicate endpoints / logic paths
 * - One OpenAI text call style (Responses API) everywhere
 * - Shared error handling
 */

require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const fetch = require("node-fetch");
const archiver = require("archiver");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.use(cors());
app.use(express.json());



// API routes BELOW this
// app.post("/scrape", ...)
// app.post("/generate", ...)



// -------------------- OpenAI Client --------------------
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -------------------- Middleware --------------------
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ======================================================
// Helpers (single source of truth)
// ======================================================

/** Normalize user input into an absolute http(s) URL; return null if invalid. */
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

/** Fetch with timeout (prevents hanging requests) */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** Best-effort JSON parse */
function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/** Extract text from OpenAI Responses API result */
function getResponseText(response) {
  // safest: walk the first output block
  return response?.output?.[0]?.content?.[0]?.text || "";
}

/** Rate-limit / quota detection for nicer error responses */
function isRateLimitError(err) {
  const msg =
    (err && (err.message || err.error?.message || ""))?.toLowerCase() || "";

  if (msg.includes("rate limit")) return true;
  if (msg.includes("quota") || msg.includes("billing")) return true;
  if (msg.includes("insufficient") && msg.includes("quota")) return true;

  if (err && err.code === "rate_limit_exceeded") return true;
  if (err && err.error && err.error.type === "rate_limit_exceeded") return true;
  if (err && err.status === 429) return true;
  if (err && err.response && err.response.status === 429) return true;

  return false;
}

function sendAIError(res, err, friendlyMessage) {
  console.error("🔴 AI error:", friendlyMessage, err);

  const rawMsg =
    (err && (err.message || err.error?.message || "")) || "Unknown error";

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

/** Basic SSRF guard for proxying images (blocks local/private ranges) */
function isBlockedProxyTarget(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname?.toLowerCase() || "";

    // obvious localhost names
    if (host === "localhost" || host.endsWith(".localhost")) return true;

    // IPv4 checks (simple prefix blocks)
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      if (host.startsWith("127.")) return true;
      if (host.startsWith("10.")) return true;
      if (host.startsWith("192.168.")) return true;
      if (host.startsWith("169.254.")) return true; // link-local

      // 172.16.0.0–172.31.255.255
      const parts = host.split(".").map((n) => Number(n));
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    }

    return false;
  } catch {
    return true;
  }
}
// BOOST LISTING (Step 1)
// POST /api/boost
// body: { url, labelOverride, priceOverride, maxPhotos }
// returns: { title, price, photos: [] }

app.post("/api/boost", async (req, res) => {
  try {
    const { url, labelOverride, priceOverride, maxPhotos } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing url" });

const scraped = await scrapePage(url); // static HTML scrape first

const safeMax = Math.max(1, Math.min(Number(maxPhotos) || 24, 24));

const title = (labelOverride || scraped?.title || scraped?.vehicleTitle || "").trim();
const price = (priceOverride || scraped?.price || scraped?.vehiclePrice || "").trim();

let photos = Array.isArray(scraped?.photos) ? scraped.photos : [];

// 🔁 FALLBACK: if gallery is JS-loaded, re-scrape with rendered DOM
if (photos.length < 10) {
  console.log("⚠️ Low photo count from static HTML. Trying rendered scrape…", photos.length);
  const renderedHtml = await scrapePageRendered(url);
  photos = extractImageUrlsFromHtml(renderedHtml, url);
}

// Final cap (frontend already dedupes)
photos = photos.slice(0, safeMax);

console.log("✅ BOOST FINAL PHOTOS:", photos.length);

return res.json({ title, price, photos });


function absUrl(base, maybeUrl) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl).trim().replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
  if (!u || u === "#" || u.startsWith("data:")) return null;
  try {
    return new URL(u, base).toString();
  } catch {
    return null;
  }
}

function parseSrcset(srcset) {
  if (!srcset) return [];
  // "url1 640w, url2 1024w" => [url1, url2]
  return String(srcset)
    .split(",")
    .map(s => s.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function extractImageUrlsFromHtml(html, baseUrl) {
  const cheerio = require("cheerio");
  const $ = cheerio.load(html);

  const candidates = [];

  // helper: push urls (absolute)
  const push = (u) => {
    const a = absUrl(baseUrl, u);
    if (a) candidates.push(a);
  };

  // 0) meta + link hints
  push($("meta[property='og:image']").attr("content"));
  push($("meta[name='twitter:image']").attr("content"));
  push($("link[rel='image_src']").attr("href"));

  // 1) IMG tags (src + common lazy attrs + srcset + extra attrs)
  $("img").each((_, el) => {
    const $img = $(el);

    const src = $img.attr("src");
    const dataSrc =
      $img.attr("data-src") ||
      $img.attr("data-lazy") ||
      $img.attr("data-original") ||
      $img.attr("data-url") ||
      $img.attr("data-image") ||
      $img.attr("data-full") ||
      $img.attr("data-large") ||
      $img.attr("data-zoom-image");

    const srcset = $img.attr("srcset") || $img.attr("data-srcset");

    [src, dataSrc, ...parseSrcset(srcset)].forEach(push);
  });

  // 1b) <noscript> images (some sites hide full galleries here)
  $("noscript").each((_, el) => {
    const inner = $(el).html();
    if (!inner) return;
    const $$ = cheerio.load(inner);
    $$("img").each((_, img) => {
      push($$(img).attr("src"));
      push($$(img).attr("data-src"));
      push($$(img).attr("data-lazy"));
      const ss = $$(img).attr("srcset");
      if (ss) parseSrcset(ss).forEach(push);
    });
  });

  // 2) <picture><source srcset> (very common for galleries)
  $("picture source").each((_, el) => {
    const ss = $(el).attr("srcset");
    if (ss) parseSrcset(ss).forEach(push);
  });

  // 3) Inline style background-image
  $("[style]").each((_, el) => {
    const style = String($(el).attr("style") || "");
    const inner = style.match(/url\(([^)]+)\)/gi);
    if (inner) {
      inner.forEach((m) => {
        const mm = m.match(/url\(([^)]+)\)/i);
        if (mm && mm[1]) push(mm[1]);
      });
    }
  });

  // 4) LD+JSON (often has full image arrays)
  $("script[type='application/ld+json']").each((_, el) => {
    const txt = $(el).html();
    if (!txt) return;
    try {
      const json = JSON.parse(txt.trim());
      const walk = (node) => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node === "object") {
          // common keys
          if (node.image) walk(node.image);
          if (node.images) walk(node.images);
          if (node.photo) walk(node.photo);
          if (node.photos) walk(node.photos);

          // actual url strings
          for (const [k, v] of Object.entries(node)) {
            if (typeof v === "string" && /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(v)) push(v);
            else walk(v);
          }
        }
        if (typeof node === "string" && /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(node)) push(node);
      };
      walk(json);
    } catch {
      // ignore
    }
  });

  // 5) Script blobs (grab obvious urls, including escaped \"...\")
  $("script").each((_, el) => {
    const txt = $(el).html();
    if (!txt) return;

    // absolute
    const foundAbs = txt.match(/https?:\/\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(\?[^"'\\\s]*)?/gi);
    if (foundAbs) foundAbs.forEach((u) => candidates.push(u));

    // escaped JSON "url":"\/path\/img.jpg"
    const foundEsc = txt.match(/\\\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\\\?[^"'\\\s]*)?/gi);
    if (foundEsc) foundEsc.forEach((u) => {
      const unescaped = u.replace(/\\\//g, "/").replace(/\\\?/g, "?");
      push(unescaped);
    });

    // relative
    const foundRel = txt.match(/\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(\?[^"'\\\s]*)?/gi);
    if (foundRel) foundRel.forEach(push);
  });

  // Cleanup + filter + dedupe (keep interiors; only remove obvious junk)
  const cleaned = candidates
    .map((u) => String(u || "").trim())
    .filter(Boolean)
    .filter((u) => /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(u))
    .filter((u) => !/sprite|icon|placeholder|spacer|pixel|1x1/i.test(u));

  return Array.from(new Set(cleaned));
}


  // 3) Script blobs: grab obvious .jpg/.png/.webp urls that appear inside JSON
  $("script").each((_, el) => {
    const txt = $(el).html();
    if (!txt) return;

    const found = txt.match(/https?:\/\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(\?[^"'\\\s]*)?/gi);
    if (found) found.forEach((u) => candidates.push(u));

    // Sometimes relative URLs show up in JSON
    const rel = txt.match(/\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(\?[^"'\\\s]*)?/gi);
    if (rel) rel.forEach((u) => {
      const a = absUrl(baseUrl, u);
      if (a) candidates.push(a);
    });
  });

// Cleanup + filter + dedupe (single FINAL return — keep only this once)
const cleaned = candidates
  .map((u) => String(u || "").trim())
  .filter(Boolean)
  .filter((u) => /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(u))
  .filter((u) => !/logo|sprite|icon|placeholder|spacer|pixel|1x1/i.test(u));

return Array.from(new Set(cleaned));
}


// ======================================================
// Scraping (static HTML path)
// ======================================================
async function scrapePage(url) {
  const res = await fetchWithTimeout(url, {}, 20000);

  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status}`);
  }

  const html = await res.text();
  const cheerio = require("cheerio");
  const $ = cheerio.load(html);

  // -----------------------------
  // Title
  // -----------------------------
  const title = (
    $("meta[property='og:title']").attr("content") ||
    $("meta[name='twitter:title']").attr("content") ||
    $("title").text() ||
    ""
  ).trim();

  // -----------------------------
  // Price (best-effort)
  // -----------------------------
  const price = (
    $("meta[property='product:price:amount']").attr("content") ||
    $("meta[property='og:price:amount']").attr("content") ||
    $("meta[itemprop='price']").attr("content") ||
    ""
  ).trim();

  // -----------------------------
  // Photos (static HTML scrape)
  // -----------------------------
  const photos = extractImageUrlsFromHtml(html, url).slice(0, 24);

  // -----------------------------
  // Debug (TEMP — remove later)
  // -----------------------------
  console.log("SCRAPE DEBUG:", {
    url,
    titleLength: title.length,
    price,
    photosFound: photos.length,
    sample: photos.slice(0, 5),
  });

  return { title, price, photos };
}


// ======================================================
// AI: Photo Processing (gpt-image-1)
// ======================================================


async function processSinglePhoto(photoUrl, vehicleLabel = "") {
  const prompt = `
Ultra-realistic, cinematic dealership marketing photo of THIS car,
isolated on a dramatic but clean showroom-style background.
Soft reflections, high dynamic range, subtle vignette, sharp detail,
movie-quality lighting. No people, no text, no dealer logos or watermarks.
Vehicle context (optional): ${vehicleLabel || "n/a"}
  `.trim();

  console.log("[LotRocket] gpt-image-1 processing:", photoUrl);

  // NOTE: gpt-image-1 here does NOT “use” the URL; it creates a new image from prompt.
  // If later you want true editing/inpainting, we’ll switch to image edit endpoints with an input image.
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

/** Process many photos safely (keeps original if AI fails) */
async function processPhotoBatch(photoUrls, vehicleLabel = "") {
  const results = [];
  for (const url of photoUrls) {
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

async function buildSocialKit({ pageInfo, labelOverride, priceOverride, photos }) {
  const { title, metaDesc, visibleText } = pageInfo;

  const system = `
You are Lot Rocket's Social Media War Room, powered by the mind of a Master Automotive Behavioralist and Viral Copywriter.

CRITICAL OUTPUT RULES:
- Output MUST be a single VALID JSON object.
- NO intro text, NO outro text, NO markdown formatting.
- Use these keys EXACTLY:

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

Optional custom label: ${labelOverride || "none"}
Optional custom price: ${priceOverride || "none"}

If label/price overrides are provided, prefer those in the copy.
Remember: OUTPUT ONLY raw JSON with the required keys. No explanations.
`.trim();

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = getResponseText(response) || "{}";
  const parsed = safeJsonParse(raw, {}) || {};

  return {
    vehicleLabel: labelOverride || parsed.label || "",
    priceInfo: priceOverride || parsed.price || "",

    facebook: parsed.facebook || "",
    instagram: parsed.instagram || "",
    tiktok: parsed.tiktok || "",
    linkedin: parsed.linkedin || "",
    twitter: parsed.twitter || "",
    text: parsed.text || "",
    marketplace: parsed.marketplace || "",

    hashtags: parsed.hashtags || "",

    selfieScript: parsed.selfieScript || "",
    shotPlan: parsed.videoPlan || "",
    designIdea: parsed.canvaIdea || "",

    photos: photos || [],
  };
}

// ======================================================
// Routes
// ======================================================

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --------------------------------------------------
// IMAGE PROXY (Fixes CORS tainted canvas)
// Supports both:
//   /api/proxy-image?url=...
//   /api/image-proxy?url=...   (back-compat)
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

    if (!upstream.body) return res.status(502).json({ error: "Upstream has no body" });

    upstream.body.pipe(res);
  } catch (err) {
    console.error("proxy-image error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Image proxy error" });
  }
}

app.get("/api/proxy-image", proxyImageHandler);
app.get("/api/image-proxy", proxyImageHandler); // back-compat

// --------------------------------------------------
// /api/process-photos (batch enhance)
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
    console.error("❌ /api/process-photos error:", err);
    return sendAIError(res, err, "Photo processing failed.");
  }
});

// --------------------------------------------------
// /api/ai-cinematic-photo (single enhance)
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
// /api/social-kit (scrape + kit + optional photo pipeline)
// NOTE: by default we keep existing behavior: it DOES process photos.
// You can disable by sending { processPhotos: false }.
// --------------------------------------------------
app.post("/api/social-kit", async (req, res) => {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    const labelOverride = req.body?.labelOverride || "";
    const priceOverride = req.body?.priceOverride || "";
    const processPhotos = req.body?.processPhotos !== false; // default true

    if (!pageUrl) {
      return res.status(400).json({
        error: "bad_url",
        message: "Invalid or missing URL. Please paste a full dealer link.",
      });
    }

    const pageInfo = await scrapePage(pageUrl);
    const photos = scrapeVehiclePhotosFromCheerio(pageInfo.$, pageUrl);

    const kit = await buildSocialKit({
      pageInfo,
      labelOverride,
      priceOverride,
      photos,
    });

    // Photo pipeline (expensive) — controlled by processPhotos
    kit.editedPhotos = processPhotos ? await processPhotoBatch(photos, kit.vehicleLabel) : [];

    return res.json(kit);
  } catch (err) {
    return sendAIError(res, err, "Failed to build social kit.");
  }
});

// --------------------------------------------------
// /api/social-photos-zip (download URLs as zip)
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
// /api/new-post (regen single platform copy)
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
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = (getResponseText(completion) || "").trim();
    return res.json({ text });
  } catch (err) {
    return sendAIError(res, err, "Failed to regenerate post.");
  }
});

// --------------------------------------------------
// /api/new-script (selfie script OR generic script idea)
// --------------------------------------------------
app.post("/api/new-script", async (req, res) => {
  try {
    const { kind, url, vehicle, hook, style, length } = req.body || {};

    let system;
    let user;

    if (kind === "selfie") {
      const pageUrl = normalizeUrl(url);
      if (!pageUrl) {
        return res.status(400).json({ error: "Invalid or missing URL for selfie script." });
      }

      const pageInfo = await scrapePage(pageUrl);
      const { title, metaDesc, visibleText } = pageInfo;

      system = `
You are Lot Rocket, an expert vertical video script writer for car salespeople.
Write natural sounding, selfie-style walkaround scripts.
Return plain text only.
`.trim();

      user = `
Dealer page:
TITLE: ${title}
META: ${metaDesc}
TEXT:
${visibleText.slice(0, 2500)}

Write a 30–60 second selfie video script the salesperson can record.
Use short, spoken lines and a clear CTA to DM or message.
`.trim();
    } else {
      system = `
You are Lot Rocket, an expert short-form car video script writer.
Write scripts that feel natural for Reels / TikTok / Shorts.
Return plain text only.
`.trim();

      user = `
Vehicle / Offer: ${vehicle || "(not specified)"}
Hook (optional): ${hook || "none"}
Style: ${style || "hype"}
Length: about ${length || 30} seconds

Write:
- A grabber hook
- 3–6 short bullet points (spoken lines)
- A closing CTA inviting viewers to DM or message the salesperson
`.trim();
    }

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const script = (getResponseText(completion) || "").trim();
    return res.json({ script });
  } catch (err) {
    return sendAIError(res, err, "Failed to create script.");
  }
});

// --------------------------------------------------
// /api/video-from-photos (shot plan)
// --------------------------------------------------
app.post("/api/video-from-photos", async (req, res) => {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    if (!pageUrl) return res.status(400).json({ error: "Invalid or missing URL" });

    const pageInfo = await scrapePage(pageUrl);
    const photos = scrapeVehiclePhotosFromCheerio(pageInfo.$, pageUrl);

    const system = `
You are Lot Rocket, a video director for car salespeople.
You design shot lists / storyboards for short vertical videos.
Return plain text with bullet points or numbered steps.
`.trim();

    const user = `
Dealer page title: ${pageInfo.title}
Meta: ${pageInfo.metaDesc}

You have ${photos.length} exterior/interior still photos.
Create a shot plan for a 30–45 second vertical video that uses these photos
with text overlays and pacing notes.
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const plan = (getResponseText(completion) || "").trim();
    return res.json({ plan });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate shot plan.");
  }
});

// --------------------------------------------------
// /api/design-idea (Canva layout idea)
// --------------------------------------------------
app.post("/api/design-idea", async (req, res) => {
  try {
    const { type, creativeType, headline, cta, vibe, label } = req.body || {};

    const system = `
You are Lot Rocket, a senior marketing designer.
You output clear bullet-point layout blueprints for Canva or similar tools.
Return plain text.
`.trim();

    const user = `
Creative type: ${creativeType || type || "story / feed post"}
Vehicle / headline context: ${label || headline || "(you decide a strong one)"}
CTA: ${cta || "(you decide a strong one)"}
Brand vibe: ${vibe || "bold, trustworthy, premium"}

Describe:
- Overall layout (top / middle / bottom)
- Where the vehicle photo(s) should go
- Where headline & CTA sit
- Any supporting text or badges
- Suggested color / style notes
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const idea = (getResponseText(completion) || "").trim();
    return res.json({ idea });
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
// /api/payment-helper (math only)
// --------------------------------------------------
app.post("/api/payment-helper", (req, res) => {
  try {
    const price = Number(req.body.price || 0);
    const down = Number(req.body.down || 0);
    const trade = Number(req.body.trade || 0);
    const payoff = Number(req.body.payoff || 0);
    const rate = Number(req.body.rate || 0) / 100 / 12;
    const term = Number(req.body.term || 0);
    const taxRate = Number(req.body.tax || 0) / 100;

    if (!price || !term) {
      return res.status(400).json({
        error: "missing_inputs",
        message: "Price and term (in months) are required for payment.",
      });
    }

    const taxedPrice = taxRate ? price * (1 + taxRate) : price;

    // Negative equity: only add payoff that is ABOVE trade value
    const negativeEquity = Math.max(payoff - trade, 0);

    // Amount financed after down payment and trade equity/negative equity
    const amountFinanced = Math.max(taxedPrice - down + negativeEquity, 0);

    let payment;
    if (!rate) {
      payment = amountFinanced / term;
    } else {
      payment =
        (amountFinanced * rate * Math.pow(1 + rate, term)) /
        (Math.pow(1 + rate, term) - 1);
    }

    const result = `~$${payment.toFixed(
      2
    )} per month (rough estimate only, not a binding quote).`;

    return res.json({ result });
  } catch (err) {
    console.error("payment-helper error", err);
    return res.status(500).json({ error: "Failed to estimate payment" });
  }
});

// --------------------------------------------------
// /api/income-helper (annualize gross-to-date using last paycheck date)
// --------------------------------------------------
app.post("/api/income-helper", (req, res) => {
  try {
    const grossToDate =
      Number(req.body.mtd || req.body.monthToDate || req.body.grossToDate || 0);

    const lastPayDateStr =
      req.body.lastPayDate ||
      req.body.lastCheck ||
      req.body.lastPaycheckDate ||
      req.body.date;

    if (!grossToDate || !lastPayDateStr) {
      return res.status(400).json({
        error: "income_inputs",
        message:
          "Month-to-date / year-to-date income and last paycheck date are required.",
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

    const formatMoney = (n) =>
      `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    const result = `Estimated Yearly Gross: ${formatMoney(
      estimatedYearly
    )} | Weeks into Year: ${weeksIntoYear.toFixed(
      1
    )} | Estimated Average Monthly Income: ${formatMoney(estimatedMonthly)}`;

    return res.json({ result });
  } catch (err) {
    console.error("income-helper error", err);
    return res.status(500).json({ error: "Failed to estimate income" });
  }
});

// --------------------------------------------------
// /ai/workflow (standalone route used by workflow modal)
// KEEP THIS PATH: your frontend already calls /ai/workflow
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
// /api/message-helper (workflow/message/ask/car/image-brief/video-brief)
// NOTE: returns { text } always.
// If mode === "video-brief" and model returns valid JSON, also returns fields.
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
`.trim();
        break;
      }

      case "workflow":
        systemPrompt = `
You are Lot Rocket's AI Workflow Expert.
Be concise, direct, action-focused for car sales pros.
`.trim();
        userPrompt = fields.prompt || rawContext || "Help me with my sales workflow.";
        break;

      case "message":
        systemPrompt = `
You are Lot Rocket's AI Message Builder.
Write high-converting, friendly, conversational messages for car shoppers.
Match the channel (text / email / DM) if provided.
`.trim();
        userPrompt = fields.prompt || rawContext || "Write a follow-up message to a car lead.";
        break;

      case "ask":
        systemPrompt = `
You are Lot Rocket's general AI assistant for car salespeople.
Answer clearly and practically with a focus on selling more cars and helping customers.
`.trim();
        userPrompt = fields.prompt || rawContext || "Answer this question for a car salesperson.";
        break;

      case "car":
        systemPrompt = `
You are The Master Automotive Analyst, integrated into Lot Rocket.
Be technical, precise, blunt, and confident. Analyze—do not summarize.
Include: powertrain, trim decoding, best/avoid years, known issues, verdict, and sales application.
`.trim();
        userPrompt = fields.prompt || rawContext || "Explain this vehicle to a customer.";
        break;

      case "image-brief":
        systemPrompt = `
You are Lot Rocket's AI Image Brief generator.
Create concise prompts for an AI image model to generate marketing graphics for car dealers.
Return ONLY the prompt text, no explanations.
`.trim();
        userPrompt = fields.prompt || rawContext || "Generate an image brief for a dealership post.";
        break;

      default:
        systemPrompt = `
You are Lot Rocket's AI assistant for car dealers.
Respond with clear, helpful content a salesperson can use immediately.
`.trim();
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
          script: parsed.script || "",
          shotList: parsed.shotList || "",
          aiPrompt: parsed.aiPrompt || "",
          thumbPrompt: parsed.thumbPrompt || "",
        });
      }
    }

    return res.json({ text });
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

