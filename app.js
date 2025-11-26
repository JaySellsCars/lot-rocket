// sales-app.js
// Unified single-file codebase for your salespeople app.
// We'll keep ALL backend + scraping + helper logic in this file so it's easy to copy into your environment.
// As we refine features in chat, this file will be updated instead of flooding the conversation.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- Helper: scrape vehicle photos (placeholder implementation) ----------------

async function scrapeVehiclePhotos(pageUrl) {
  try {
    const res = await fetch(pageUrl);
    if (!res.ok) {
      console.error('Failed to fetch page for photos:', res.status);
      return [];
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const urls = new Set();

    const base = new URL(pageUrl);

    $('img').each((i, el) => {
      let src = $(el).attr('data-src') || $(el).attr('src');
      if (!src) return;

      // Resolve relative URLs against the page URL
      try {
        const full = new URL(src, base).toString();
        urls.add(full);
      } catch (e) {
        console.warn('Bad image URL, skipping:', src);
      }
    });

    return Array.from(urls);
  } catch (err) {
    console.error('Error scraping vehicle photos:', err.message);
    return [];
  }
}

// ---------------- API endpoint: main vehicle processing pipeline (skeleton) ----------------

app.post('/api/process-vehicle', async (req, res) => {
  const { dealerUrl } = req.body;
  if (!dealerUrl) {
    return res.status(400).json({ error: 'dealerUrl is required' });
  }

  try {
    // 1) Scrape photos
    const photos = await scrapeVehiclePhotos(dealerUrl);

    // 2) TODO: call image enhancement pipeline (watermark removal, quality boost)

    // 3) TODO: call OpenAI to generate high-converting copy + video script

    // 4) TODO: (future) auto-post to Facebook Marketplace + social channels

    res.json({
      dealerUrl,
      photos,
      message: 'Pipeline skeleton working. Next step: plug in image + copy + video + posting logic.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------- AI Message & Campaign Generator API ----------------

app.post('/api/ai-message', async (req, res) => {
  try {
    const {
      channel = 'sms',
      goal,
      details,
      audience = 'car buyer',
      tone = 'friendly',
      followups = 3,
    } = req.body || {};

    if (!goal && !details) {
      return res.status(400).json({ error: 'Please provide a goal or some details for the message.' });
    }

    const prompt = `
You are an expert automotive sales copywriter and CRM strategist.

Channel: ${channel}
Audience: ${audience}
Tone: ${tone}
Primary goal: ${goal || 'Not specified, infer from context.'}
Extra details from salesperson: ${details || 'None provided.'}
Number of follow-up steps to create in the workflow: ${followups}

Tasks:
1. Write ONE high-converting ${channel === 'email' ? 'email' : 'SMS text message'} that a car salesperson can send to a real lead. Make it personalized, clear, and action-driven.
2. Then create a follow-up workflow with ${followups} steps. For each step, include:
   - Day offset (for example: Day 0, Day 2, Day 5, etc.)
   - Channel (SMS, email, call, etc.)
   - Purpose of the step
   - Full suggested message text.

Return your answer as strict JSON in this shape:
{
  "primaryMessage": "string",
  "campaign": [
    {
      "dayOffset": number,
      "channel": "sms | email | phone",
      "purpose": "string",
      "message": "string"
    }
  ]
}
Only output JSON. Do not include any extra commentary.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-5.1-mini',
      messages: [
        {
          role: 'system',
          content:
            'You write high-converting automotive sales messages and follow-up workflows. Always respond in valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return res.status(500).json({ error: 'No response from AI.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({ error: 'AI response was not valid JSON.', raw });
    }

    res.json(parsed);
  } catch (err) {
    console.error('Error in /api/ai-message:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------- Simple Frontend UI: Toolbar + Calculators ----------------

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lot Rocket Tools</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 0;
        padding: 0;
        background: #0f172a;
        color: #e5e7eb;
      }
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        background: #111827;
        border-bottom: 1px solid #1f2933;
      }
      .brand {
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .dropdown {
        position: relative;
        display: inline-block;
      }
      .dropdown button {
        padding: 8px 14px;
        border-radius: 999px;
        border: 1px solid #374151;
        background: #111827;
        color: #e5e7eb;
        cursor: pointer;
      }
      .dropdown-content {
        display: none;
        position: absolute;
        right: 0;
        background-color: #111827;
        min-width: 220px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        border-radius: 12px;
        overflow: hidden;
        z-index: 1;
      }
      .dropdown-content a {
        color: #e5e7eb;
        padding: 10px 14px;
        text-decoration: none;
        display: block;
        font-size: 14px;
      }
      .dropdown-content a:hover {
        background-color: #1f2937;
      }
      .show {
        display: block;
      }
      .wrapper {
        max-width: 900px;
        margin: 30px auto;
        padding: 0 16px 40px;
      }
      h1 {
        margin-bottom: 8px;
      }
      .subtitle {
        color: #9ca3af;
        margin-bottom: 24px;
        font-size: 14px;
      }
      .card {
        background: #020617;
        border-radius: 18px;
        padding: 20px;
        border: 1px solid #1f2937;
        margin-bottom: 18px;
      }
      .card h2 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 18px;
      }
      label {
        display: block;
        margin-top: 10px;
        font-size: 14px;
      }
      input, select, textarea {
        width: 100%;
        padding: 8px 10px;
        margin-top: 4px;
        border-radius: 10px;
        border: 1px solid #374151;
        background: #020617;
        color: #e5e7eb;
      }
      button.calc-btn {
        margin-top: 14px;
        padding: 10px 16px;
        border-radius: 999px;
        border: none;
        background: #ef4444;
        color: white;
        font-weight: 600;
        cursor: pointer;
      }
      button.calc-btn:hover {
        opacity: 0.9;
      }
      .result {
        margin-top: 12px;
        font-weight: 600;
        font-size: 16px;
      }
      .calc-section {
        display: none;
      }
      .calc-section.active {
        display: block;
      }
    </style>
  </head>
  <body>
    <header class="toolbar">
      <div class="brand">Lot Rocket Toolkit</div>
      <div class="dropdown">
        <button onclick="toggleDropdown()">Tools ▼</button>
        <div id="toolsDropdown" class="dropdown-content">
          <a href="#" onclick="selectTool('car-payment')">Car Payment Calculator</a>
          <a href="#" onclick="selectTool('income')">Yearly Gross Income Calculator</a>
          <a href="#" onclick="selectTool('ai-messages')">AI Message & Campaign Builder</a>
        </div>
      </div>
    </header>

    <main class="wrapper">
      <h1>Quick Deal Desk Tools</h1>
      <p class="subtitle">Fast numbers for real conversations — use these while you&#39;re with the customer.</p>

      <section id="car-payment" class="card calc-section active">
        <h2>Car Payment Calculator</h2>
        <label>Vehicle Price ($)
          <input type="number" id="price" placeholder="30000" />
        </label>
        <label>Down Payment ($)
          <input type="number" id="down" placeholder="3000" />
        </label>
        <label>APR (%)
          <input type="number" id="apr" step="0.01" placeholder="7.99" />
        </label>
        <label>Term (months)
          <input type="number" id="term" placeholder="72" />
        </label>
        <button class="calc-btn" onclick="calculatePayment()">Calculate Payment</button>
        <div id="paymentResult" class="result"></div>
      </section>

      <section id="income" class="card calc-section">
        <h2>Yearly Gross Income Calculator</h2>
        <label>Hourly Wage ($)
          <input type="number" id="hourly" step="0.01" placeholder="20" />
        </label>
        <label>Hours per Week
          <input type="number" id="hoursPerWeek" placeholder="40" />
        </label>
        <button class="calc-btn" onclick="calculateIncome()">Calculate Yearly Income</button>
        <div id="incomeResult" class="result"></div>
      </section>

      <section id="ai-messages" class="card calc-section">
        <h2>AI Message & Campaign Builder</h2>
        <label>Channel
          <select id="aiChannel">
            <option value="sms">Text Message (SMS)</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label>What are you trying to accomplish?
          <textarea id="aiGoal" rows="2" placeholder="Example: Follow up with a lead who came in last week but didn&apos;t buy."></textarea>
        </label>
        <label>Any key details about the customer or vehicle?
          <textarea id="aiDetails" rows="3" placeholder="Name, vehicle, budget, objections, etc."></textarea>
        </label>
        <label>Audience type
          <input type="text" id="aiAudience" placeholder="First-time buyer, subprime, repeat customer, etc." />
        </label>
        <label>Tone
          <select id="aiTone">
            <option value="friendly">Friendly & Helpful</option>
            <option value="professional">Professional</option>
            <option value="urgent">Urgent / Action-focused</option>
            <option value="laid back">Laid back</option>
          </select>
        </label>
        <label>Number of follow-up steps in workflow
          <input type="number" id="aiFollowups" min="1" max="10" value="4" />
        </label>
        <button class="calc-btn" onclick="generateAiMessage()">Generate Message & Workflow</button>
        <div id="aiResult" class="result" style="white-space: pre-wrap; margin-top: 16px;"></div>
      </section>
    </main>

    <script>
      function toggleDropdown() {
        document.getElementById('toolsDropdown').classList.toggle('show');
      }

      window.onclick = function(event) {
        if (!event.target.matches('.dropdown button')) {
          const dropdowns = document.getElementsByClassName('dropdown-content');
          for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
              openDropdown.classList.remove('show');
            }
          }
        }
      };

      function selectTool(id) {
        const sections = document.querySelectorAll('.calc-section');
        sections.forEach((section) => {
          section.classList.remove('active');
        });
        document.getElementById(id).classList.add('active');
      }

      function calculatePayment() {
        const price = parseFloat(document.getElementById('price').value) || 0;
        const down = parseFloat(document.getElementById('down').value) || 0;
        const apr = parseFloat(document.getElementById('apr').value) || 0;
        const term = parseInt(document.getElementById('term').value, 10) || 0;

        const loanAmount = price - down;
        if (loanAmount <= 0 || term <= 0) {
          document.getElementById('paymentResult').innerText = 'Please enter a valid price, down payment, and term.';
          return;
        }

        const monthlyRate = apr > 0 ? (apr / 100) / 12 : 0;
        let payment;
        if (monthlyRate === 0) {
          payment = loanAmount / term;
        } else {
          const pow = Math.pow(1 + monthlyRate, term);
          payment = loanAmount * (monthlyRate * pow) / (pow - 1);
        }

        document.getElementById('paymentResult').innerText =
          'Estimated Payment: $' + payment.toFixed(2) + ' / month';
      }

      function calculateIncome() {
        const hourly = parseFloat(document.getElementById('hourly').value) || 0;
        const hoursPerWeek = parseFloat(document.getElementById('hoursPerWeek').value) || 0;

        if (hourly <= 0 || hoursPerWeek <= 0) {
          document.getElementById('incomeResult').innerText = 'Please enter a valid hourly wage and hours per week.';
          return;
        }

        const yearly = hourly * hoursPerWeek * 52;
        document.getElementById('incomeResult').innerText =
          'Estimated Yearly Gross Income: $' + yearly.toFixed(2);
      }
          async function generateAiMessage() {
        const channel = document.getElementById('aiChannel').value || 'sms';
        const goal = document.getElementById('aiGoal').value || '';
        const details = document.getElementById('aiDetails').value || '';
        const audience = document.getElementById('aiAudience').value || 'car buyer';
        const tone = document.getElementById('aiTone').value || 'friendly';
        const followups = parseInt(document.getElementById('aiFollowups').value, 10) || 4;

        const payload = { channel, goal, details, audience, tone, followups };

        const resultEl = document.getElementById('aiResult');
        resultEl.innerText = 'Thinking up your message and workflow...';

        try {
          const res = await fetch('/api/ai-message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            resultEl.innerText = 'Error: ' + (err.error || 'Something went wrong.');
            return;
          }

          const data = await res.json();
          let display = '';

          if (data.primaryMessage) {
            display += 'Primary Message:\n\n' + data.primar
  </body>
  </html>`);
});

app.listen(port, () => {
  console.log(`Sales app backend listening on port ${port}`);
});
