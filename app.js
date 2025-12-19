/**
 * app.js — Lot Rocket Backend (CLEAN / DEDUPED / CONSISTENT)
 * Version: 2.6-clean (deploy-safe)
 *
 * Key endpoints used by frontend:
 * - POST /api/boost
 * - POST /api/social-kit (if you add later)
 * - GET  /api/proxy-image?url=
 * - POST /api/social-photos-zip
 * - POST /api/objection-coach
 * - POST /api/payment-helper
 * - POST /api/income-helper
 * - POST /ai/workflow
 * - POST /api/message-helper
 */

require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const fetch = require("node-fetch");
const archiver = require("archiver");

// OPTIONAL: Playwright fallback for JS-loaded galleries
let playwright = null;
try {
  playwright = require("playwright");
} catch {
  console.warn("⚠️ Playwright not installed. JS-rendered gallery fallback disabled.");
}

const app = express();

// -------------------- Middleware (ONE COPY ONLY) --------------------
app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// -------------------- OpenAI Client --------------------
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ======================================================
// Helpers (single source of truth)
// ======================================================
function scrapeVehiclePhotosFromCheerio($, baseUrl) {
  const urls = new Set();
  let base;
  try { base = new URL(baseUrl); } catch { base = null; }

  $("img").each((_, el) => {
    let src = $(el).attr("data-src") || $(el).attr("src");
    if (!src) return;
    src = String(src).trim();
    if (!src) return;

    const lower = src.toLowerCase();
    if (lower.includes("logo") || lower.includes("icon") || lower.includes("sprite") || lower.endsWith(".svg")) return;

    try {
      const abs = base ? new URL(src, base).href : src;
      urls.add(abs);
    } catch {}
  });

  return Array.from(urls);
}

function normalizeUrl(raw) {
  if (!raw) return null;
  let url = String(raw).trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url.replace(/^\/+/, "");
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
    return await fetch(url, { ...opts, signal: controller.signal });
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

// ✅ Robust for OpenAI Responses API (handles different shapes)
function getResponseText(response) {
  if (!response) return "";
  if (typeof response.output_text === "string") return response.output_text;
  // older shape
  return response?.output?.[0]?.content?.[0]?.text || "";
}

function isRateLimitError(err) {
  const msg = (err?.message || err?.error?.message || "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("billing") ||
    err?.status === 429 ||
    err?.code === "rate_limit_exceeded"
  );
}

function sendAIError(res, err, friendlyMessage) {
  console.error("🔴 AI error:", friendlyMessage, err);
  const rawMsg = err?.message || err?.error?.message || "Unknown error";

  if (isRateLimitError(err)) {
    const lower = rawMsg.toLowerCase();
    const isQuotaOrBilling =
      lower.includes("quota") ||
      lower.includes("billing") ||
      (lower.includes("insufficient") && lower.includes("balance"));

    return res.status(429).json({
      error: isQuotaOrBilling ? "quota" : "rate_limit",
      message: isQuotaOrBilling
        ? "Lot Rocket’s AI quota/billing looks tapped on the server. Check the OpenAI key + billing."
        : "Lot Rocket hit the AI rate limit. Wait 20–30 seconds and try again.",
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
    const host = (u.hostname || "").toLowerCase();

    if (host === "localhost" || host.endsWith(".localhost")) return true;

    // block private IP ranges
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      if (host.startsWith("127.")) return true;
      if (host.startsWith("10.")) return true;
      if (host.startsWith("192.168.")) return true;
      if (host.startsWith("169.254.")) return true;

      const parts = host.split(".").map(Number);
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    }

    return false;
  } catch {
    return true;
  }
}

function absUrl(base, maybeUrl) {
  if (!maybeUrl) return null;
  const u = String(maybeUrl)
    .trim()
    .replace(/^url\(["']?/, "")
    .replace(/["']?\)$/, "");
  if (!u || u === "#" || u.startsWith("data:")) return null;
  try {
    return new URL(u, base).toString();
  } catch {
    return null;
  }
}

// ======================================================
// ✅ REQUIRED: srcset parser (WAS MISSING -> caused parseSrcset not defined)
// ======================================================
function parseSrcset(srcset) {
  if (!srcset) return [];
  return String(srcset)
    .split(",")
    .map((s) => s.trim().split(/\s+/)[0])
    .filter(Boolean);
}

// ======================================================
// Helpers — arrays / photos
// ======================================================

function uniqStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.map((v) => String(v).trim()).filter(Boolean)));
}

/**
 * Expand LaFontaine-style image sequences:
 *  .../ip/1.jpg  → ip/1.jpg ... ip/24.jpg
 */
function expandIpSequence(urls, max = 24) {
  if (!Array.isArray(urls) || !urls.length) return [];

  const out = new Set(urls);

  for (const url of urls) {
    const match = String(url).match(/\/ip\/(\d+)\.(jpg|jpeg|png|webp)(\?.*)?$/i);
    if (!match) continue;

    const base = String(url).replace(/\/ip\/\d+\.(jpg|jpeg|png|webp)(\?.*)?$/i, "");
    const ext = match[2];

    for (let i = 1; i <= max; i++) {
      out.add(`${base}/ip/${i}.${ext}`);
    }
  }

  return Array.from(out);
}

// ======================================================
// Image extraction (single copy)
// ======================================================
function extractImageUrlsFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const candidates = [];

  const push = (u) => {
    const a = absUrl(baseUrl, u);
    if (a) candidates.push(a);
  };

  // meta hints
  push($("meta[property='og:image']").attr("content"));
  push($("meta[name='twitter:image']").attr("content"));
  push($("link[rel='image_src']").attr("href"));

  // img + lazy attrs + srcset
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

  // noscript galleries
  $("noscript").each((_, el) => {
    const inner = $(el).html();
    if (!inner) return;
    const $$ = cheerio.load(inner);
    $$("img").each((_, img) => {
      push($$(img).attr("src"));
      push($$(img).attr("data-src"));
      const ss = $$(img).attr("srcset");
      if (ss) parseSrcset(ss).forEach(push);
    });
  });

  // picture source srcset
  $("picture source").each((_, el) => {
    const ss = $(el).attr("srcset");
    if (ss) parseSrcset(ss).forEach(push);
  });

  // inline background-image urls
  $("[style]").each((_, el) => {
    const style = String($(el).attr("style") || "");
    const matches = style.match(/url\(([^)]+)\)/gi);
    if (matches) {
      matches.forEach((m) => {
        const mm = m.match(/url\(([^)]+)\)/i);
        if (mm && mm[1]) push(mm[1]);
      });
    }
  });

  // LD+JSON image arrays
  $("script[type='application/ld+json']").each((_, el) => {
    const txt = $(el).html();
    if (!txt) return;
    try {
      const json = JSON.parse(txt.trim());
      const walk = (node) => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node === "object") {
          if (node.image) walk(node.image);
          if (node.images) walk(node.images);
          if (node.photo) walk(node.photo);
          if (node.photos) walk(node.photos);
          for (const v of Object.values(node)) walk(v);
          return;
        }
        if (typeof node === "string") {
          if (/\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(node)) push(node);
        }
      };
      walk(json);
    } catch {
      // ignore
    }
  });

  // Script blobs (absolute + escaped + relative)
  $("script").each((_, el) => {
    const txt = $(el).html();
    if (!txt) return;

    const foundAbs = txt.match(
      /https?:\/\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(\?[^"'\\\s]*)?/gi
    );
    if (foundAbs) foundAbs.forEach((u) => candidates.push(u));

    const foundEsc = txt.match(
      /\\\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\\\?[^"'\\\s]*)?/gi
    );
    if (foundEsc)
      foundEsc.forEach((u) => {
        const unescaped = u.replace(/\\\//g, "/").replace(/\\\?/g, "?");
        push(unescaped);
      });

    const foundRel = txt.match(/\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(\?[^"'\\\s]*)?/gi);
    if (foundRel) foundRel.forEach(push);
  });

  const cleaned = candidates
    .map((u) => String(u || "").trim())
    .filter(Boolean)
    .filter((u) => /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(u))
    .filter((u) => !/logo|sprite|icon|placeholder|spacer|pixel|1x1/i.test(u));

  return Array.from(new Set(cleaned));
}

// ======================================================
// Scraping
// ======================================================
async function scrapePage(url) {
  const res = await fetchWithTimeout(url, {}, 20000);
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = (
    $("meta[property='og:title']").attr("content") ||
    $("meta[name='twitter:title']").attr("content") ||
    $("title").text() ||
    ""
  ).trim();

  const price = (
    $("meta[property='product:price:amount']").attr("content") ||
    $("meta[property='og:price:amount']").attr("content") ||
    $("meta[itemprop='price']").attr("content") ||
    ""
  ).trim();

  const photos = extractImageUrlsFromHtml(html, url).slice(0, 24);

  console.log("SCRAPE DEBUG:", {
    url,
    titleLength: title.length,
    price,
    photosFound: photos.length,
    sample: photos.slice(0, 5),
  });

  return { title, price, photos, html };
}

async function scrapePageRendered(url) {
  if (!playwright) throw new Error("Playwright not installed");
  const browser = await playwright.chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500);
    return await page.content();
  } finally {
    await browser.close();
  }
}

// ======================================================
// Routes
// ======================================================
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---------- Image proxy ----------
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
app.get("/api/image-proxy", proxyImageHandler);

// ---------- BOOST (Step 1) ----------
app.post("/api/boost", async (req, res) => {
  try {
    const { url, labelOverride, priceOverride, maxPhotos } = req.body || {};
    const pageUrl = normalizeUrl(url);
    if (!pageUrl) return res.status(400).json({ error: "Missing/invalid url" });

    const safeMax = Math.max(1, Math.min(Number(maxPhotos) || 24, 24));

    // 1) Static scrape
    const scraped = await scrapePage(pageUrl);

    const title = (labelOverride || scraped?.title || "").trim();
    const price = (priceOverride || scraped?.price || "").trim();

    let photos = Array.isArray(scraped?.photos) ? scraped.photos : [];
    photos = uniqStrings(photos);

// 2) Rendered supplement (JS gallery / interiors) — MERGE, don’t replace
if (playwright) {
  try {
    console.log("🎭 Rendered scrape merge (interiors). Static count:", photos.length);
    const renderedHtml = await scrapePageRendered(pageUrl);
    const renderedPhotos = extractImageUrlsFromHtml(renderedHtml, pageUrl);
console.log("🧪 RENDERED extracted raw count =", photos.length);
console.log("🧪 RENDERED sample 40 =", photos.slice(0, 40));

    if (Array.isArray(renderedPhotos) && renderedPhotos.length) {
      photos = uniqStrings([].concat(photos, renderedPhotos));
    }
  } catch (e) {
    console.log("Rendered scrape failed:", e && e.message ? e.message : e);
  }
}


// ✅ LaFontaine / inventoryphotos "ip/" fix: expand interior sequences
photos = expandIpSequence(photos, safeMax);

// 🧼 Deduplicate AFTER expansion
photos = uniqStrings(photos);

// 🎯 Final cap (ALWAYS last)
photos = photos.slice(0, safeMax);


    console.log("✅ BOOST FINAL:", { count: photos.length, sample: photos.slice(0, 10) });
console.log("🧪 BOOST FIRST 12:", photos.slice(0, 12));

    return res.json({ title, price, photos });
  } catch (err) {
    console.error("❌ /api/boost failed:", err);
    return res.status(500).json({ error: err?.message || "Boost failed" });
  }
});

// ---------- ZIP download ----------
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
      const u = urls[i];
      try {
        const resp = await fetchWithTimeout(u, {}, 20000);
        if (!resp.ok || !resp.body) continue;
        archive.append(resp.body, { name: `photo-${i + 1}.jpg` });
      } catch {
        // skip
      }
    }

    archive.finalize();
  } catch (err) {
    console.error("social-photos-zip error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to build ZIP of photos." });
  }
});

// ---------- Objection coach ----------
app.post("/api/objection-coach", async (req, res) => {
  try {
    const { objection, history } = req.body || {};

    const system = `
You are Lot Rocket's Grandmaster Objection Coach for car sales professionals.
Respond with:
1) Diagnosis
2) Emotional Pivot (1–2 lines)
3) Kill Shot Response (ethical rebuttal)
4) Teacher’s Breakdown
`.trim();

    const user = `
Conversation history:
${history || "(none)"}

Customer objection:
${objection || "(none provided)"}
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const reply = (getResponseText(completion) || "").trim() || "No response.";
    // ✅ FRONTEND EXPECTS data.reply
    return res.json({ reply });
  } catch (err) {
    return sendAIError(res, err, "Failed to coach objection.");
  }
});

// ---------- Payment helper ----------
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
      return res.status(400).json({ error: "missing_inputs", message: "Price and term are required." });
    }

    const taxedPrice = taxRate ? price * (1 + taxRate) : price;
    const negativeEquity = Math.max(payoff - trade, 0);
    const amountFinanced = Math.max(taxedPrice - down + negativeEquity, 0);

    let payment;
    if (!rate) payment = amountFinanced / term;
    else {
      payment =
        (amountFinanced * rate * Math.pow(1 + rate, term)) /
        (Math.pow(1 + rate, term) - 1);
    }

    return res.json({ result: `~$${payment.toFixed(2)} / month (estimate)` });
  } catch (err) {
    console.error("payment-helper error", err);
    return res.status(500).json({ error: "Failed to estimate payment" });
  }
});

// ---------- Income helper ----------
app.post("/api/income-helper", (req, res) => {
  try {
    const grossToDate = Number(req.body.mtd || req.body.monthToDate || req.body.grossToDate || 0);

    const lastPayDateStr =
      req.body.lastPayDate ||
      req.body.lastCheck ||
      req.body.lastPaycheckDate ||
      req.body.date;

    if (!grossToDate || !lastPayDateStr) {
      return res.status(400).json({ error: "income_inputs", message: "Income + last paycheck date required." });
    }

    const lastPayDate = new Date(lastPayDateStr);
    if (Number.isNaN(lastPayDate.getTime())) {
      return res.status(400).json({ error: "bad_date", message: "Could not read last paycheck date." });
    }

    const year = lastPayDate.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysIntoYear = Math.floor((lastPayDate - startOfYear) / msPerDay) + 1;
    const weeksIntoYear = daysIntoYear / 7;

    const estimatedYearly = (grossToDate / weeksIntoYear) * 52;
    const estimatedMonthly = estimatedYearly / 12;

    const formatMoney = (n) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    return res.json({
      result: `Estimated Yearly Gross: ${formatMoney(estimatedYearly)} | Est Monthly: ${formatMoney(estimatedMonthly)}`
    });
  } catch (err) {
    console.error("income-helper error", err);
    return res.status(500).json({ error: "Failed to estimate income" });
  }
});

// ---------- Workflow ----------
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
`.trim();

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: workflowPrompt,
    });

    const text = (getResponseText(completion) || "").trim() || "No workflow returned.";
    return res.json({ text });
  } catch (err) {
    return sendAIError(res, err, "Failed to generate workflow.");
  }
});

// ---------- Message helper ----------
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
Return ONLY valid JSON with keys: script, shotList, aiPrompt, thumbPrompt.
`.trim();

        userPrompt = `
Platform: ${platform}
Hook style: ${hookStyle}
Target length: ${length}s
Tone: ${tone || "confident, trustworthy, sales pro"}
Video description: "${describe || "Walkaround of a car"}"
Context: ${context || "(none)"}
`.trim();
        break;
      }

      case "workflow":
        systemPrompt = `You are Lot Rocket's AI Workflow Expert. Be concise and action-focused.`.trim();
        userPrompt = fields.prompt || rawContext || "Help me with my sales workflow.";
        break;

      case "message":
        systemPrompt = `You are Lot Rocket's AI Message Builder. Write friendly high-converting messages.`.trim();
        userPrompt = fields.prompt || rawContext || "Write a follow-up message to a car lead.";
        break;

      case "ask":
        systemPrompt = `You are Lot Rocket's AI assistant. Be practical. Focus on selling more cars.`.trim();
        userPrompt = fields.prompt || rawContext || "Answer this for a car salesperson.";
        break;

      case "car":
        systemPrompt = `You are The Master Automotive Analyst. Be technical and blunt. Give sales application.`.trim();
        userPrompt = fields.prompt || rawContext || "Explain this vehicle to a customer.";
        break;

      case "image-brief":
        systemPrompt = `You are Lot Rocket's AI Image Brief generator. Return ONLY the prompt.`.trim();
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
app.listen(PORT, () => console.log("Server running on port", PORT));
