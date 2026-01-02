// /server/server.js  (REPLACE ENTIRE FILE)
const express = require("express");
const path = require("path");

// Node 18+ has global fetch. If you ever run older Node locally, install node-fetch.
// Render is typically Node 18+.
const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// STATIC FRONTEND
// ===============================
app.use(express.static(path.join(__dirname, "../public")));

// ===============================
// API: HEALTH
// ===============================
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "lot-rocket-1", ts: Date.now() });
});

// ===============================
// HELPERS
// ===============================
function safeUrl(u) {
  try {
    return new URL(u).toString();
  } catch {
    return "";
  }
}

function absUrl(base, maybe) {
  try {
    if (!maybe) return "";
    // handle protocol-relative //cdn...
    if (maybe.startsWith("//")) return "https:" + maybe;
    return new URL(maybe, base).toString();
  } catch {
    return "";
  }
}

function pickFromSrcset(srcset) {
  if (!srcset || typeof srcset !== "string") return "";
  // pick highest width candidate
  const parts = srcset
    .split(",")
    .map((p) => p.trim())
    .map((p) => {
      const [u, w] = p.split(/\s+/);
      const width = parseInt((w || "").replace("w", ""), 10) || 0;
      return { u, width };
    })
    .filter((x) => x.u);
  if (!parts.length) return "";
  parts.sort((a, b) => b.width - a.width);
  return parts[0].u || "";
}

function isProbablyJunkImage(u) {
  if (!u) return true;
  const s = u.toLowerCase();

  // obvious non-photo assets
  if (s.startsWith("data:")) return true;
  if (s.endsWith(".svg")) return true;

  // common tiny / tracker / icon patterns
  if (s.includes("sprite")) return true;
  if (s.includes("favicon")) return true;
  if (s.includes("icon")) return true;
  if (s.includes("logo")) return true;

  // 1x1 / tiny hints in URL
  if (s.includes("1x1")) return true;
  if (s.includes("pixel")) return true;
  if (s.includes("spacer")) return true;

  return false;
}

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    if (!x) continue;
    const k = x.trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function extractOgImage(html, base) {
  // <meta property="og:image" content="...">
  const re = /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
  const found = [];
  let m;
  while ((m = re.exec(html))) {
    const u = absUrl(base, m[1]);
    if (u && !isProbablyJunkImage(u)) found.push(u);
  }
  return found;
}

function extractImgs(html, base) {
  // naive but effective regex scraping (no cheerio dependency)
  // looks for src=, data-src=, data-lazy=, data-original=, and srcset=
  const found = [];

  // srcset first
  const srcsetRe = /\ssrcset=["']([^"']+)["']/gi;
  let m;
  while ((m = srcsetRe.exec(html))) {
    const best = pickFromSrcset(m[1]);
    const u = absUrl(base, best);
    if (u && !isProbablyJunkImage(u)) found.push(u);
  }

  // common attributes
  const attrRe =
    /\s(?:src|data-src|data-lazy|data-original|data-url)=["']([^"']+)["']/gi;
  while ((m = attrRe.exec(html))) {
    const u = absUrl(base, m[1]);
    if (u && !isProbablyJunkImage(u)) found.push(u);
  }

  return found;
}

function extractLdJsonImages(html, base) {
  // <script type="application/ld+json"> ... </script>
  const found = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = (m[1] || "").trim();
    if (!raw) continue;

    // ld+json sometimes includes multiple objects or invalid trailing chars
    // try parse directly, else skip
    try {
      const parsed = JSON.parse(raw);

      const walk = (node) => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node === "object") {
          // common keys: image, images, thumbnailUrl, contentUrl
          const candidates = [];
          if (node.image) candidates.push(node.image);
          if (node.images) candidates.push(node.images);
          if (node.thumbnailUrl) candidates.push(node.thumbnailUrl);
          if (node.contentUrl) candidates.push(node.contentUrl);

          for (const c of candidates) {
            if (Array.isArray(c)) {
              c.forEach((x) => {
                if (typeof x === "string") {
                  const u = absUrl(base, x);
                  if (u && !isProbablyJunkImage(u)) found.push(u);
                } else if (x && typeof x === "object" && x.url) {
                  const u = absUrl(base, x.url);
                  if (u && !isProbablyJunkImage(u)) found.push(u);
                }
              });
            } else if (typeof c === "string") {
              const u = absUrl(base, c);
              if (u && !isProbablyJunkImage(u)) found.push(u);
            } else if (c && typeof c === "object" && c.url) {
              const u = absUrl(base, c.url);
              if (u && !isProbablyJunkImage(u)) found.push(u);
            }
          }

          for (const k of Object.keys(node)) walk(node[k]);
        }
      };

      walk(parsed);
    } catch {
      // ignore
    }
  }
  return found;
}

function extractJsonBlobImages(html, base) {
  // catches common patterns like "images":["..."] or "image":"..."
  const found = [];

  // arrays: "images":["...","..."]
  const arrRe = /"images"\s*:\s*\[([^\]]+)\]/gi;
  let m;
  while ((m = arrRe.exec(html))) {
    const block = m[1] || "";
    // grab "http..." strings inside
    const urlRe = /"([^"]+)"/g;
    let u;
    while ((u = urlRe.exec(block))) {
      const abs = absUrl(base, u[1]);
      if (abs && !isProbablyJunkImage(abs)) found.push(abs);
    }
  }

  // single: "image":"..."
  const singleRe = /"image"\s*:\s*"([^"]+)"/gi;
  while ((m = singleRe.exec(html))) {
    const abs = absUrl(base, m[1]);
    if (abs && !isProbablyJunkImage(abs)) found.push(abs);
  }

  return found;
}
// ==================================================
// AI SOCIAL POSTS — /api/ai/social
// Body: { vehicle: {...}, platform: "facebook"|"instagram"|"tiktok"|"linkedin"|"x"|"dm"|"marketplace"|"hashtags" }
// ==================================================
app.post("/api/ai/social", async (req, res) => {
  try {
    const { vehicle = {}, platform = "facebook" } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.json({ ok: false, error: "Missing OPENAI_API_KEY on server env" });
    }

    // keep inputs tight
    const v = {
      title: vehicle.title || "",
      price: vehicle.price || "",
      mileage: vehicle.mileage || "",
      vin: vehicle.vin || "",
      stock: vehicle.stock || "",
      exterior: vehicle.exterior || "",
      interior: vehicle.interior || "",
      engine: vehicle.engine || "",
      trans: vehicle.transmission || vehicle.trans || "",
      drivetrain: vehicle.drivetrain || "",
      dealer: vehicle.dealer || "",
      url: vehicle.url || "",
      location: vehicle.location || "Detroit area",
    };

    const platformRules = {
      facebook:  "2 paragraphs. Emojis. Strong urgency. Clear CTA. Include 8-15 hashtags at end.",
      instagram: "Punchy caption. Emojis. Line breaks. Include 12-20 hashtags at end.",
      tiktok:    "Short hook + bullets. Emojis. CTA. Include 6-12 hashtags.",
      linkedin:  "Professional but exciting. Minimal emojis. 3-6 hashtags. CTA.",
      x:         "Max 280 chars. Emojis ok. 2-5 hashtags. CTA.",
      dm:        "Short friendly DM. 2 variants. No huge emoji spam. CTA to reply YES.",
      marketplace:"Marketplace style: title line + specs bullets + condition + CTA. Emojis ok. No fluff.",
      hashtags:  "Return ONLY hashtags line (space-separated). 18-30 relevant tags.",
    };

    const instruction = platformRules[String(platform).toLowerCase()] || platformRules.facebook;

    const system = `
You are Lot Rocket — the best automotive social copywriter.
Write high-converting posts that create urgency, appointments, and replies.
No disclaimers. No markdown. No quotes. No "as an AI".
If info is missing, write around it cleanly.
Always include a clear CTA to message/call.
`.trim();

    const user = `
PLATFORM: ${platform}
RULES: ${instruction}

VEHICLE:
Title: ${v.title}
Price/Offer: ${v.price}
Mileage: ${v.mileage}
Exterior: ${v.exterior}
Interior: ${v.interior}
Engine: ${v.engine}
Transmission: ${v.trans}
Drivetrain: ${v.drivetrain}
VIN: ${v.vin}
Stock: ${v.stock}
Dealer: ${v.dealer}
Location: ${v.location}
Link: ${v.url}

OUTPUT: return the final post ONLY.
`.trim();

    // OpenAI Chat Completions (works with Node 18+ fetch)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.9,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content?.trim() || "";

    if (!text) return res.json({ ok: false, error: "Empty AI response", raw: j });

    return res.json({ ok: true, text });
  } catch (e) {
    console.error("AI SOCIAL ERROR", e);
    return res.json({ ok: false, error: String(e?.message || e) });
  }
});

// ===============================
// API: BOOST (STABLE CONTRACT)
// GET /api/boost?url=...
// ===============================
app.get("/api/boost", async (req, res) => {
  const started = Date.now();
  const input = (req.query.url || "").toString().trim();
  const target = safeUrl(input);

  const out = {
    ok: false,
    url: input || "",
    finalUrl: "",
    title: "",
    images: [],
    meta: {
      ms: 0,
      counts: {},
      notes: [],
    },
    error: null,
  };

  if (!target) {
    out.meta.ms = Date.now() - started;
    out.error = "Missing or invalid url parameter";
    return res.status(400).json(out);
  }

  try {
    // tight, browser-ish headers
    const r = await fetch(target, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    out.finalUrl = r.url || target;

    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html")) {
      out.meta.ms = Date.now() - started;
      out.error = `Unsupported content-type: ${ct || "unknown"}`;
      return res.status(422).json(out);
    }

    const html = await r.text();

    // title
    const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    out.title = (t?.[1] || "").replace(/\s+/g, " ").trim();

    const base = out.finalUrl || target;

    const og = extractOgImage(html, base);
    const imgs = extractImgs(html, base);
    const ld = extractLdJsonImages(html, base);
    const blob = extractJsonBlobImages(html, base);

    const merged = uniq([].concat(og, ld, blob, imgs));

    // final filters (basic)
    const filtered = merged.filter((u) => {
      const s = u.toLowerCase();
      // keep common photo formats and also allow querystring cdn images
      const okExt =
        s.includes(".jpg") ||
        s.includes(".jpeg") ||
        s.includes(".png") ||
        s.includes(".webp") ||
        s.includes(".avif") ||
        s.includes(".gif") ||
        s.includes("image") ||
        s.includes("photos") ||
        s.includes("cdn");
      return !isProbablyJunkImage(u) && okExt;
    });

    out.images = uniq(filtered).slice(0, 60);

    out.meta.counts = {
      og: og.length,
      ldjson: ld.length,
      jsonblob: blob.length,
      imgAttrs: imgs.length,
      merged: merged.length,
      final: out.images.length,
    };

    out.meta.ms = Date.now() - started;
    out.ok = true;

    // minimal one-line log
    console.log(
      "BOOST",
      out.images.length,
      "imgs",
      "ms=" + out.meta.ms,
      "url=" + target
    );

    return res.json(out);
  } catch (e) {
    out.meta.ms = Date.now() - started;
    out.error = (e && e.message) || "Boost failed";
    console.error("BOOST_FAIL", out.error, "url=" + target);
    return res.status(500).json(out);
  }
});

// ===============================
// FALLBACK: index.html
// ===============================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// 🚨 REQUIRED FOR RENDER
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
