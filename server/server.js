// /server/server.js  (REPLACE ENTIRE FILE)
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ allow JSON bodies for AI route
app.use(express.json({ limit: "1mb" }));

// ===============================
// STATIC FRONTEND
// ===============================
app.use(express.static(path.join(__dirname, "../public")));
// /server/server.js — ADD THIS ENDPOINT (anywhere before app.get("*"...))
// FIXES ZIP FAIL (CORS) by proxying images same-origin
app.get("/api/proxy", async (req, res) => {
  try {
    const u = (req.query.url || "").toString().trim();
    if (!u) return res.status(400).send("missing url");

    let target;
    try { target = new URL(u); } catch { return res.status(400).send("bad url"); }

    // basic safety: only http/https
    if (!/^https?:$/.test(target.protocol)) return res.status(400).send("bad protocol");

    const r = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!r.ok) return res.status(502).send("fetch failed");

    const ct = r.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=3600");

    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(200).send(buf);
  } catch (e) {
    console.error("PROXY_ERR", e);
    return res.status(500).send("proxy error");
  }
});

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
    let s = (u || "").toString().trim().replace(/\s+/g, "");

    // keep last http(s) if duplicated
    const lastHttp = Math.max(s.lastIndexOf("http://"), s.lastIndexOf("https://"));
    if (lastHttp > 0) s = s.slice(lastHttp);

    // fix common accidental prefix
    s = s.replace(/^whttps:\/\//i, "https://");
    s = s.replace(/^whttp:\/\//i, "http://");

    const parsed = new URL(s);

    // require http/https
    if (!/^https?:$/.test(parsed.protocol)) return "";

    // basic host sanity
    if (!parsed.hostname || !parsed.hostname.includes(".")) return "";

    return parsed.toString();
  } catch {
    return "";
  }
}


function absUrl(base, maybe) {
  try {
    if (!maybe) return "";
    if (maybe.startsWith("//")) return "https:" + maybe;
    return new URL(maybe, base).toString();
  } catch {
    return "";
  }
}

function pickFromSrcset(srcset) {
  if (!srcset || typeof srcset !== "string") return "";
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

  if (s.startsWith("data:")) return true;
  if (s.endsWith(".svg")) return true;

  if (s.includes("sprite")) return true;
  if (s.includes("favicon")) return true;
  if (s.includes("/icons/")) return true;
  if (s.includes("icon-")) return true;
  if (s.includes("logo")) return true;

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
    const k = String(x).trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function htmlEntityDecode(s) {
  if (!s) return "";
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(s) {
  return htmlEntityDecode(String(s || "").replace(/\s+/g, " ").trim());
}

function extractOgImage(html, base) {
  const re = /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
  const found = [];
  let m;
  while ((m = re.exec(html))) {
    const u = absUrl(base, m[1]);
    if (u && !isProbablyJunkImage(u)) found.push(u);
  }
  return found;
}

function extractOgText(html) {
  const get = (prop) => {
    const re = new RegExp(
      `<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const m = re.exec(html);
    return cleanText(m?.[1] || "");
  };
  return {
    title: get("og:title"),
    description: get("og:description"),
    image: get("og:image"),
  };
}

function extractImgs(html, base) {
  const found = [];

  const srcsetRe = /\ssrcset=["']([^"']+)["']/gi;
  let m;
  while ((m = srcsetRe.exec(html))) {
    const best = pickFromSrcset(m[1]);
    const u = absUrl(base, best);
    if (u && !isProbablyJunkImage(u)) found.push(u);
  }

  const attrRe =
    /\s(?:src|data-src|data-lazy|data-original|data-url)=["']([^"']+)["']/gi;
  while ((m = attrRe.exec(html))) {
    const u = absUrl(base, m[1]);
    if (u && !isProbablyJunkImage(u)) found.push(u);
  }

  return found;
}

function extractLdJsonImagesAndVehicle(html, base) {
  const images = [];
  let vehicle = null;

  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;

  const pushImg = (x) => {
    if (!x) return;
    if (typeof x === "string") {
      const u = absUrl(base, x);
      if (u && !isProbablyJunkImage(u)) images.push(u);
    } else if (x && typeof x === "object") {
      if (x.url) {
        const u = absUrl(base, x.url);
        if (u && !isProbablyJunkImage(u)) images.push(u);
      }
    }
  };

  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "object") {
      if (node.image) {
        if (Array.isArray(node.image)) node.image.forEach(pushImg);
        else pushImg(node.image);
      }
      if (node.images) {
        if (Array.isArray(node.images)) node.images.forEach(pushImg);
        else pushImg(node.images);
      }
      if (node.thumbnailUrl) pushImg(node.thumbnailUrl);
      if (node.contentUrl) pushImg(node.contentUrl);

      // try to capture vehicle-ish objects
      const t = String(node["@type"] || "").toLowerCase();
      if (!vehicle && (t === "vehicle" || t === "car" || t === "product" || t === "offer")) {
        vehicle = node;
      }

      for (const k of Object.keys(node)) walk(node[k]);
    }
  };

  while ((m = re.exec(html))) {
    const raw = (m[1] || "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      walk(parsed);
    } catch {
      // ignore
    }
  }

  return { images, vehicle };
}

function extractJsonBlobImages(html, base) {
  const found = [];

  const arrRe = /"images"\s*:\s*\[([^\]]+)\]/gi;
  let m;
  while ((m = arrRe.exec(html))) {
    const block = m[1] || "";
    const urlRe = /"([^"]+)"/g;
    let u;
    while ((u = urlRe.exec(block))) {
      const abs = absUrl(base, u[1]);
      if (abs && !isProbablyJunkImage(abs)) found.push(abs);
    }
  }

  const singleRe = /"image"\s*:\s*"([^"]+)"/gi;
  while ((m = singleRe.exec(html))) {
    const abs = absUrl(base, m[1]);
    if (abs && !isProbablyJunkImage(abs)) found.push(abs);
  }

  return found;
}

function pickMoney(s) {
  const m = String(s || "").match(/\$[\s]*[\d,]+(\.\d{2})?/);
  return m ? m[0].replace(/\s+/g, "") : "";
}

function pickMileage(s) {
  const m = String(s || "").match(/([\d,]{2,})\s*(miles|mi)\b/i);
  return m ? `${m[1]} ${m[2]}`.replace(/\s+/g, " ") : "";
}

function pickVin(s) {
  const m = String(s || "").match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
  return m ? m[1].toUpperCase() : "";
}

function pickStock(s) {
  const m = String(s || "").match(/\b(Stock\s*#?\s*[:\-]?\s*)([A-Z0-9\-]{3,})\b/i);
  return m ? m[2].toUpperCase() : "";
}

function bestVehicleFromHtml(html, og) {
  const text = cleanText(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  const title = og.title || cleanText((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || ""));
  const price = pickMoney(text) || pickMoney(og.description) || "";
  const mileage = pickMileage(text) || "";
  const vin = pickVin(text) || "";
  const stock = pickStock(text) || "";

  return { title, price, mileage, vin, stock };
}

// ==================================================
// AI SOCIAL POSTS — /api/ai/social
// ==================================================
app.post("/api/ai/social", async (req, res) => {
  try {
    const { vehicle = {}, platform = "facebook" } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.json({ ok: false, error: "Missing OPENAI_API_KEY on server env" });
    }

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
// API: BOOST (IMAGES + VEHICLE DETAILS)
// GET /api/boost?url=...&debug=1
// ===============================
app.get("/api/boost", async (req, res) => {
  const started = Date.now();
  const input = (req.query.url || "").toString().trim();
  const target = safeUrl(input);
  const debug = String(req.query.debug || "") === "1";

  const out = {
    ok: false,
    url: input || "",
    finalUrl: "",
    title: "",
    images: [],
    vehicle: {
      title: "",
      price: "",
      mileage: "",
      vin: "",
      stock: "",
      exterior: "",
      interior: "",
      engine: "",
      transmission: "",
      drivetrain: "",
      dealer: "",
      url: "",
      location: "",
    },
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
    return res.status(200).json(out);
  }


  try {
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
    const base = out.finalUrl || target;

    // OG + <title>
    const ogText = extractOgText(html);
    const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    out.title = cleanText(ogText.title || t?.[1] || "");

    // images: OG + LDJSON + JSON blob + IMG attrs
    const ogImgs = extractOgImage(html, base);
    const ldPack = extractLdJsonImagesAndVehicle(html, base);
    const ldImgs = ldPack.images || [];
    const blobImgs = extractJsonBlobImages(html, base);
    const attrImgs = extractImgs(html, base);

    const merged = uniq([].concat(ogImgs, ldImgs, blobImgs, attrImgs));

    const filtered = merged.filter((u) => {
      const s = u.toLowerCase();
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

    // vehicle details: best-effort from OG + HTML text + LDJSON (if present)
    const vFromHtml = bestVehicleFromHtml(html, ogText);

    const dealerHost = (() => {
      try { return new URL(base).hostname.replace(/^www\./, ""); } catch { return ""; }
    })();

    out.vehicle.title = cleanText(vFromHtml.title || out.title || "");
    out.vehicle.price = vFromHtml.price || "";
    out.vehicle.mileage = vFromHtml.mileage || "";
    out.vehicle.vin = vFromHtml.vin || "";
    out.vehicle.stock = vFromHtml.stock || "";
    out.vehicle.url = base;
    out.vehicle.dealer = dealerHost;
    out.vehicle.location = "Detroit area";

    // if LDJSON had something useful, lightly upgrade fields (safe)
    const ldVehicle = ldPack.vehicle;
    if (ldVehicle && typeof ldVehicle === "object") {
      const name = cleanText(ldVehicle.name || ldVehicle.title || "");
      if (name && name.length > out.vehicle.title.length) out.vehicle.title = name;

      const sku = cleanText(ldVehicle.sku || "");
      if (sku && !out.vehicle.stock) out.vehicle.stock = sku;

      const vin = cleanText(ldVehicle.vehicleIdentificationNumber || ldVehicle.vin || "");
      if (vin && !out.vehicle.vin) out.vehicle.vin = vin;

      const offers = ldVehicle.offers;
      const price = cleanText(offers?.price || offers?.priceSpecification?.price || "");
      if (price && !out.vehicle.price) out.vehicle.price = price.startsWith("$") ? price : `$${price}`;

      const mileage = cleanText(ldVehicle.mileageFromOdometer?.value || "");
      if (mileage && !out.vehicle.mileage) out.vehicle.mileage = `${mileage} mi`;

      const ext = cleanText(ldVehicle.color || "");
      if (ext && !out.vehicle.exterior) out.vehicle.exterior = ext;

      const trans = cleanText(ldVehicle.vehicleTransmission || "");
      if (trans && !out.vehicle.transmission) out.vehicle.transmission = trans;
    }

    out.meta.counts = {
      og: ogImgs.length,
      ldjson: ldImgs.length,
      jsonblob: blobImgs.length,
      imgAttrs: attrImgs.length,
      merged: merged.length,
      final: out.images.length,
    };

    out.meta.ms = Date.now() - started;
    out.ok = true;

    console.log(
      "BOOST",
      out.images.length,
      "imgs",
      "ms=" + out.meta.ms,
      "url=" + target
    );

    if (!debug) {
      // keep response lean if not debugging
      delete out.meta.counts;
      delete out.meta.notes;
    }

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
