// app.js
// Lot Rocket - listing booster with basic image scraping

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
    input[type="text"] {
      width: 100%; padding: 10px 12px; border-radius: 10px;
      border: 1px solid #333; background: #050505; color: #f5f5f5;
      font-size: 0.95rem;
    }
    input:focus { outline: 1px solid #ff3232; border-color: #ff3232; }
    button {
      border: none; border-radius: 999px; padding: 10px 18px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 8px;
      cursor: pointer; margin-top: 10px; font-size: 0.95rem;
      background: linear-gradient(135deg, #ff3232, #ff7b32); color: #fff;
      box-shadow: 0 8px 20px rgba(255, 50, 50, 0.4);
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }
    button:disabled { opacity: 0.4; cursor: default; box-shadow: none; transform: none; }
    .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem;
            padding: 5px 10px; border-radius: 999px; background: #181818; color: #ccc; }
    .copy-box { background: #050505; border-radius: 12px; padding: 12px; border: 1px solid #333; white-space: pre-wrap; font-size: 0.9rem; min-height: 100px;}
    .small { font-size: 0.8rem; color: #777; margin-top: 8px; }

    .images-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); 
      gap: 8px; 
      margin-top: 10px;
    }
    .image-thumb {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #333;
      background: #000;
    }
    .image-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  </style>
</head>
<body>
  <div class="app">
    <h1><span class="brand">Lot Rocket</span> Listing Booster</h1>
    <p class="sub">Paste a dealer vehicle URL. Get copy + social text + photos preview.</p>

    <div class="card">
      <form id="lotrocket-form">
        <label for="url">Dealer vehicle URL</label>
        <input id="url" type="text" placeholder="Paste the full URL from your dealer's vehicle page" />
        <button type="submit">🚀 Boost This Listing</button>
      </form>
      <div id="status" class="small"></div>
    </div>

    <div class="card">
      <div class="pill">✨ Generated Sales Copy</div>
      <div id="copy-output" class="copy-box">Your copy will appear here.</div>
    </div>

    <div class="card">
      <div class="pill">🖼 Photos from the page</div>
      <div id="images" class="images-grid"></div>
      <div class="small" id="images-note"></div>
    </div>

    <div class="card">
      <div class="pill">📣 Social Preview</div>
      <div id="social-preview" class="copy-box"></div>
    </div>

    <p class="small">Prototype only – always review and edit before posting to Facebook Marketplace or other platforms.</p>
  </div>

  <script>
    const form = document.getElementById("lotrocket-form");
    const statusEl = document.getElementById("status");
    const copyEl = document.getElementById("copy-output");
    const socialEl = document.getElementById("social-preview");
    const imagesEl = document.getElementById("images");
    const imagesNoteEl = document.getElementById("images-note");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const urlInput = document.getElementById("url");
      const url = urlInput.value.trim();

      if (!url) {
        statusEl.textContent = "Please paste a full vehicle URL from your dealer site.";
        return;
      }

      statusEl.textContent = "Processing listing…";
      copyEl.textContent = "";
      socialEl.textContent = "";
      imagesEl.innerHTML = "";
      imagesNoteEl.textContent = "";

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
        copyEl.textContent = data.salesCopy || "No copy generated.";
        socialEl.textContent = data.socialPreview || "";

        if (Array.isArray(data.images) && data.images.length > 0) {
          data.images.forEach(src => {
            const div = document.createElement("div");
            div.className = "image-thumb";
            const img = document.createElement("img");
            img.src = src;
            img.alt = "Vehicle photo";
            div.appendChild(img);
            imagesEl.appendChild(div);
          });
          imagesNoteEl.textContent = "These are scraped from the dealer page – review and download the ones you want.";
        } else {
          imagesNoteEl.textContent = "No images found on that page, or this dealer blocks scraping.";
        }

        statusEl.textContent = "Done. Review and tweak, then post.";
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Error: " + (err.message || "Something went wrong.");
      }
    });
  </script>
</body>
</html>`);
});

// ---------- SCRAPING & COPY ----------

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

    // Collect image URLs
    const images = [];
    $("img").each((_, el) => {
      let src = $(el).attr("src");
      if (!src) return;

      // Skip tiny / logo-ish stuff
      if (src.toLowerCase().includes("logo")) return;

      // Try to only keep likely photo file types
      if (!/\.(jpe?g|png|webp|gif)$/i.test(src.split("?")[0])) return;

      try {
        // Make relative URLs absolute
        src = new URL(src, url).toString();
      } catch (e) {
        // ignore URL errors
      }

      if (!images.includes(src)) {
        images.push(src);
      }
      if (images.length >= 12) return false;
    });

    const yearMatch = title.match(/(20\\d{2}|19\\d{2})/);
    const year = yearMatch ? yearMatch[1] : "";
    const makeModel = year ? title.replace(year, "").trim() : title;

    return {
      title,
      year,
      makeModel,
      price: priceText,
      images
    };
  } catch (e) {
    console.error("Scrape error:", e);
    return {
      title: "Vehicle",
      year: "",
      makeModel: "",
      price: "",
      images: []
    };
  }
}

function generateSalesCopy(vehicle) {
  const name = vehicle.title || "this vehicle";
  const price = vehicle.price || "Ask for current pricing";
  const year = vehicle.year ? vehicle.year + " " : "";
  const mm = vehicle.makeModel || "";

  return (
`🔥 ${year}${mm || "Vehicle"} – Available Now

Looking for a solid ride that looks good on the lot and even better on the road? Check out ${name}.

💰 Price:
${price}

🚗 Highlights:
• Clean, well-kept inside and out  
• Strong running and driving – ready for daily use  
• Great for commuters, families, or anyone needing a dependable ride  

🤝 Why work with this salesperson:
• Straight answers and real numbers  
• Options for challenged credit and tough situations  
• Focused on helping you get approved and driving

📲 Next step:
Message or call now and say “I saw the ${mm || "vehicle"} on Lot Rocket – let’s talk numbers.”`
  );
}

function buildSocialPreview(vehicle, copy) {
  const header = vehicle.price
    ? `${vehicle.title || "Vehicle for sale"} – ${vehicle.price}`
    : (vehicle.title || "Vehicle for sale");

  return `${header}

${copy}

Use this on Facebook Marketplace, your dealer page, or other socials. Always follow the platform rules and your dealership's policies.`;
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
    const salesCopy = generateSalesCopy(vehicle);
    const socialPreview = buildSocialPreview(vehicle, salesCopy);

    res.json({
      vehicle,
      salesCopy,
      socialPreview,
      images: vehicle.images || []
    });
  } catch (err) {
    console.error("Pipeline error:", err);
    res.status(500).send("Failed to process listing.");
  }
});

// ---------- START SERVER ----------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Lot Rocket running on http://localhost:" + PORT);
});
