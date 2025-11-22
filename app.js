// app.js
// Lot Rocket – Social Media Post Kit for Automotive Salespeople
// Paste a vehicle URL -> get platform-specific copy for FB, IG, TikTok, LinkedIn, X, SMS/DM, and Facebook Marketplace.

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
    .app { max-width: 1000px; margin: 0 auto; padding: 32px 16px 80px; }
    h1 { font-size: 2rem; margin-bottom: 4px; }
    h1 span.brand { color: #ff3232; }
    p.sub { color: #aaa; margin-top: 0; }
    .card { background: #111; border-radius: 16px; padding: 20px; border: 1px solid #333; margin-top: 16px; }
    label { display: block; font-weight: 600; margin-bottom: 6px; }
    input[type="text"] {
      width: 100%; padding: 10px 12px; border-radius: 10px;
      border: 1px solid #333; background: #050505; color: #f5f5f5;
      font-size: 0.95rem;
    }
    input:focus { outline: 1px solid #ff3232; border-color: #ff3232; }
    button {
      border: none; border-radius: 999px; padding: 8px 14px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 6px;
      cursor: pointer; margin-top: 10px; font-size: 0.85rem;
      background: linear-gradient(135deg, #ff3232, #ff7b32); color: #fff;
      box-shadow: 0 8px 16px rgba(255, 50, 50, 0.4);
      transition: transform 0.08s ease, box-shadow 0.08s ease;
    }
    button:hover { transform: translateY(-1px); box-shadow: 0 12px 22px rgba(255, 50, 50, 0.6); }
    button:disabled { opacity: 0.4; cursor: default; box-shadow: none; transform: none; }
    .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem;
            padding: 5px 10px; border-radius: 999px; background: #181818; color: #ccc; }
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
      font-size: 0.75rem;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
  </style>
</head>
<body>
  <div class="app">
    <h1><span class="brand">Lot Rocket</span> Social Media Kit</h1>
    <p class="sub">Paste a vehicle URL. Get ready-to-use posts for Facebook, Instagram, TikTok, LinkedIn, X, Marketplace, and text/DM – in seconds. 🔥</p>

    <div class="card">
      <form id="lotrocket-form">
        <label for="url">Dealer vehicle URL</label>
        <input id="url" type="text" placeholder="Paste a full link from a vehicle details page" />
        <button type="submit">🚀 Boost This Listing</button>
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

    <p class="small">Prototype – images and automatic video creation will come in a later version. For now, use this as your “done-for-you” social copy engine.</p>
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

    document.querySelectorAll("button[data-copy-target]").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-copy-target");
        handleCopy(target);
      });
    });

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

        fbEl.textContent = data.posts && data.posts.facebook || "No Facebook post generated.";
        igEl.textContent = data.posts && data.posts.instagram || "No Instagram caption generated.";
        ttEl.textContent = data.posts && data.posts.tiktok || "No TikTok caption generated.";
        liEl.textContent = data.posts && data.posts.linkedin || "No LinkedIn post generated.";
        twEl.textContent = data.posts && data.posts.twitter || "No X/Twitter post generated.";
        smsEl.textContent = data.posts && data.posts.sms || "No short message generated.";
        mpEl.textContent = data.posts && data.posts.marketplace || "No Marketplace description generated.";
        hashtagsEl.textContent = data.posts && data.posts.hashtags || "";

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

// ---------- SCRAPING HELPERS ----------

function cleanTitle(rawTitle) {
  if (!rawTitle) return "Vehicle";
  let t = rawTitle;

  // Drop dealer name/location after |
  t = t.split("|")[0];

  // Remove VIN-like chunks
  t = t.replace(/[A-HJ-NPR-Z0-9]{11,17}/g, " ");

  // Collapse extra spaces
  t = t.replace(/\s{2,}/g, " ").trim();

  return t || "Vehicle";
}

function cleanPrice(raw) {
  if (!raw) return "";
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  const withDollar = lines.find(l => l.includes("$"));
  return withDollar || lines[0];
}

// ---------- SCRAPE VEHICLE DATA ----------

async function scrapeVehicle(url) {
  try {
    const resp = await fetch(url);
    const html = await resp.text();
    const $ = cheerio.load(html);

    const rawTitle =
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      "Vehicle";

    const rawPrice =
      $('[class*="price"]').first().text().trim() ||
      $('meta[itemprop="price"]').attr("content") ||
      "";

    const title = cleanTitle(rawTitle);
    const price = cleanPrice(rawPrice);

    const yearMatch = title.match(/(20\d{2}|19\d{2})/);
    const year = yearMatch ? yearMatch[1] : "";
    const makeModel = year ? title.replace(year, "").trim() : title;

    return {
      title,
      year,
      makeModel,
      price
    };
  } catch (e) {
    console.error("Scrape error:", e);
    return {
      title: "Vehicle",
      year: "",
      makeModel: "",
      price: ""
    };
  }
}

// ---------- FEATURE STACK (generic but hype) ----------

function generateFeatureStack(vehicle) {
  const label = (vehicle.year ? vehicle.year + " " : "") + (vehicle.makeModel || "this vehicle");

  // VERY simple classification based on keywords in title
  const nameLower = (vehicle.makeModel || "").toLowerCase();
  const isTruckOrSuv =
    ["tahoe", "suburban", "silverado", "sierra", "ram", "f-150", "f150", "bronco", "explorer", "traverse", "highlander", "4runner", "durango"].some(
      (k) => nameLower.includes(k)
    );

  const baseFeatures = isTruckOrSuv
    ? [
        "Aggressive stance that looks sharp on the road",
        "Comfortable, roomy interior that actually fits people and gear",
        "Strong powertrain built to handle real-world driving",
        "Modern touchscreen with smartphone connection",
        "Backup camera for easy parking and tight spots",
        "Premium wheel and tire look",
        "Solid ride quality – feels planted and confident",
        "Family, work, and weekend ready",
        "Road-trip approved comfort",
        "Tons of presence – this thing gets noticed"
      ]
    : [
        "Clean, sharp exterior styling",
        "Comfortable seating that’s easy to live with daily",
        "Fuel-efficient and practical for real-world driving",
        "Modern touchscreen with smartphone connection",
        "Backup camera for simple, confident parking",
        "Smooth, quiet ride that feels dialed-in",
        "Easy to drive and easy to park",
        "Smart layout – controls are where you want them",
        "Great daily driver for work, school, or family",
        "Strong value for the money in this segment"
      ];

  // Take 10–12 bullets
  const selected = baseFeatures.slice(0, 10);

  return {
    label,
    bullets: selected
  };
}

// ---------- HASHTAGS & POSTS ----------

function generateHashtags(vehicle) {
  const tags = new Set();
  const baseWords = [];

  if (vehicle.year) baseWords.push(vehicle.year);
  if (vehicle.makeModel) {
    vehicle.makeModel.split(/\s+/).forEach((w) => baseWords.push(w));
  }

  baseWords.forEach((w) => {
    const clean = w.replace(/[^a-z0-9]/gi, "");
    if (!clean) return;
    tags.add("#" + clean.toLowerCase());
  });

  [
    "#carsales",
    "#cardeals",
    "#carshopping",
    "#usedcars",
    "#newcar",
    "#carlife",
    "#autodeals",
    "#lotrocket"
  ].forEach((t) => tags.add(t));

  return Array.from(tags).join(" ");
}

function buildSocialPosts(vehicle, hashtags) {
  const price = vehicle.price || "Call for details";
  const { label, bullets } = generateFeatureStack(vehicle);

  const featureLines = bullets.map((b) => `🔥 ${b}`).join("  \n");

  const facebook =
`🚗 ${label} – LOADED & READY TO IMPRESS

If you're serious about driving something that looks sharp, feels strong, and makes sense in real life, this ${label} is the kind of unit you move on – not think about for three weeks.

💰 Current pricing:
${price}

💎 Why this one stands out:
${featureLines}

I move a lot of metal, and clean, well-optioned units like this do NOT sit. If this lines up with what you’ve been telling yourself you want, this is your moment to take action.

📲 DM “INFO” and I’ll walk you through it quickly and professionally – no nonsense, just straight answers and a real plan.

${hashtags}`;

  const instagram =
`🚗 ${label}
💰 ${price}

If you’ve been waiting for the right one to pop up, this is the move. Clean, sharp, and built to actually enjoy driving – not just tolerate it.

${featureLines}

👀 If this matches what you’ve been looking for, don’t overthink it.

📲 DM “INFO” and I’ll show you how easy it is to make it yours.

${hashtags}`;

  const tiktok =
`🚗 ${label}
💰 ${price}

If this showed up on your screen, that’s your sign. This is the kind of unit people regret hesitating on.

${featureLines}

⏳ Clean, dialed-in rides like this DO NOT sit.

📲 Comment or DM “INFO” and I’ll send you a quick breakdown and walkaround. Move fast, serious buyers don’t wait.

${hashtags}`;

  const linkedin =
`🚗 ${label} – Strong, Clean, and Ready for the Next Owner

For the right driver, the vehicle they choose is a reflection of how they show up – prepared, sharp, and ready to handle business. This ${label} checks those boxes.

💰 Current pricing:
${price}

Key highlights:
${featureLines}

If you or someone in your network is in the market for something solid, professional, and dependable, I’m happy to share details, photos, or a quick video walkaround.

📩 Message me directly and I’ll respond with options and next steps – fast, simple, and straightforward.

${hashtags}`;

  const twitter =
`🚗 ${label}
💰 ${price}

Clean, strong, and dialed in. Units like this don’t sit – serious buyers move first.

${hashtags}

📲 DM “INFO” for photos, walkaround, and next steps.`;

  const sms =
`Just pulled a ${label} that checks a lot of boxes. It’s at ${price} right now and it’s clean, sharp, and ready to go. Want me to send you photos or a quick walkaround video?`;

  const marketplace =
`Title idea:
${label} – Clean, Sharp & Ready to Go!

Suggested description for Facebook Marketplace:

🚗 This ${label} just hit my list and it’s a legit, clean unit for someone who wants something that looks sharp, drives strong, and actually makes sense for real life.

💰 Current pricing:
${price}

🔥 Why this one is worth a serious look:
${featureLines}

If you’ve been waiting for the right one instead of just “another” vehicle, this is the kind you move on – not scroll past.

📲 Send a message if you want more photos, a walkaround video, or a simple breakdown of what it would take to put it in your driveway.

⏳ If it’s listed, it’s available – for now. Strong units don’t sit long.`;

  return {
    facebook,
    instagram,
    tiktok,
    linkedin,
    twitter,
    sms,
    marketplace
  };
}

// ---------- API ROUTE ----------

app.post("/api/process-listing", async (req, res) => {
  const { url } = req.body || {};
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
    console.error("Pipeline error:", e);
    res.status(500).send("Failed to process listing.");
  }
});

// ---------- START SERVER ----------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Lot Rocket running on http://localhost:" + PORT);
});
