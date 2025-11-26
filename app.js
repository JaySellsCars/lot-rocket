// app.js
//
// Simple end-to-end prototype for your "Jay Sells Cars" listing helper.
// One file: serves a UI + backend API stubs.
//
// HOW TO RUN:
// 1) npm init -y
// 2) npm install express node-fetch cheerio
// 3) node app.js
// 4) Visit http://localhost:3000 in your browser.

const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
app.use(express.json({ limit: "10mb" }));

// --------- FRONTEND (Single Page UI) ----------
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Jay Sells Cars – Listing Booster</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #050505; color: #f5f5f5; }
    .app { max-width: 900px; margin: 0 auto; padding: 32px 16px 80px; }
    h1 { font-size: 2rem; margin-bottom: 4px; }
    h1 span.brand { color: #ff3232; }
    p.sub { color: #aaa; margin-top: 0; }
    .card { background: #111; border-radius: 16px; padding: 20px; border: 1px solid #333; margin-top: 16px; }
    label { display: block; font-weight: 600; margin-bottom: 6px; }
    input[type="text"], textarea {
      width: 100%; padding: 10px 12px; border-radius: 10px;
      border: 1px solid #333; background: #050505; color: #f5f5f5;
      font-size: 0.95rem;
    }
    input:focus, textarea:focus { outline: 1px solid #ff3232; border-color: #ff3232; }
    button {
      border: none; border-radius: 999px; padding: 10px 18px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 8px;
      cursor: pointer; margin-top: 10px; font-size: 0.95rem;
      background: linear-gradient(135deg, #ff3232, #ff7b32); color: #fff;
      box-shadow: 0 8px 20px rgba(255, 50, 50, 0.4);
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }
    button:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(255, 50, 50, 0.6); }
    button:disabled { opacity: 0.4; cursor: default; box-shadow: none; transform: none; }
    .row { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; }
    .col { flex: 1 1 280px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem;
            padding: 5px 10px; border-radius: 999px; background: #181818; color: #ccc; }
    .tag { display: inline-flex; padding: 3px 9px; border-radius: 999px; background: #222; font-size: 0.75rem; margin-right: 6px; margin-bottom: 4px; }
    .copy-box { background: #050505; border-radius: 12px; padding: 12px; border: 1px solid #333; white-space: pre-wrap; font-size: 0.9rem; }
    .images-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-top: 8px; }
    .image-thumb { position: relative; border-radius: 10px; overflow: hidden; border: 1px solid #333; }
    .image-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .badge { position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.7); font-size: 0.7rem; padding: 3px 6px; border-radius: 999px; }
    .status { margin-top: 12px; font-size: 0.85rem; color: #aaa; }
    .status strong { color: #ff7b32; }
    .small { font-size: 0.8rem; color: #777; margin-top: 8px; }
    .video-preview { margin-top: 8px; font-size: 0.85rem; padding: 8px; border-radius: 10px; border: 1px dashed #444; color: #ddd; }
    @media (max-width: 600px) {
      h1 { font-size: 1.6rem; }
    }
  </style>
</head>
<body>
  <div class="app">
    <h1><span class="brand">JaySellsCars</span> Listing Booster</h1>
    <p class="sub">Paste your dealer vehicle URL. We'll prep pro photos, high-converting copy, and a social-ready package.</p>

    <div class="card">
      <label for="url">Dealer vehicle URL</label>
      <input id="url" type="text" placeholder="Paste a listing URL from your dealer site" />

      <div class="row">
        <div class="col">
          <label for="target">Target buyer (optional)</label>
          <input id="target" type="text" placeholder="First-time buyer, bad credit, family, etc." />
        </div>
        <div class="col">
          <label for="tone">Tone</label>
          <input id="tone" type="text" value="High-energy, confident, trustworthy" />
        </div>
      </div>

      <button id="processBtn">
        🚀 Boost This Listing
      </button>

      <div class="status" id="status"></div>
    </div>

    <div class="row">
      <div class="col">
        <div class="card">
          <div class="pill">✨ Generated Copy</div>
          <div id="copy-output" class="copy-box" style="min-height:120px; margin-top:10px;">
            Paste a URL and hit "Boost" to generate your ad copy.
          </div>
          <button id="copyCopyBtn" style="margin-top:8px; display:none;">📋 Copy Text</button>
          <div class="small">Copy/paste this into Facebook Marketplace, your CRM, or your website VDP.</div>
        </div>
      </div>

      <div class="col">
        <div class="card">
          <div class="pill">🖼 Images & Video</div>
          <div id="images" class="images-grid"></div>
          <div id="video" class="video-preview">
            Video storyboards + trending sound selection will show here as you integrate your video engine.
          </div>
          <div class="small">
            This prototype only simulates editing. Replace backend stubs with your actual
            image editor (e.g., Cloudinary) and video builder (FFmpeg or a SaaS API).
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="pill">📣 Social Posting (Placeholder)</div>
      <p class="small">
        This demo shows what will be posted. Actual auto-posting to Facebook Marketplace and other
        platforms must follow each platform's current API rules and policies.
      </p>
      <div id="social-preview" class="copy-box"></div>
    </div>
  </div>

  <script>
    const processBtn = document.getElementById("processBtn");
    const statusEl = document.getElementById("status");
    const copyOutputEl = document.getElementById("copy-output");
    const imagesEl = document.getElementById("images");
    const videoEl = document.getElementById("video");
    const socialPreviewEl = document.getElementById("social-preview");
    const copyCopyBtn = document.getElementById("copyCopyBtn");

    function setStatus(text) {
      statusEl.innerHTML = text || "";
    }

    processBtn.addEventListener("click", async () => {
      const url = document.getElementById("url").value.trim();
      const target = document.getElementById("target").value.trim();
      const tone = document.getElementById("tone").value.trim();

      if (!url) {
        setStatus("<strong>Missing URL:</strong> paste a dealer listing link first.");
        return;
      }

      processBtn.disabled = true;
      setStatus("Pulling vehicle details, enhancing images, and writing your copy…");

      try {
        const res = await fetch("/api/process-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, target, tone })
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Server error");
        }

        const data = await res.json();

        // Update copy
        copyOutputEl.textContent = data.salesCopy || "No copy generated.";
        copyCopyBtn.style.display = "inline-flex";

        // Images (fake thumbs)
        imagesEl.innerHTML = "";
        (data.images || []).forEach((img, idx) => {
          const div = document.createElement("div");
          div.className = "image-thumb";
          const tag = img.cleaned ? "Cleaned" : "Original";
          div.innerHTML = \`
            <img src="\${img.url}" alt="Vehicle image \${idx+1}" />
            <div class="badge">\${tag}</div>
          \`;
          imagesEl.appendChild(div);
        });

        // Video preview
        videoEl.innerHTML = \`
          <strong>Planned Video:</strong><br>
          Length: \${data.videoPlan.lengthSeconds || 30}s<br>
          Hook: "\${data.videoPlan.hook}"<br>
          Structure: \${data.videoPlan.structure.join(" → ")}<br>
          Music: \${data.videoPlan.musicDescription}
        \`;

        // Social preview
        socialPreviewEl.textContent = data.socialPreview || "";

        setStatus("<strong>Done:</strong> Review your copy & assets, then post or plug into your automations.");
      } catch (err) {
        console.error(err);
        setStatus("<strong>Error:</strong> " + (err.message || "Something went wrong."));
      } finally {
        processBtn.disabled = false;
      }
    });

    copyCopyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(copyOutputEl.textContent || "");
        setStatus("✅ Copy text copied to clipboard.");
      } catch {
        setStatus("Could not copy automatically. Please select the text and copy manually.");
      }
    });
  </script>
</body>
</html>
  `);
});

// --------- BACKEND LOGIC ----------

// Stub: fetch and parse vehicle details from dealer URL
async function scrapeVehicle(url) {
  try {
    const resp = await fetch(url);
    const html = await resp.text();
    const $ = cheerio.load(html);

    // These selectors are EXAMPLES – change based on the dealer site you target.
    // For your dpapp.autoipacket-style site, inspect the DOM and plug in real selectors.
    const title =
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      "Vehicle";

    const priceText =
      $('[class*="price"]').first().text().trim() ||
      $('[data-qa="price"]').first().text().trim() ||
      "";

    const yearMatch = title.match(/(20\\d{2})/);
    const year = yearMatch ? yearMatch[1] : "";

    const makeModelMatch = title.replace(year, "").trim();
    const mainImage =
      $('img[src*="vehicle"], img[src*="inventory"]').first().attr("src") || "";

    // Collect a few images
    let images = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (!src) return;
      if (src.startsWith("data:")) return; // skip inline
      if (!src.match(/jpg|jpeg|png|webp/i)) return;
      if (images.length >= 6) return false;
      images.push(src);
    });

    return {
      title,
      year,
      makeModel: makeModelMatch,
      price: priceText,
      description: "",
      images
    };
  } catch (e) {
    console.error("Scrape error:", e);
    return {
      title: "Vehicle",
      year: "",
      makeModel: "",
      price: "",
      description: "",
      images: []
    };
  }
}

// Stub: "clean" images (in real life, call an image API or run your own editor)
function cleanImages(imageUrls) {
  // Placeholder: we just mark them as cleaned and assume a CDN / editor handles this.
  return imageUrls.map((url) => ({
    url,          // in real life, return the edited URL
    cleaned: true // flag so UI can label it
  }));
}

// Generate high-converting copy based on scraped data + options
function generateSalesCopy(vehicle, options = {}) {
  const { target = "", tone = "" } = options;

  const name = vehicle.title || "this vehicle";
  const price = vehicle.price || "Ask about our current pricing";
  const year = vehicle.year ? vehicle.year + " " : "";
  const mm = vehicle.makeModel || "";

  const audienceLine = target
    ? `This ${mm || "vehicle"} is a perfect fit for ${target.toLowerCase()}.`
    : `Whether you're upgrading, downsizing, or buying your first ride, this one deserves a test drive.`;

  const toneLine = tone
    ? `Tone: ${tone}.`
    : `Expect a no-pressure, straight-to-the-point experience – just how car buying should be.`;

  return (
`🔥 ${year}${mm || "Vehicle"} – Available Now!

Looking for a ride that looks sharp, drives smooth, and doesn’t beat up your budget? Check out ${name}.

💰 Price:
${price}

🚗 Highlights:
• Clean, well-kept vehicle inside and out  
• Runs and drives strong – ready for daily use  
• Great for commuting, road trips, and everything in between  

👥 Who this is great for:
${audienceLine}

🤝 Why shop with me:
• I specialize in challenged credit and tough situations  
• Straight answers, no games, and clear numbers  
• I work for you to make the deal simple and stress-free  

📲 Next step:
Send me a message here or text/call me directly and say, “I saw the ${mm || "vehicle"} – let’s talk numbers.” I’ll walk you through payment options, trade-in, and what it takes to get you driving.

${toneLine}
`
  );
}

// Stub: plan a short vertical video
function planVideo(vehicle, options = {}) {
  const mm = vehicle.makeModel || "this vehicle";
  const hook =
    `“Stop scrolling – this ${mm} might be the deal you've been waiting for.”`;

  return {
    lengthSeconds: 30,
    hook,
    structure: [
      "Hook: quick exterior shot + price flash",
      "Walkaround: highlight body, wheels, interior",
      "Feature hits: tech, mileage, warranties",
      "Call to action: text/call + credit-friendly message"
    ],
    musicDescription:
      "Use current trending, high-energy, royalty-free track from a TikTok/Reels-safe library. Make sure it's cleared for commercial use."
  };
}

// Stub: construct preview for Facebook Marketplace post
function buildSocialPreview(vehicle, copy) {
  const line1 = vehicle.title || "Vehicle for sale";
  const price = vehicle.price || "";
  const header = price ? `${line1} – ${price}` : line1;

  return `${header}

${copy}

Platform notes:
• Facebook Marketplace: Use the title, price, mileage, year, make, model, and 3–10 of the cleaned images.
• Instagram / TikTok: Use the video + shortened version of the copy with a strong call to action.
• Always follow platform policies and ad guidelines.`;
}

// API: main pipeline
app.post("/api/process-listing", async (req, res) => {
  const { url, target, tone } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).send("Missing or invalid 'url'.");
  }

  try {
    // 1) Scrape vehicle data
    const vehicle = await scrapeVehicle(url);

    // 2) Clean images (placeholder)
    const cleanedImages = cleanImages(vehicle.images || []);

    // 3) Generate high-converting copy
    const salesCopy = generateSalesCopy(vehicle, { target, tone });

    // 4) Plan video concept
    const videoPlan = planVideo(vehicle, { target, tone });

    // 5) Social post preview
    const socialPreview = buildSocialPreview(vehicle, salesCopy);

    res.json({
      vehicle,
      images: cleanedImages,
      salesCopy,
      videoPlan,
      socialPreview
    });
  } catch (err) {
    console.error("Pipeline error:", err);
    res.status(500).send("Failed to process listing.");
  }
});

// --------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("JaySellsCars Listing Booster running on http://localhost:" + PORT);
});
