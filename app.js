/**
 * app.js — Lot Rocket Backend (CLEAN / DEDUPED / CONSISTENT)
 * Version: 2.6-clean (ROCKET-6)
 */

require("dotenv").config();
// Node 18+ has global fetch (Render uses Node 22) — safe fallback
let fetchFn = global.fetch;
if (typeof fetchFn !== "function") {
  try {
    // Only if you ever deploy to older Node
    // eslint-disable-next-line global-require
    fetchFn = require("node-fetch");
  } catch {
    throw new Error("Fetch is not available. Use Node 18+ or install node-fetch.");
  }
}

function cleanText(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

// --------------------------------------------------
// Extract description from HTML (safe + robust)
// --------------------------------------------------
function extractVehicleDescriptionFromHtml($, html) {
  // 1) Meta description
  const meta =
    cleanText($('meta[name="description"]').attr("content")) ||
    cleanText($('meta[property="og:description"]').attr("content"));

  if (meta && meta.length > 40) return meta;

  // 2) JSON-LD structured data
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

  // 3) DOM fallback selectors
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

  return "";
}

// --------------------------------------------------
// Fallback post generator
// --------------------------------------------------
function buildFallbackPosts({ label, price, url, description }) {
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
    `🔥 JUST IN: ${label || "Fresh Inventory"}${price ? ` • ${price}` : ""}\n✅ Ready for a quick approval + easy test drive?\n📲 Message me “INFO” and I’ll send details.${line}\n\n${tags}\n${url || ""}`.trim(),

    `🚗 ${label || "Available now"}${price ? ` • ${price}` : ""}\n💥 Clean, sharp, and ready to roll.\n📩 Comment “YES” and I’ll DM the full rundown + next steps.${line}\n\n${tags}\n${url || ""}`.trim(),

    `⚡️ Hot pick: ${label || "This one won’t last"}${price ? ` • ${price}` : ""}\n🕒 Want to see it today?\n📲 Send “APPT” and I’ll lock in a time.${line}\n\n${tags}\n${url || ""}`.trim(),
  ];
}
const express = require("express");
const path = require("path");
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
// Photo URL normalizer (DEDUP / CLEAN)
// ======================================================

function normalizePhotoUrl(u) {
  if (!u) return "";
  try {
    const url = new URL(u);

    // remove junk query params that cause duplicates (size/crop/cache)
    [
      "width", "height", "w", "h", "fit", "crop",
      "quality", "q", "auto", "fm", "fmt", "dpr",
      "cache", "cb",
    ].forEach((k) => url.searchParams.delete(k));

    // strip trailing slashes
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
    const res = await fetchFn(url, { ...opts, signal: controller.signal });
    return res;
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
    "logo","brand","dealer","dealership",
    "icon","favicon","sprite","badge",
    "placeholder","blank","spacer",
    "loading","loader","spinner",
    "button","cta","banner","header","footer",
    "facebook","instagram","tiktok","youtube",
    "carfax","autocheck","kbb","edmunds",
    "special","offer","sale","finance","payment",
    "play","video","overlay","watermark",
    ".svg"
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
// Scraping (single path)
// ======================================================

async function scrapePage

function scrapeVehiclePhotosFromCheerio($, baseUrl) {
  const urls = new Set();

  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const addUrl = (raw) => {
    if (!raw) return;
    const s = String(raw).trim();
    if (!s) return;

    const cleaned = s.replace(/^url\(["']?/, "").replace(/["']?\)$/, "").trim();

    try {
      const abs = new URL(cleaned, base).href;
      urls.add(abs);
    } catch {}
  };

  const pickBestFromSrcset = (srcset) => {
    if (!srcset) return null;
    const parts = String(srcset)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    let best = null;
    let bestW = -1;

    for (const p of parts) {
      const [u, w] = p.split(/\s+/);
      const m = (w || "").match(/^(\d+)w$/);
      if (m) {
        const ww = Number(m[1]);
        if (ww > bestW) {
          bestW = ww;
          best = u;
        }
      } else {
        best = u;
      }
    }
    return best;
  };

  $("img").each((_, el) => {
    const $el = $(el);

    const src =
      $el.attr("data-src") ||
      $el.attr("data-original") ||
      $el.attr("data-lazy") ||
      $el.attr("data-lazy-src") ||
      $el.attr("data-zoom") ||
      $el.attr("src");

    const srcset = $el.attr("srcset") || $el.attr("data-srcset");
    const bestFromSrcset = pickBestFromSrcset(srcset);

    addUrl(bestFromSrcset);
    addUrl(src);
  });

  $("source").each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr("srcset") || $el.attr("data-srcset");
    const best = pickBestFromSrcset(srcset);
    addUrl(best);
  });

  $("[style]").each((_, el) => {
    const style = String($(el).attr("style") || "");
    const matches = style.match(/background-image\s*:\s*url\(([^)]+)\)/gi);
    if (!matches) return;

    for (const m of matches) {
      const inner = m.match(/url\(([^)]+)\)/i);
      if (inner && inner[1]) addUrl(inner[1]);
    }
  });

  $("script").each((_, el) => {
    const txt = $(el).html();
    if (!txt) return;

    const re = /https?:\/\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s]*)?/gi;
    const found = txt.match(re);
    if (found && found.length) found.forEach(addUrl);
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
// Build Kit (shared by /boost + /api/boost + /api/social-kit)
// ======================================================

async function buildKitForUrl({ pageUrl, labelOverride = "", priceOverride = "", processPhotos = true }) {
  const pageInfo = await scrapePage(pageUrl);

  const rawPhotos = scrapeVehiclePhotosFromCheerio(pageInfo.$, pageUrl);
  const cleaned = cleanPhotoList(rawPhotos, 300);
  const preferred = preferVehicleGalleryPhotos(cleaned);

  // final: normalize + dedupe + keep a large candidate pool for frontend selection
  const finalPhotos = uniqPhotos(preferred, 300);

  const kit = await buildSocialKit({
    pageInfo,
    labelOverride,
    priceOverride,
    photos: finalPhotos,
  });

  kit.editedPhotos = processPhotos
    ? await processPhotoBatch(finalPhotos.slice(0, 24), kit.vehicleLabel)
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
console.log("🧠 BOOST RESPONSE PAYLOAD: (moved into boostHandler — remove top-level log)");


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

    // ✅ Works reliably across Node fetch implementations:
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
// /boost (back-compat) + /api/boost (primary)
// --------------------------------------------------
async function boostHandler(req, res) {
  try {
    const pageUrl = normalizeUrl(req.body?.url);
    const labelOverride = req.body?.labelOverride || "";
    const priceOverride = req.body?.priceOverride || "";
    const processPhotos = req.body?.processPhotos !== false;

    if (!pageUrl) {
      return res.status(400).json({ error: "bad_url", message: "Invalid or missing URL." });
    }

    const kit = await buildKitForUrl({
      pageUrl,
      labelOverride,
      priceOverride,
      processPhotos,
    });

    // -----------------------------
    // Description (guaranteed)
    // -----------------------------
    let description = "";

    try {
      const r = await fetchFn(pageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
      });

      const html = r && r.ok ? await r.text() : "";
      if (html) {
        const $ = cheerio.load(html);

        description =
          $('meta[name="description"]').attr("content") ||
          $('meta[property="og:description"]').attr("content") ||
          // common VDP containers
          $(".vehicle-description").first().text() ||
          $(".vdp-description").first().text() ||
          $(".description").first().text() ||
          $("#description").text() ||
          // dealer comments / remarks
          $(".dealer-comments").first().text() ||
          $(".comments").first().text() ||
          $(".remarks").first().text() ||
          "";
      }
    } catch {
      description = "";
    }

    description = String(description || "").replace(/\s+/g, " ").trim();

    console.log("✅ BOOST:", {
      url: pageUrl,
      photos: kit.photos?.length || 0,
      edited: kit.editedPhotos?.length || 0,
      descriptionLength: description.length,
      posts: Array.isArray(kit.posts) ? kit.posts.length : 0,
      processPhotos,
    });

    return res.json({
      ...kit,
      description,                 // ✅ ALWAYS PRESENT
      posts: kit.posts || [],      // ✅ ALWAYS ARRAY
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
    const processPhotos = req.body?.processPhotos !== false;

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
// /api/new-script
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
`.trim();

    const user = `
Dealer page title: ${pageInfo.title}
Meta: ${pageInfo.metaDesc}

You have ${finalPhotos.length} exterior/interior still photos.
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
// /api/design-idea
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
// /api/payment-helper  ✅ ROUTEONE-STYLE + BREAKDOWN
// Includes: fees, negative equity, optional trade tax credit
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

    // --------------------------------------------------
    // ✅ STATE RULE DEFAULTS (editable list)
    // - taxTradeCredit: trade reduces taxable base?
    // - taxFees: fees/add-ons taxable?
    // - rebateReducesTaxable: rebate reduces taxable base?
    // --------------------------------------------------
    const STATE_RULES = {
      MI: { taxTradeCredit: true,  taxFees: true,  rebateReducesTaxable: false },
      OH: { taxTradeCredit: true,  taxFees: true,  rebateReducesTaxable: false },
      IN: { taxTradeCredit: true,  taxFees: true,  rebateReducesTaxable: false },
      IL: { taxTradeCredit: true,  taxFees: true,  rebateReducesTaxable: false },
      PA: { taxTradeCredit: true,  taxFees: true,  rebateReducesTaxable: false },
      NY: { taxTradeCredit: true,  taxFees: true,  rebateReducesTaxable: false },
      NJ: { taxTradeCredit: true,  taxFees: true,  rebateReducesTaxable: false },
      FL: { taxTradeCredit: true,  taxFees: true,  rebateReducesTaxable: false },
      TX: { taxTradeCredit: true,  taxFees: true,  rebateReducesTaxable: false },
      CA: { taxTradeCredit: true,  taxFees: true,  rebateReducesTaxable: false },
    };

    const rules = STATE_RULES[state] || STATE_RULES.MI;

    // Allow future overrides (optional)
    const taxTradeCredit =
      typeof req.body.taxTradeCredit === "boolean" ? req.body.taxTradeCredit : rules.taxTradeCredit;

    const taxFees =
      typeof req.body.taxFees === "boolean" ? req.body.taxFees : rules.taxFees;

    const rebateReducesTaxable =
      typeof req.body.rebateReducesTaxable === "boolean"
        ? req.body.rebateReducesTaxable
        : rules.rebateReducesTaxable;

    // --------------------------------------------------
    // ✅ Core math
    // --------------------------------------------------
    const tradeEquity = trade - payoff;              // + = positive equity, - = negative
    const negativeEquity = Math.max(payoff - trade, 0);

    const feesTaxable = taxFees ? fees : 0;
    const tradeTaxCredit = taxTradeCredit ? trade : 0;
    const rebateTaxableReduction = rebateReducesTaxable ? rebate : 0;

    const taxableBase = Math.max(price + feesTaxable - tradeTaxCredit - rebateTaxableReduction, 0);
    const taxRate = taxPct / 100;
    const taxAmount = taxableBase * taxRate;

    // Amount financed (typical): price + fees + tax - down - trade + payoff - rebate
    const amountFinanced = Math.max(price + fees + taxAmount - down - trade + payoff - rebate, 0);

    const monthlyRate = (aprPct / 100) / 12;

    let payment;
    if (!monthlyRate) {
      payment = amountFinanced / term;
    } else {
      payment =
        (amountFinanced * monthlyRate * Math.pow(1 + monthlyRate, term)) /
        (Math.pow(1 + monthlyRate, term) - 1);
    }

    const money = (n) =>
      `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      assumptions: {
        taxTradeCredit,
        taxFees,
        rebateReducesTaxable,
      },
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

    const formatMoney = (n) =>
      `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    const result = `Estimated Yearly Gross: ${formatMoney(estimatedYearly)} | Weeks into Year: ${weeksIntoYear.toFixed(
      1
    )} | Estimated Average Monthly Income: ${formatMoney(estimatedMonthly)}`;

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
        systemPrompt = `You are Lot Rocket's AI Image Brief generator. Return ONLY the prompt text.`.trim();
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
