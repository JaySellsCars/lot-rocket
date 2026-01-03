// /server/server.js  (REPLACE ENTIRE FILE)

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// BODY PARSING (REQUIRED)
// ===============================
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

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

// ==================================================
// HELPERS (BOOST + VEHICLE EXTRACTION)
// ==================================================
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
  if (s.includes("icon")) return true;
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
function extractMeta(html, nameOrProp) {
  const n = String(nameOrProp).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${n}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const m = re.exec(html);
  return (m?.[1] || "").trim();
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
function extractLdJsonObjects(html) {
  const out = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = (m[1] || "").trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // ignore
    }
  }
  return out;
}
function findVehicleInJsonLd(obj) {
  const hits = [];
  const walk = (n) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n !== "object") return;

    const t = n["@type"];
    if (t) {
      const types = Array.isArray(t) ? t : [t];
      const lc = types.map((x) => String(x).toLowerCase());
      if (lc.includes("vehicle") || lc.includes("car") || lc.includes("product")) hits.push(n);
    }

    for (const k of Object.keys(n)) walk(n[k]);
  };
  walk(obj);
  return hits;
}
function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = (v ?? "").toString().trim();
    if (s) return s;
  }
  return "";
}
function extractByRegex(html, re) {
  const m = re.exec(html);
  return (m?.[1] || "").replace(/\s+/g, " ").trim();
}
function extractVehicle(html, finalUrl) {
  const vehicle = {
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
    location: "",
    url: finalUrl || "",
    featuresText: "",
  };

  const ogTitle = extractMeta(html, "og:title");
  const desc = extractMeta(html, "description");
  vehicle.title = firstNonEmpty(
    ogTitle,
    extractByRegex(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
  );

  // JSON-LD
  const jsonlds = extractLdJsonObjects(html);
  for (const block of jsonlds) {
    const hits = findVehicleInJsonLd(block);
    for (const h of hits) {
      vehicle.title = firstNonEmpty(vehicle.title, h.name, h.model, h.vehicleModel, h.description);
      vehicle.vin = firstNonEmpty(vehicle.vin, h.vehicleIdentificationNumber, h.vin, h.sku);
      vehicle.stock = firstNonEmpty(vehicle.stock, h.sku, h.mpn, h.stockNumber);

      const offers = h.offers || h.offer || null;
      if (offers) {
        const o = Array.isArray(offers) ? offers[0] : offers;
        vehicle.price = firstNonEmpty(vehicle.price, o.price, o.priceSpecification?.price);
      }

      const odo =
        h.mileageFromOdometer ||
        h.mileage ||
        h.vehicleMileage ||
        h.odometerReading ||
        null;
      if (odo) {
        if (typeof odo === "string") vehicle.mileage = firstNonEmpty(vehicle.mileage, odo);
        else if (typeof odo === "object") {
          vehicle.mileage = firstNonEmpty(vehicle.mileage, odo.value, odo.valueText);
        }
      }

      vehicle.exterior = firstNonEmpty(vehicle.exterior, h.color, h.exteriorColor);
      vehicle.interior = firstNonEmpty(vehicle.interior, h.interiorColor);

      vehicle.engine = firstNonEmpty(vehicle.engine, h.vehicleEngine?.name, h.engine);
      vehicle.transmission = firstNonEmpty(vehicle.transmission, h.vehicleTransmission, h.transmission);
      vehicle.drivetrain = firstNonEmpty(vehicle.drivetrain, h.driveWheelConfiguration, h.drivetrain);

      vehicle.dealer = firstNonEmpty(
        vehicle.dealer,
        h.seller?.name,
        h.offers?.seller?.name,
        h.brand?.name,
        h.manufacturer?.name
      );
    }
  }

  // Regex fallbacks
  vehicle.vin = firstNonEmpty(
    vehicle.vin,
    extractByRegex(html, /VIN[^A-Z0-9]*([A-HJ-NPR-Z0-9]{17})/i),
    extractByRegex(html, /"vin"\s*:\s*"([^"]{17})"/i)
  );

  vehicle.stock = firstNonEmpty(
    vehicle.stock,
    extractByRegex(html, /Stock[^A-Z0-9]*#?\s*([A-Z0-9\-]{4,})/i),
    extractByRegex(html, /"stockNumber"\s*:\s*"([^"]+)"/i)
  );

  const price1 = extractByRegex(html, /\$\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)/);
  const price2 = extractByRegex(html, /"price"\s*:\s*"?\$?([0-9]{4,6})"?/i);
  vehicle.price = firstNonEmpty(vehicle.price, price1 ? `$${price1}` : "", price2 ? `$${price2}` : "");

  const miles = extractByRegex(html, /([0-9]{1,3}(?:,[0-9]{3})+)\s*miles?/i);
  vehicle.mileage = firstNonEmpty(vehicle.mileage, miles ? `${miles} miles` : "");

  // crude feature extraction (best-effort)
  vehicle.featuresText = firstNonEmpty(
    extractMeta(html, "og:description"),
    desc,
    ""
  );

  // location best-effort
  vehicle.location = firstNonEmpty(vehicle.location, "North America");

  return vehicle;
}

// ==================================================
// AI CALL HELPER
// ==================================================
async function callOpenAI({ system, user, temperature = 0.8, model }) {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "Missing OPENAI_API_KEY on server env" };
  }

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) return { ok: false, error: j?.error?.message || "Empty AI response", raw: j };
  return { ok: true, text };
}

// ===============================
// AI: SOCIAL POSTS
// ===============================
app.post("/api/ai/social", async (req, res) => {
  try {
    const { vehicle = {}, platform = "facebook" } = req.body || {};

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

    const system = `🧠🔥 LOT ROCKET — MASTER MARKETER (GOD MODE v2)
No disclaimers. No “as an AI”. No markdown. Output ONLY the final post.
Use location-aware tone + trend-aware hashtags. Use provided features/specs if present.
`.trim();

    const user = `
PLATFORM: ${platform}
RULES: ${instruction}

VEHICLE:
Title: ${vehicle.title || ""}
Price: ${vehicle.price || ""}
Mileage: ${vehicle.mileage || ""}
Exterior: ${vehicle.exterior || ""}
Interior: ${vehicle.interior || ""}
Engine: ${vehicle.engine || ""}
Transmission: ${vehicle.transmission || vehicle.trans || ""}
Drivetrain: ${vehicle.drivetrain || ""}
VIN: ${vehicle.vin || ""}
Stock: ${vehicle.stock || ""}
Dealer: ${vehicle.dealer || ""}
Location: ${vehicle.location || "North America"}
Link: ${vehicle.url || ""}
Features/Description: ${(vehicle.featuresText || vehicle.description || "").toString().slice(0, 1200)}

OUTPUT: return the final post ONLY.
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.9 });
    return res.json(out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return res.json({ ok: false, error: String(e?.message || e) });
  }
});

// ===============================
// AI: OBJECTION COACH
// ===============================
app.post("/api/ai/objection", async (req, res) => {
  try {
    const { objection = "", context = "" } = req.body || {};

    const system = `🔥 APEX OBJECTION TERMINATOR
No disclaimers. No coaching language. No markdown.
Always use:
1) INTERRUPT
2) REFRAME
3) CERTIFY
4) CLOSE THE GAP
`.trim();

    const user = `
OBJECTION:
${objection}

CONTEXT:
${context}

Respond now using the 4-step format.
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.85 });
    return res.json(out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return res.json({ ok: false, error: String(e?.message || e) });
  }
});

// ===============================
// AI: MESSAGE BUILDER
// ===============================
app.post("/api/ai/message", async (req, res) => {
  try {
    const { goal = "", tone = "", details = "" } = req.body || {};
    const system = `You write short high-reply sales messages. Human. Direct. Clear CTA. No filler.`.trim();
    const user = `GOAL: ${goal}\nTONE: ${tone}\nDETAILS:\n${details}`.trim();
    const out = await callOpenAI({ system, user, temperature: 0.8 });
    return res.json(out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return res.json({ ok: false, error: String(e?.message || e) });
  }
});

// ===============================
// AI: WORKFLOW EXPERT
// ===============================
app.post("/api/ai/workflow", async (req, res) => {
  try {
    const { scenario = "" } = req.body || {};
    const system = `You build step-by-step automotive sales workflows. Tight steps. Clear order. Clear CTA.`.trim();
    const user = scenario || "";
    const out = await callOpenAI({ system, user, temperature: 0.7 });
    return res.json(out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return res.json({ ok: false, error: String(e?.message || e) });
  }
});

// ===============================
// AI: ASK AI
// ===============================
app.post("/api/ai/ask", async (req, res) => {
  try {
    const system = `Answer clearly and accurately. No fluff.`.trim();
    const user = (req.body && (req.body.question || req.body.q)) || "";
    const out = await callOpenAI({ system, user, temperature: 0.6 });
    return res.json(out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return res.json({ ok: false, error: String(e?.message || e) });
  }
});

// ===============================
// AI: CAR EXPERT
// ===============================
app.post("/api/ai/car", async (req, res) => {
  try {
    const { vehicle = "", question = "" } = req.body || {};
    const system = `You are a master automotive expert. Give practical, confident answers.`.trim();
    const user = `${vehicle}\n\nQ: ${question}`.trim();
    const out = await callOpenAI({ system, user, temperature: 0.7 });
    return res.json(out.ok ? { ok: true, text: out.text } : out);
  } catch (e) {
    return res.json({ ok: false, error: String(e?.message || e) });
  }
});

// ===============================
// API: BOOST (STABLE CONTRACT)
// GET /api/boost?url=...
// Returns: { ok, finalUrl, title, images, vehicle, meta, error }
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
    vehicle: null,
    meta: { ms: 0, counts: {}, notes: [] },
    error: null,
  };

  if (!target) {
    out.meta.ms = Date.now() - started;
    out.error = "Missing or invalid url parameter";
    return res.status(400).json(out);
  }

  try {
    console.log("✅ /api/boost HIT", target);

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

    const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    out.title = (t?.[1] || "").replace(/\s+/g, " ").trim();

    const base = out.finalUrl || target;

    out.vehicle = extractVehicle(html, base);
    out.vehicle.url = out.vehicle.url || base;
    out.vehicle.title = out.vehicle.title || out.title || "";

    const og = extractOgImage(html, base);
    const imgs = extractImgs(html, base);

    // JSON-LD images
    const ldObjs = extractLdJsonObjects(html);
    const ldImgs = [];
    for (const o of ldObjs) {
      const walk = (node) => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node === "object") {
          const candidates = [];
          if (node.image) candidates.push(node.image);
          if (node.images) candidates.push(node.images);
          if (node.thumbnailUrl) candidates.push(node.thumbnailUrl);
          if (node.contentUrl) candidates.push(node.contentUrl);

          for (const c of candidates) {
            if (Array.isArray(c)) c.forEach((x) => typeof x === "string" && ldImgs.push(absUrl(base, x)));
            else if (typeof c === "string") ldImgs.push(absUrl(base, c));
            else if (c && typeof c === "object" && c.url) ldImgs.push(absUrl(base, c.url));
          }
          for (const k of Object.keys(node)) walk(node[k]);
        }
      };
      walk(o);
    }

    const merged = uniq([].concat(og, ldImgs, imgs));

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
      return !!u && !isProbablyJunkImage(u) && okExt;
    });

    out.images = uniq(filtered).slice(0, 60);

    out.meta.counts = {
      og: og.length,
      ldImgs: ldImgs.length,
      imgAttrs: imgs.length,
      merged: merged.length,
      final: out.images.length,
    };

    out.meta.ms = Date.now() - started;
    out.ok = true;

    console.log("BOOST", out.images.length, "imgs", "ms=" + out.meta.ms, "url=" + target);
    return res.json(out);
  } catch (e) {
    out.meta.ms = Date.now() - started;
    out.error = (e && e.message) || "Boost failed";
    console.error("BOOST_FAIL", out.error, "url=" + target);
    return res.status(500).json(out);
  }
});

// ===============================
// FALLBACK (MUST BE LAST)
// ===============================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
