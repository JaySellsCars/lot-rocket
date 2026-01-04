// /server/server.js  (REPLACE ENTIRE FILE)
// LOT ROCKET — BOOT-SAFE SERVER (Render-ready)
// JS ONLY. No HTML in this file.

"use strict";

const express = require("express");
const path = require("path");

// If cheerio isn't installed, run: npm i cheerio
let cheerio = null;
try {
  cheerio = require("cheerio");
} catch (e) {
  console.warn("⚠️ cheerio not installed. /api/boost will return empty images until installed.");
}

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
// HEALTH
// ===============================
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "lot-rocket", ts: Date.now() });
});
// ===============================
// AI ROUTES (MUST RETURN JSON)
// ===============================

// If your frontend posts to /api/ai
app.post("/api/ai", async (req, res) => {
  // TEMP SAFE RESPONSE (keeps UI alive). Replace with OpenAI code when ready.
  res.json({
    ok: false,
    error: "AI route not wired on server yet",
    hint: "Restore your OpenAI handler here",
    got: req.body || null,
  });
});

// If your frontend posts to /api/ai/generate
app.post("/api/ai/generate", async (req, res) => {
  res.json({
    ok: false,
    error: "AI generate route not wired on server yet",
    hint: "Restore your OpenAI handler here",
    got: req.body || null,
  });
});

// HARD GUARD: never serve HTML for /api/*
// (prevents 'returned non-JSON' forever)
app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, error: "Unknown API route", path: req.path });
});

// ===============================
// AI PING (frontend sanity)
// ===============================
app.get("/api/ai/ping", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ==================================================
// HELPERS
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
    if (maybe.startsWith("data:")) return "";
    if (maybe.startsWith("//")) return "https:" + maybe;
    return new URL(maybe, base).toString();
  } catch {
    return "";
  }
}

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

async function fetchText(url, headers = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);

  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        ...headers,
      },
    });

    const contentType = (r.headers.get("content-type") || "").toLowerCase();
    const text = await r.text();

    return {
      ok: r.ok,
      status: r.status,
      contentType,
      text,
    };
  } finally {
    clearTimeout(t);
  }
}

// ==================================================
// API: BOOST (scrape images from dealer URL)
// GET /api/boost?url=...&debug=1
// ==================================================
app.get("/api/boost", async (req, res) => {
  const url = safeUrl(req.query.url || "");
  const debug = String(req.query.debug || "") === "1";

  if (!url) {
    return res.status(400).json({
      ok: false,
      error: "Missing url",
      images: [],
      debug: debug ? { reason: "no-url" } : undefined,
    });
  }

  // If cheerio missing, return graceful empty response
  if (!cheerio) {
    return res.json({
      ok: true,
      vehicle: { url, title: "Dealer Website", description: "", price: "", mileage: "", vin: "", stock: "" },
      images: [],
      debug: debug
        ? { status: 200, contentType: "n/a", imageCount: 0, note: "cheerio missing" }
        : undefined,
    });
  }

  try {
    const r = await fetchText(url);

    // VarsityFord / many dealers block server scraping -> 403 (NOT A CODE BUG)
    if (!r.ok) {
      return res.json({
        ok: true,
        vehicle: { url, title: "Dealer Website", description: "", price: "", mileage: "", vin: "", stock: "" },
        images: [],
        debug: debug
          ? { status: r.status, contentType: r.contentType, imageCount: 0 }
          : undefined,
      });
    }

    // Only attempt parse if it's HTML-ish
    if (!r.contentType.includes("text/html") && !r.contentType.includes("application/xhtml")) {
      return res.json({
        ok: true,
        vehicle: { url, title: "Dealer Website", description: "", price: "", mileage: "", vin: "", stock: "" },
        images: [],
        debug: debug
          ? { status: r.status, contentType: r.contentType, imageCount: 0, note: "non-html" }
          : undefined,
      });
    }

    const $ = cheerio.load(r.text);
// --------- JSON-LD VEHICLE PARSE (best-effort) ----------
function pick(obj, keys) {
  for (const k of keys) {
    const v = obj && obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function parseJsonLdVehicles() {
  const out = { price:"", mileage:"", vin:"", stock:"" };

  const scripts = [];
  $("script[type='application/ld+json']").each((_, el) => {
    const t = ($(el).text() || "").trim();
    if (t) scripts.push(t);
  });

  for (const raw of scripts) {
    let data;
    try { data = JSON.parse(raw); } catch { continue; }
    const items = Array.isArray(data) ? data : [data];

    for (const it of items) {
      const node = it && it["@graph"] ? it["@graph"] : [it];
      for (const x of node) {
        const type = (x && x["@type"]) ? String(x["@type"]).toLowerCase() : "";

        // Many dealers use "Vehicle" or embed offers inside it
        if (type.includes("vehicle") || type.includes("product")) {
          const offers = x.offers || {};
          const offer0 = Array.isArray(offers) ? offers[0] : offers;

          out.price =
            out.price ||
            String(pick(offer0, ["price", "lowPrice", "highPrice", "priceSpecification"]) || "").replace(/[^\d.]/g,"");

          const odo = x.mileageFromOdometer || x.mileage || x.odo || {};
          if (!out.mileage) {
            if (typeof odo === "number") out.mileage = String(odo);
            else if (odo && typeof odo === "object") out.mileage = String(pick(odo, ["value"]) || "");
          }

          out.vin = out.vin || String(pick(x, ["vehicleIdentificationNumber", "vin"]) || "");
          out.stock = out.stock || String(pick(x, ["sku", "stockNumber", "stock"]) || "");
        }
      }
    }
  }

  // normalize
  out.price = out.price ? `$${Number(out.price).toLocaleString()}` : "";
  out.mileage = out.mileage ? `${Number(out.mileage).toLocaleString()} mi` : "";

  return out;
}

const ld = parseJsonLdVehicles();

    // --------- VEHICLE BASICS (best-effort) ----------
    const title =
      ($("meta[property='og:title']").attr("content") || "").trim() ||
      ($("title").text() || "Dealer Website").trim();

    const description =
      ($("meta[property='og:description']").attr("content") || "").trim() ||
      ($("meta[name='description']").attr("content") || "").trim() ||
      "";

    // --------- IMAGES (best-effort) ----------
    const imgs = [];

    // og:image first
    const ogImg = $("meta[property='og:image']").attr("content");
    if (ogImg) imgs.push(absUrl(url, ogImg));

    // common gallery selectors
    $("img").each((_, el) => {
      const src =
        $(el).attr("data-src") ||
        $(el).attr("data-lazy") ||
        $(el).attr("data-original") ||
        $(el).attr("src") ||
        "";
      const u = absUrl(url, src);
      if (!u) return;

      // filter obvious sprites/icons
      const low = u.toLowerCase();
      if (low.includes("sprite") || low.includes("logo") || low.includes("icon")) return;

      imgs.push(u);
    });

    const images = uniq(imgs).slice(0, 60);

    return res.json({
      ok: true,
      vehicle: { url, title, description, price: ld.price || "", mileage: ld.mileage || "", vin: ld.vin || "", stock: ld.stock || "" },

      images,
      debug: debug ? { status: r.status, contentType: r.contentType, imageCount: images.length } : undefined,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Boost failed",
      images: [],
      debug: debug ? { message: String(err?.message || err) } : undefined,
    });
  }
});

// ===============================
// FALLBACK: SPA ROUTE
// ===============================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ===============================
// START
// ===============================
app.listen(PORT, () => {
  console.log("✅ Lot Rocket server listening on", PORT);
});
