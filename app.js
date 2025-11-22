// app.js
//
// Simple end-to-end prototype for your "Lot Rocket" listing booster.
// One file: serves a UI + backend API stubs.
//
// HOW TO RUN (cloud hosts will do this for you):
// npm install
// node app.js

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
  <title>Lot Rocket – Listing Booster</title>
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
    .copy-box { background: #050505; border-radius: 12px; padding: 12px; border: 1px solid #333; white-space: pre-wrap; font-size: 0.9rem; }
    .images-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-top: 8px; }
    .image-thumb { position: relative; border-radius: 10px; overflow: hidden; border: 1px solid #333; }
    .image-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .badge { position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.7); font-size: 0.7rem; padding: 3px 6px; border-radius: 999px; }
    .status { margin-top: 12px; font-size: 0.85rem; color: #aaa; }
    .status strong { color: #ff7b32; }
    .small { font-size: 0.8rem; color: #777; margin-top: 8px; }
    .video-preview { margin-top: 8px; font-size: 0.85rem; padding: 8px; border-radius: 10px; border: 1px dashed #444; color: #ddd; }
  </style>
</head>
<body>
  <div class="app">
    <h1><span class="brand">Lot Rocket</span> Listing Booster</h1>
    <p class="sub">Paste a dealer vehicle URL. Get pro copy, images, and a social-ready package.</p>

    <div class="card">
      <label for="url">Dealer vehicle URL</label>
      <input id="url" type="text" placeholder="Paste a listing URL from any dealer site" />

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
        </div>
      </div>

      <div class="col">
        <div class="card">
          <div class="pill">🖼 Images & Video</div>
          <div id="images" class="images-grid"></div>
          <div id="video" class="video-preview">
            Video plan will appear here.
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="pill">📣 Social Preview</div>
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

    function setStatus(text) {
      statusEl.innerHTML = text || "";
    }

    processBtn.addEventListener("click", async () => {
      const url = document.getElementById("url").value.trim();

      if (!url) {
        setStatus("<strong>Missing URL:</strong> paste a dealer listing link first.");
        return;
      }

      processBtn.disabled = true;
      setStatus("Processing listing…");

      try {
        const res = await fetch("/api/process-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url })
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Server error");
        }

        const data = await res.json();

        copyOutputEl.textContent = data.salesCopy || "No copy generated.";

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

        videoEl.innerHTML = \`
          <strong>Planned Video:</strong><br>
          Length: \${data.videoPlan.lengthSeconds || 30}s<br>
          Hook: "\${data.videoPlan.hook}"<br>
          Structure: \${data.videoPlan.structure.join(" → ")}<br>
          Music: \${data.videoPlan.musicDescription}
        \`;

        socialPreviewEl.textContent = data.socialPreview || "";

        setStatus("<strong>Done!</strong>");
      } catch (err) {
        console.error(err);
        setStatus("<strong>Error:</strong> " + (err.message || "Something went wrong."));
      } finally {
        processBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `);
});

// --------- GENERIC DEALER SCRAPER ----------
async function scrapeVehicle(url) {
  try {
    const resp = await fetch(url);
    const html = await resp.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      "Vehicle";

    const priceText =
      $('[class*="price"]').first().text().trim() ||
      $('[data-qa*="price"]').first().text().trim() ||
      $('meta[itemprop="price"]').attr("content") ||
      "";

    const imageCandidates = [];
    $('img').each((_, el) => {
      const src = $(el).attr("src");
      if (!src) return;
      if (!src.match(/\.(jpe?g|png|webp)/i)) return;
      if (src.includes("logo")) return;
      if (imageCandidates.length >= 12) return false;
      imageCandidates.push(src);
    });

    const yearMatch = title.match(/(20\d{2}|19\d{2})/);
    const year = yearMatch ? yearMatch[1] : "";
    const makeModel = year ? title.replace(year, "").trim() : title;

    return {
      title,
      year,
      makeModel,
      price: priceText,
      description: "",
      images: imageCandidates
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

// Image placeholder
function cleanImages(imageUrls) {
  return imageUrls.map((url) => ({
    url,
    cleaned: true
  }));
}

// Copy generator
function generateSalesCopy(vehicle) {
  const name = vehicle.title || "this vehicle";
  const price = vehicle.price || "Ask about pricing";
  const year = vehicle.year ? vehicle.year + " " : "";
  const mm = vehicle.makeModel || "";

  return (
`🔥 ${year}${mm || "Vehicle"} – Available Now!

Looking for a reliable ride that stands out from the crowd? Check out ${name}.

💰 Price:
${price}

🚗 Highlights:
• Clean, well-kept inside and out
