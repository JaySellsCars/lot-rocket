// app.js
// Lot Rocket – Social Media Post Kit for Automotive Salespeople
// Viral mode + EV/PHEV logic + Auto iPacket handling + fallback URL parsing

const express = require("express");
const cheerio = require("cheerio");

const app = express();
app.use(express.json({ limit: "5mb" }));

// ---------- FRONTEND ----------
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Lot Rocket – Social Media Post Kit</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #050505; color: #f5f5f5; }
    .app { max-width: 1000px; margin: 0 auto; padding: 32px 16px 96px; }
    h1 { font-size: 2rem; margin-bottom: 4px; }
    h1 span.brand { color: #ff3232; }
    p.sub { color: #aaa; margin-top: 0; }
    .card { background: #111; border-radius: 16px; padding: 20px; border: 1px solid #333; margin-top: 16px; }
    label { display: block; font-weight: 600; margin-bottom: 6px; }
    input[type="text"] {
      width: 100%; padding: 12px 14px; border-radius: 10px;
      border: 1px solid #333; background: #050505; color: #f5f5f5;
      font-size: 1rem;
    }
    input:focus { outline: 1px solid #ff3232; border-color: #ff3232; }
    button {
      border: none; border-radius: 999px; padding: 10px 16px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 6px;
      cursor: pointer; margin-top: 10px; font-size: 0.95rem;
      background: linear-gradient(135deg, #ff3232, #ff7b32); color: #fff;
      box-shadow: 0 8px 16px rgba(255, 50, 50, 0.4);
      transition: transform 0.08s ease, box-shadow 0.08s ease;
    }
    button:hover { transform: translateY(-1px); box-shadow: 0 12px 22px rgba(255, 50, 50, 0.6); }
    button:disabled { opacity: 0.4; cursor: default; box-shadow: none; transform: none; }
    .primary-btn { width: 100%; justify-content: center; }

    .pill {
      display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem;
      padding: 5px 10px; border-radius: 999px; background: #181818; color: #ccc;
    }
    .copy-box {
      background: #050505; border-radius: 12px; padding: 12px;
      border: 1px solid #333; white-space: pre-wrap;
      font-size: 0.9rem; min-height: 60px;
    }
    .small { font-size: 0.8rem; color: #777; margin-top: 8px; }
    .card-header {
      display: flex; justify-content: space-between; align-items: center;
      gap: 10px; flex-wrap: wrap;
    }
    .card-header button {
      margin-top: 0;
      box-shadow: none;
      padding: 6px 10px;
      font-size: 0.8rem;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }

    .copy-all-btn {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: 16px;
      width: min(480px, calc(100% - 32px));
      z-index: 50;
      justify-content: center;
    }

    @media (max-width: 768px) {
      body { font-size: 16px; }
      h1 { font-size: 1.6rem; }
      .app { padding: 24px 12px 96px; }
      .card { padding: 16px; }
    }

    @media (min-width: 769px) {
      .copy-all-btn { display: none; }
    }

    @media (max-width: 768px) {
      .copy-all-btn { display: inline-flex; }
    }
  </style>
</head>
<body>
  <div class="app">
    <h1><span class="brand">Lot Rocket</span> Social Media Kit</h1>
    <p class="sub">Paste a vehicle URL. Get ready-to-use posts for Facebook, Instagram, TikTok, LinkedIn, X, Marketplace, text/DM – plus a viral video script & shot plan. 🔥</p>

    <div class="card">
      <form id="lotrocket-form">
        <label for="url">Dealer vehicle URL</label>
        <input id="url" type="text" placeholder="Paste a full link from a vehicle details page" />
        <button type="submit" class="primary-btn">🚀 Boost This Listing</button>
      </form>
      <div id="status" class="small"></div>
      <div id="vehicle-summary" class="small" style="margin-top:6px; color:#ccc;"></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="pill">📘 Facebook Post</div>
          <button type="button" data-copy-target="fb-output">📋 Copy</button>
        </div>
        <div id="fb-output" class="copy-box">Your Facebook post will appear here.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="pill">📸 Instagram Caption</div>
          <button type="button" data-copy-target="ig-output">📋 Copy</button>
        </div>
        <div id="ig-output" class="copy-box">Your Instagram caption will appear here.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="pill">🎵 TikTok Caption</div>
          <button type="button" data-copy-target="tt-output">📋 Copy</button>
        </div>
        <div id="tt-output" class="copy-box">Your TikTok caption will appear here.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="pill">💼 LinkedIn Post</div>
          <button type="button" data-copy-target="li-output">📋 Copy</button>
        </div>
        <div id="li-output" class="copy-box">Your LinkedIn post will appear here.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="pill">🐦 X / Twitter Post</div>
          <button type="button" data-copy-target="tw-output">📋 Copy</button>
        </div>
        <div id="tw-output" class="copy-box">Your X/Twitter post will appear here.</div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="pill">💬 Text / DM Blurb</div>
          <button type="button" data-copy-target="sms-output">📋 Copy</button>
        </div>
        <div id="sms-output" class="copy-box">Your short message will appear here.</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="pill">🛒 Facebook Marketplace Description</div>
        <button type="button" data-copy-target="mp-output">📋 Copy</button>
      </div>
      <div id="mp-output" class="copy-box">Your Facebook Marketplace description will appear here.</div>
      <p class="small">
        Use this in the Marketplace description box. For the title, use something like
        “YEAR MAKE MODEL – Clean, Sharp & Ready to Go!”.
      </p>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="pill">🏷 Hashtags</div>
        <button type="button" data-copy-target="hashtags-output">📋 Copy</button>
      </div>
      <div id="hashtags-output" class="copy-box">Hashtags will appear here.</div>
      <p class="small">Use these on Instagram, TikTok, and X. You can always add store-specific tags or location tags.</p>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="pill">🎥 Viral Video Script</div>
        <button type="button" data-copy-target="video-script-output">📋 Copy</button>
      </div>
      <div id="video-script-output" class="copy-box">Your viral video script will appear here.</div>
      <p class="small">Read this on camera for Reels, TikTok, Shorts, or Facebook Reels.</p>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="pill">👀 Viral Visual Shot Plan</div>
        <button type="button" data-copy-target="shot-plan-output">📋 Copy</button>
      </div>
      <div id="shot-plan-output" class="copy-box">Your viral shot plan will appear here.</div>
      <p class="small">Follow these shots so your video looks clean, confident, and high-impact.</p>
    </div>

    <p class="small">Prototype – full image and automatic video creation will come in a later version. For now, use this as your “done-for-you” social copy engine.</p>

    <button type="button" id="copy-all-btn" class="copy-all-btn">📋 Copy All Posts</button>
  </div>

  <script>
    const form = document.getElementById("lotrocket-form");
    const statusEl = document.getElementById("status");
    const vehicleSummaryEl = document.getElementById("vehicle-summary");

    const fbEl = document.getElementById("fb-output");
    const igEl = document.getElementById("ig-output");
    const ttEl = document.getElementById("tt-output");
    const liEl = document.getElementById("li-output");
    const twEl = document.getElementById("tw-output");
    const smsEl = document.getElementById("sms-output");
    const mpEl = document.getElementById("mp-output");
    const hashtagsEl = document.getElementById("hashtags-output");
    const videoScriptEl = document.getElementById("video-script-output");
    const shotPlanEl = document.getElementById("shot-plan-output");
    const copyAllBtn = document.getElementById("copy-all-btn");

    window.addEventListener("load", function () {
      const urlInput = document.getElementById("url");
      if (urlInput) {
        try { urlInput.focus(); } catch (e) {}
      }
    });

    async function handleCopy(targetId) {
      const el = document.getElementById(targetId);
      if (!el) return;
      const text = el.textContent || "";
      if (!text.trim()) {
        statusEl.textContent = "Nothing to copy yet.";
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        statusEl.textContent = "Copied to clipboard ✅";
      } catch (e) {
        console.error(e);
        statusEl.textContent = "Could not copy automatically – select and copy manually.";
      }
    }

    async function handleCopyAll() {
      const blocks = [
        { label: "Facebook", el: fbEl },
        { label: "Instagram", el: igEl },
        { label: "TikTok", el: ttEl },
        { label: "LinkedIn", el: liEl },
        { label: "X / Twitter", el: twEl },
        { label: "Text / DM", el: smsEl },
        { label: "Marketplace", el: mpEl },
        { label: "Hashtags", el: hashtagsEl },
        { label: "Viral Video Script", el: videoScriptEl },
        { label: "Viral Shot Plan", el: shotPlanEl }
      ];

      const chunks = [];
      blocks.forEach(function (b) {
        if (!b.el) return;
        const text = (b.el.textContent || "").trim();
        if (!text) return;
        chunks.push("=== " + b.label + " ===\\n" + text);
      });

      if (!chunks.length) {
        statusEl.textContent = "Nothing to copy yet.";
        return;
      }

      const full = chunks.join("\\n\\n");
      try {
        await navigator.clipboard.writeText(full);
        statusEl.textContent = "All posts copied ✅";
      } catch (e) {
        console.error(e);
        statusEl.textContent = "Could not copy automatically – select and copy manually.";
      }
    }

    document.querySelectorAll("button[data-copy-target]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const target = btn.getAttribute("data-copy-target");
        handleCopy(target);
      });
    });

    if (copyAllBtn) {
      copyAllBtn.addEventListener("click", function () {
        handleCopyAll();
      });
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const urlInput = document.getElementById("url");
      const url = urlInput.value.trim();

      if (!url) {
        statusEl.textContent = "Please paste a full vehicle URL.";
        return;
      }

      statusEl.textContent = "Building your social kit...";
      vehicleSummaryEl.textContent = "";
      fbEl.textContent = "";
      igEl.textContent = "";
      ttEl.textContent = "";
      liEl.textContent = "";
      twEl.textContent = "";
      smsEl.textContent = "";
      mpEl.textContent = "";
      hashtagsEl.textContent = "";
      videoScriptEl.textContent = "";
      shotPlanEl.textContent = "";

      try {
        const res = await fetch("/api/process-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url })
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Server error");
        }

        const data = await res.json();

        fbEl.textContent = (data.posts && data.posts.facebook) || "No Facebook post generated.";
        igEl.textContent = (data.posts && data.posts.instagram) || "No Instagram caption generated.";
        ttEl.textContent = (data.posts && data.posts.tiktok) || "No TikTok caption generated.";
        liEl.textContent = (data.posts && data.posts.linkedin) || "No LinkedIn post generated.";
        twEl.textContent = (data.posts && data.posts.twitter) || "No X/Twitter post generated.";
        smsEl.textContent = (data.posts && data.posts.sms) || "No short message generated.";
        mpEl.textContent = (data.posts && data.posts.marketplace) || "No Marketplace description generated.";
        hashtagsEl.textContent = (data.posts && data.posts.hashtags) || "";
        videoScriptEl.textContent = (data.posts && data.posts.videoScript) || "No video script generated.";
        shotPlanEl.textContent = (data.posts && data.posts.shotPlan) || "No shot plan generated.";

        if (data.vehicle) {
          const v = data.vehicle;
          const title = v.title || "Vehicle";
          const price = v.price ? "Price: " + v.price : "";
          vehicleSummaryEl.textContent = title + (price ? " • " + price : "");
        }

        statusEl.textContent = "Social kit ready. Review, tweak, and post. 💪";
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Error: " + (err.message || "Something went wrong.");
      }
    });
  </script>
</body>
</html>`);
});

// ---------- HELPERS ----------

function cleanTitle(rawTitle) {
  if (!rawTitle) return "Vehicle";
  let t = rawTitle;

  // drop dealer/location after |
  t = t.split("|")[0];

  // drop VIN-like strings
  t = t.replace(/[A-HJ-NPR-Z0-9]{11,17}/g, " ");

  // drop trailing "for sale in/near ..."
  t = t.replace(/\bfor sale in\b.*$/i, "");
  t = t.replace(/\bfor sale near\b.*$/i, "");

  // split stuck words: JeepGrand -> Jeep Grand
  t = t.replace(/([a-z])([A-Z])/g, "$1 $2");

  t = t.replace(/\s{2,}/g, " ").trim();
  return t || "Vehicle";
}

function cleanPrice(raw) {
  if (!raw) return "";
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return "";

  const dollarLine = lines.find((l) => /\$\s*\d/.test(l));
  if (dollarLine) return dollarLine;

  const numericLine = lines.find((l) => /\d/.test(l) && !/^price$/i.test(l));
  if (numericLine) return numericLine;

  return "Message for current pricing";
}

// Parse fallback info from URL when scraping is blocked or weak
function fallbackFromUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname || "";
    const parts = path.split(/[-/]+/).filter(Boolean); // handle "-"/"/"
    if (!parts.length) {
      return {
        title: "Vehicle",
        year: "",
        makeModel: "",
        price: "",
        condition: ""
      };
    }

    // try to find the year token
    let year = "";
    let yearIndex = -1;
    for (let i = 0; i < parts.length; i++) {
      if (/^(19|20)\d{2}$/.test(parts[i])) {
        year = parts[i];
        yearIndex = i;
        break;
      }
    }

    let make = "";
    let modelTokens = [];

    if (yearIndex !== -1) {
      if (parts[yearIndex + 1]) make = parts[yearIndex + 1];
      for (let i = yearIndex + 2; i < parts.length; i++) {
        const token = parts[i];
        // stop at VIN-like token
        if (/^[A-HJ-NPR-Z0-9]{11,17}$/.test(token)) break;
        modelTokens.push(token);
      }
    }

    const makeModel = [make, ...modelTokens].filter(Boolean).join(" ");
    const title =
      (year ? year + " " : "") +
      (makeModel || "Vehicle");

    // crude condition from path words
    const lowerPath = path.toLowerCase();
    let condition = "";
    if (lowerPath.includes("certified")) condition = "Certified Pre-Owned";
    else if (lowerPath.includes("used")) condition = "Used";
    else if (lowerPath.includes("new")) condition = "New";

    return {
      title: title || "Vehicle",
      year: year || "",
      makeModel: makeModel || "",
      price: "",
      condition
    };
  } catch {
    return {
      title: "Vehicle",
      year: "",
      makeModel: "",
      price: "",
      condition: ""
    };
  }
}

// ---------- SCRAPE VEHICLE DATA (with BLOCK DETECTION + FALLBACK) ----------

async function scrapeVehicle(url) {
  // Reject direct Auto iPacket URLs, but NOT dealer pages that just mention Auto iPacket
  try {
    const u = new URL(url);
    const host = (u.hostname || "").toLowerCase();
    if (host.includes("autoipacket")) {
      throw new Error("UNSUPPORTED_LINK");
    }
  } catch (e) {
    // ignore parse errors
  }

  const urlFallback = fallbackFromUrl(url);

  try {
    const resp = await fetch(url);
    const html = await resp.text();
    const $ = cheerio.load(html);

    const pageTitle = $("title").text().toLowerCase();
    const pageText = $("body").text().toLowerCase();

    const blockedPhrases = [
      "sorry, you have been blocked",
      "access denied",
      "request blocked",
      "forbidden",
      "bot detected",
      "captcha"
    ];

    // If site is clearly blocking bots, fall back to URL-based info instead of erroring
    if (blockedPhrases.some((p) => pageTitle.includes(p) || pageText.includes(p))) {
      return {
        ...urlFallback,
        price: urlFallback.price || "Message for current pricing"
      };
    }

    const rawTitle =
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      urlFallback.title ||
      "Vehicle";

    const rawPrice =
      $('[class*="price"]').first().text().trim() ||
      $('meta[itemprop="price"]').attr("content") ||
      "";

    const cleanedTitle = cleanTitle(rawTitle);
    const price = cleanPrice(rawPrice) || urlFallback.price || "Message for current pricing";

    const yearMatch = cleanedTitle.match(/(20\\d{2}|19\\d{2})/);
    const year = yearMatch ? yearMatch[1] : urlFallback.year;

    const lowerTitle = cleanedTitle.toLowerCase();
    let condition = "";
    if (/\bnew\b/.test(lowerTitle)) {
      condition = "New";
    } else if (/certified|cpo/.test(lowerTitle)) {
      condition = "Certified Pre-Owned";
    } else if (/pre[-\\s]?owned/.test(lowerTitle) || /\bused\b/.test(lowerTitle)) {
      condition = "Pre-Owned";
    }
    if (!condition && urlFallback.condition) condition = urlFallback.condition;

    let makeModel = year
      ? cleanedTitle.replace(year, "").trim()
      : cleanedTitle;

    if (condition) {
      const condRegex = new RegExp("\\\\b" + condition.replace(/\\s+/g, "\\\\s+") + "\\\\b", "i");
      makeModel = makeModel.replace(condRegex, " ");
    }

    makeModel = makeModel.replace(/\\b(new|used|pre[-\\s]?owned|certified|cpo)\\b/gi, " ");
    makeModel = makeModel.replace(/\\s{2,}/g, " ").trim();

    if (!makeModel && urlFallback.makeModel) {
      makeModel = urlFallback.makeModel;
    }

    return {
      title: cleanedTitle || urlFallback.title || "Vehicle",
      year: year || urlFallback.year || "",
      makeModel: makeModel || urlFallback.makeModel || "",
      price,
      condition
    };
  } catch (e) {
    if (e.message === "UNSUPPORTED_LINK") throw e;

    // Network or parsing failure: fall back to URL-based info
    return {
      ...urlFallback,
      price: urlFallback.price || "Message for current pricing"
    };
  }
}

// ---------- FEATURE STACK (with EV / PHEV / HYBRID awareness) ----------

function classifyVehicle(vehicle) {
  const nameLower = (
    ((vehicle.year || "") + " " + (vehicle.makeModel || "")).toLowerCase()
  ).trim();

  const truckSuvKeywords = [
    "tahoe","suburban","silverado","sierra","ram","f-150","f150","bronco","explorer",
    "traverse","highlander","4runner","durango","tacoma","ridgeline","wrangler","gladiator",
    "grand cherokee","escape","equinox","ascent","pilot","telluride","seltos","palisade",
    "outlander","cr-v","crv","rav4","rav-4","acadia","blazer","trailblazer"
  ];

  const luxuryKeywords = [
    "bmw","mercedes","amg","audi","lexus","infiniti","acura","volvo","cadillac","lincoln",
    "genesis","porsche","jaguar","land rover","range rover","aston martin","maserati","bentley"
  ];

  const sportyKeywords = [
    "m3","m4","m5","m2","type s","sti","ss","gt","sport","srt","rs","si","z","nismo",
    "mustang","camaro","corvette","challenger","charger","gr","z06"
  ];

  const isTruckOrSuv = truckSuvKeywords.some((k) => nameLower.includes(k));
  const isLuxury = luxuryKeywords.some((k) => nameLower.includes(k));
  const isSporty = sportyKeywords.some((k) => nameLower.includes(k));

  const isPhev = /phev|plug[-\\s]?in|plug in|plug-in/.test(nameLower);
  const isHybrid = /\\bhybrid\\b/.test(nameLower) && !isPhev;
  const isEv = /\\bev\\b/.test(nameLower) || /electric/.test(nameLower);

  return { isTruckOrSuv, isLuxury, isSporty, isPhev, isHybrid, isEv };
}

function generateFeatureStack(vehicle) {
  const baseLabel =
    (vehicle.year ? vehicle.year + " " : "") + (vehicle.makeModel || "this vehicle");

  const { isTruckOrSuv, isLuxury, isSporty, isPhev, isHybrid, isEv } =
    classifyVehicle(vehicle);

  let baseFeatures;

  if (isTruckOrSuv && isLuxury) {
    baseFeatures = [
      "Confident all-weather capability with a composed, stable feel",
      "Upscale cabin with quality materials and a strong first impression",
      "Comfortable seating that works for real family and everyday use",
      "Modern touchscreen with premium smartphone integration feel",
      "Backup camera and driver-assist tech that make it easy to maneuver",
      "Refined ride – quiet, solid, and controlled at speed",
      "Plenty of space for people, gear, and weekend life",
      "Road presence that actually gets noticed, not ignored",
      "Strong balance of power and efficiency for daily driving",
      "Exactly the kind of SUV serious buyers hold onto"
    ];
  } else if (isTruckOrSuv) {
    baseFeatures = [
      "Confident stance that looks right on the road and in the driveway",
      "Interior space that actually fits people, gear, and daily life",
      "Strong powertrain built to handle real-world driving and hauling",
      "Modern touchscreen with practical connectivity for everyday use",
      "Backup camera that makes parking and tight spots simple",
      "Ride quality that feels planted, not sloppy",
      "Ready for work, family duty, and weekend runs",
      "Comfortable enough for long days behind the wheel",
      "Smart storage and space use throughout the cabin",
      "A truck/SUV that feels ready for whatever you throw at it"
    ];
  } else if (isLuxury || isSporty) {
    baseFeatures = [
      "Clean, athletic exterior styling that stands out in traffic",
      "Cabin that feels upscale the second you sit down",
      "Strong, confident acceleration that makes merging and passing easy",
      "Precise steering and composed handling that feels dialed-in",
      "Modern infotainment with intuitive controls and phone integration",
      "Supportive seats that feel right on both short drives and long trips",
      "Quiet, refined ride that still feels connected to the road",
      "Fit-and-finish that makes it feel like a level-up from the average car",
      "Braking and handling that inspire confidence in bad conditions",
      "The kind of car that says you pay attention to what you drive"
    ];
  } else {
    baseFeatures = [
      "Clean, sharp exterior styling that still looks modern",
      "Comfortable seating that’s easy to live with every single day",
      "Practical fuel economy that makes sense for commuting and errands",
      "Modern touchscreen with straightforward smartphone connection",
      "Backup camera that makes parking and tight spots stress-free",
      "Smooth, quiet ride that doesn’t beat you up on rough roads",
      "Easy to drive, easy to park, easy to live with",
      "Controls and layout that make sense the first time you sit in it",
      "Great daily driver for work, school, or family runs",
      "Serious value for the money in this segment"
    ];
  }

  // Electrified layer on top
  if (isPhev) {
    const phevFeatures = [
      "Plug-in hybrid setup that gives you electric driving with gas backup for real-world range",
      "Lower fuel stops by using electricity for short trips and gas for the longer runs",
      "Smooth, quiet electric-feel driving around town",
      "Perfect for drivers who want SUV practicality with modern efficiency and tech"
    ];
    baseFeatures = phevFeatures.concat(baseFeatures);
  } else if (isHybrid) {
    const hybridFeatures = [
      "Hybrid system tuned for real-world efficiency without sacrificing drivability",
      "Noticeably fewer fuel stops compared to a traditional gas-only SUV",
      "Smooth, quiet power delivery that feels refined in daily use",
      "Ideal for drivers who want better mpg without changing their routine"
    ];
    baseFeatures = hybridFeatures.concat(baseFeatures);
  } else if (isEv) {
    const evFeatures = [
      "Full electric setup – no gas stops, just plug in and go",
      "Instant torque that makes it feel quick and responsive off the line",
      "Whisper-quiet driving that still feels confident and controlled",
      "Perfect for drivers who want modern tech, low running costs, and serious style"
    ];
    baseFeatures = evFeatures.concat(baseFeatures);
  }

  const selected = baseFeatures.slice(0, 10);

  return {
    label: baseLabel,
    bullets: selected
  };
}

// ---------- HASHTAGS ----------

function generateHashtags(vehicle) {
  const tags = new Set();

  const fullLabel = (
    (vehicle.year ? vehicle.year + " " : "") +
    (vehicle.makeModel || "")
  ).trim();

  const lowerLabel = fullLabel.toLowerCase();

  const { isTruckOrSuv, isSporty, isPhev, isHybrid, isEv } =
    classifyVehicle(vehicle);

  const stopWords = new Set([
    "for","sale","in","at","the","a","an","near","with","on","and","or","of",
    "this","all","wheel","drive","awd","fwd","rwd","4wd","4x4"
  ]);

  fullLabel.split(/\s+/).forEach((w) => {
    const clean = w.replace(/[^a-z0-9]/gi, "");
    if (!clean) return;
    const lower = clean.toLowerCase();
    if (stopWords.has(lower)) return;
    tags.add("#" + lower);
  });

  // Base engagement tags
  [
    "#carsforsale",
    "#carshopping",
    "#carbuying",
    "#cardeals",
    "#carsales",
    "#testdrive"
  ].forEach((t) => tags.add(t));

  // Type-based tags
  if (isTruckOrSuv) {
    tags.add("#suvforsale");
    tags.add("#familySUV");
  }
  if (isTruckOrSuv && /2500|3500|hd/.test(lowerLabel)) {
    tags.add("#truckforsale");
    tags.add("#worktruck");
  }
  if (isSporty) {
    tags.add("#sportscar");
    tags.add("#performancecar");
  }

  // Electrified tags
  if (isPhev) {
    tags.add("#hybrid");
    tags.add("#pluginhybrid");
  } else if (isHybrid) {
    tags.add("#hybrid");
  }
  if (isEv) {
    tags.add("#ev");
    tags.add("#electricvehicle");
  }

  return Array.from(tags).join(" ");
}

// ---------- SOCIAL POSTS + VIRAL SCRIPT ----------

function buildSocialPosts(vehicle, hashtags) {
  const price = vehicle.price || "Message for current pricing";
  const featureData = generateFeatureStack(vehicle);
  const baseLabel = featureData.label;
  const bullets = featureData.bullets;

  const label = vehicle.condition
    ? baseLabel + " – " + vehicle.condition
    : baseLabel;

  const featureLines = bullets.map((b) => "🔥 " + b).join("  \n");

  const fullString =
    (vehicle.title || "") + " " + (vehicle.makeModel || "") + " " + (vehicle.condition || "");
  const isCertified = /certified|cpo/i.test(fullString);

  const certifiedLineLong = isCertified
    ? "\n✅ Certified gives you inspection-backed quality and extra peace of mind compared to ordinary used vehicles.\n"
    : "";

  const certifiedLineShort = isCertified
    ? " It’s certified, which means extra inspection-backed peace of mind compared to typical used units."
    : "";

  const facebook =
"🔥 STOP SCROLLING. Read this before someone else buys it.\n\n" +
"🚗 " + label + "\n" +
"💰 Price: " + price + "\n\n" +
"If you're serious about driving something that looks sharp, feels strong, and actually makes sense in real life, this " + label + " is the kind of unit you move on – not think about for three weeks." +
certifiedLineLong +
"\n💎 Why this one hits different:\n" +
featureLines +
"\n\nWhen the right unit shows up, serious buyers move first. If this lines up with what you’ve been telling yourself you want, this is your green light to take action.\n\n" +
"📲 Comment or DM “INFO” and I’ll get you pricing, photos, and a quick walkaround – straight answers, no nonsense.\n\n" +
hashtags;

  const instagram =
"🚗 " + label + "\n" +
"💰 " + price + "\n\n" +
"If you’ve been waiting for the right one to pop up, this is the move. Clean, sharp, and built to actually enjoy driving – not just tolerate it." +
certifiedLineShort +
"\n\n" +
featureLines +
"\n\n👀 If this matches what you’ve been looking for, don’t overthink it.\n\n" +
"📲 DM “INFO” and I’ll show you how easy it is to make it yours.\n\n" +
hashtags;

  const tiktok =
"🚗 " + label + "\n" +
"💰 " + price + "\n\n" +
"If this showed up on your screen, that’s your sign. This is the kind of unit people regret hesitating on." +
certifiedLineShort +
"\n\n" +
featureLines +
"\n\n⏳ Clean, dialed-in rides like this DO NOT sit.\n\n" +
"📲 Comment or DM “INFO” and I’ll send you a quick breakdown and walkaround. Move fast – serious buyers don’t wait.\n\n" +
hashtags;

  const linkedin =
"🚗 " + label + " – Strong, Clean, and Ready for the Next Owner\n\n" +
"For the right driver, the vehicle they choose is a reflection of how they show up – prepared, sharp, and ready to handle business. This " + label + " checks those boxes." +
certifiedLineShort +
"\n\n💰 Current pricing:\n" +
price +
"\n\nKey highlights:\n" +
featureLines +
"\n\nIf you or someone in your network is in the market for something solid, professional, and dependable, I’m happy to share details, photos, or a quick video walkaround.\n\n" +
"📩 Message me directly and I’ll respond with options and next steps – fast, simple, and straightforward.\n\n" +
hashtags;

  const twitter =
"🚗 " + label + "\n" +
"💰 " + price + "\n\n" +
"Clean, strong, and dialed in. Units like this don’t sit – serious buyers move first." +
certifiedLineShort +
"\n\n" +
hashtags +
"\n\n📲 DM “INFO” for photos, a walkaround, and next steps.";

  const sms =
"Just pulled a " + label + " that checks a lot of boxes. It’s at " + price +
" right now and it’s clean, sharp, and ready to go." +
certifiedLineShort +
" Want me to send you photos or a quick walkaround video?";

  const marketplace =
"Title idea:\n" +
label + " – Clean, Sharp & Ready to Go!\n\n" +
"Suggested description for Facebook Marketplace:\n\n" +
"🚗 This " + label + " just hit my list and it’s a legit, clean unit for someone who wants something that looks sharp, drives strong, and actually makes sense for real life." +
certifiedLineShort +
"\n\n💰 Current pricing:\n" +
price +
"\n\n🔥 Why this one is worth a serious look:\n" +
featureLines +
"\n\nIf you’ve been waiting for the right one instead of just “another” vehicle, this is the kind you move on – not scroll past.\n\n" +
"📲 Send a message if you want more photos, a walkaround video, or a simple breakdown of what it would take to put it in your driveway.\n\n" +
"⏳ If it’s listed, it’s available – for now. Strong units don’t sit long.";

  const videoScript =
"🎥 Viral Video Script (30–40 seconds)\n\n" +
"HOOK (2–3 sec)\n" +
"“Stop scrolling and look at this " + label + ". If you’ve been waiting for the right " +
((classifyVehicle(vehicle).isTruckOrSuv) ? "SUV or truck" : "car") +
", this is it.”\n\n" +
"EXTERIOR (5–10 sec)\n" +
"“Check out the stance, wheels, and overall look on this one. It’s clean, sharp, and it looks even better in person than it does online.”\n\n" +
"INTERIOR & FEATURES (10–15 sec)\n" +
"“Inside is where you really feel the upgrade – comfortable seating, modern tech, and a layout that actually makes sense for daily life. This is built for real driving – work, family, and weekend runs.”\n\n" +
"BENEFIT HOOK (5–8 sec)\n" +
"“If you’re tired of settling for ‘good enough’ and you want something that actually feels like a win every time you drive it, this is that move.”\n\n" +
"CTA (5–8 sec)\n" +
"“If this fits what you’ve been looking for, DM me ‘INFO’ and I’ll send a quick walkaround, pricing, and options to make it yours before someone else grabs it.”";

  const shotPlan =
"👀 Viral Visual Shot Plan (Simple 5–7 shots)\n\n" +
"1️⃣ Hook Shot (2–3 sec)\n" +
"- Start with a close-up of the front corner, grille, or headlights while you deliver the hook line.\n\n" +
"2️⃣ Full Body Pass (3–4 sec)\n" +
"- Walk slowly from the front corner down the side to show the stance and overall look. Keep the camera steady at chest height.\n\n" +
"3️⃣ Wheels & Details (2–3 sec)\n" +
"- Quick close-up of wheels, brakes, or badging. Small slow pan over the details that make it look sharp.\n\n" +
"4️⃣ Interior Flex (4–6 sec)\n" +
"- Smooth pan across the dash, steering wheel, touchscreen, and seats. Hold steady for 1–2 seconds on the best angles.\n\n" +
"5️⃣ Space & Practicality (3–4 sec)\n" +
"- Show rear seats, cargo area, or 3rd row. Open the liftgate, fold a seat, or highlight how usable the space is.\n\n" +
"6️⃣ Feature Moment (2–3 sec)\n" +
"- Hit one button or feature on camera: remote start, sunroof, heated seats, backup camera, etc. Make it feel real and useful.\n\n" +
"7️⃣ Power Ending (2–3 sec)\n" +
"- Finish with you in frame (or the front of the vehicle) delivering the CTA: “DM ‘INFO’ before someone else grabs it.”\n\n" +
"🎯 Tips:\n" +
"- Film vertical.\n" +
"- Keep clips short (1–3 seconds).\n" +
"- Use natural light when possible.\n" +
"- Speak clearly, confident, and like you already know this unit will sell.\n" +
"Follow these shots so your video looks clean, confident, and high-impact.";

  return {
    facebook,
    instagram,
    tiktok,
    linkedin,
    twitter,
    sms,
    marketplace,
    videoScript,
    shotPlan
  };
}

// ---------- API ROUTE ----------

app.post("/api/process-listing", async (req, res) => {
  const body = req.body || {};
  const url = body.url;
  if (!url || typeof url !== "string") {
    return res.status(400).send("Missing or invalid 'url'.");
  }

  try {
    const vehicle = await scrapeVehicle(url);
    const hashtags = generateHashtags(vehicle);
    const posts = buildSocialPosts(vehicle, hashtags);

    res.json({
      vehicle,
      posts: {
        ...posts,
        hashtags
      }
    });
  } catch (e) {
    if (e.message === "UNSUPPORTED_LINK") {
      return res
        .status(400)
        .send(
          "That link looks like an Auto iPacket or wrapper link. Paste the main dealer vehicle details page (VDP) URL instead so Lot Rocket can pull year/make/model/price."
        );
    }
    res.status(500).send("Failed to process listing.");
  }
});

// ---------- START SERVER ----------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Lot Rocket running on http://localhost:" + PORT);
});
