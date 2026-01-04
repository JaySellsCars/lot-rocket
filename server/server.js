// /server/server.js — LOT ROCKET (FINAL / LAUNCH READY)

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ===============================
   BODY PARSING
================================ */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* ===============================
   STATIC FRONTEND
================================ */
app.use(express.static(path.join(__dirname, "../public")));

/* ===============================
   HEALTH
================================ */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "lot-rocket-1", ts: Date.now() });
});

/* ===============================
   SMALL UTILS
================================ */
const s = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const takeText = (...vals) => vals.map(s).map(t => t.trim()).find(Boolean) || "";
const normPlatform = (p) => ({
  fb: "facebook", facebook: "facebook",
  ig: "instagram", instagram: "instagram",
  tt: "tiktok", tiktok: "tiktok",
  li: "linkedin", linkedin: "linkedin",
  twitter: "x", x: "x",
  dm: "dm", sms: "dm", text: "dm",
  marketplace: "marketplace",
  hashtags: "hashtags",
  all: "all"
}[String(p||"").toLowerCase()] || "facebook");

/* ===============================
   OPENAI HELPER
================================ */
async function callOpenAI({ system, user, temperature = 0.8 }) {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "Missing OPENAI_API_KEY" };
  }

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content?.trim();
  return text ? { ok: true, text } : { ok: false, error: "Empty AI response" };
}

/* ===============================
   AI: SOCIAL POSTS (CORE VALUE)
================================ */
app.post("/api/ai/social", async (req, res) => {
  try {
    const vehicle = req.body.vehicle || {};
    const platform = normPlatform(req.body.platform);

    const system = `
You are LOT ROCKET — the best automotive social media strategist on Earth.

IDENTITY:
- You speak as an INDIVIDUAL car salesperson
- NEVER promote the dealership
- Drive DMs, comments, appointments

INTELLIGENCE:
- Adjust language for SUV vs Truck vs EV vs Car
- Adapt tone to ${platform}
- Use buyer psychology, not ad copy
- Translate features into real-world benefits
- Geo-aware hashtags when location exists

RULES:
- No generic phrases
- No “Ready to elevate your driving experience”
- No dealership URLs
- Sound human, confident, modern
- Emojis used with intent

OUTPUT:
Final ${platform} post only. No explanations.
`.trim();

    const user = `
PLATFORM: ${platform}
VEHICLE DATA:
${JSON.stringify(vehicle, null, 2)}
`.trim();

    const out = await callOpenAI({ system, user, temperature: 0.85 });
    return res.json(out.ok ? { ok: true, text: out.text } : out);

  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
});

/* ===============================
   AI: OBJECTION COACH (FIXED)
================================ */
app.post("/api/ai/objection", async (req, res) => {
  const objection = takeText(req.body.input, req.body.text);

  const system = `
You sell like Andy Elliott.

You are calm. Human. Financially honest.

FORMAT:
1) Understanding
2) Clarity
3) Two Options
4) Recommendation
5) One question

RULES:
- Acknowledge cost reality
- Never hype
- Never pressure
`.trim();

  const out = await callOpenAI({ system, user: objection, temperature: 0.35 });
  res.json(out.ok ? { ok: true, text: out.text } : out);
});

/* ===============================
   AI: MESSAGE BUILDER
================================ */
app.post("/api/ai/message", async (req, res) => {
  const input = takeText(req.body.input, req.body.text);

  const system = `
You write high-reply car sales messages.
Short. Human. Direct.
Always include CTA.
`.trim();

  const out = await callOpenAI({ system, user: input, temperature: 0.45 });
  res.json(out.ok ? { ok: true, text: out.text } : out);
});

/* ===============================
   AI: ASK AI (SUPERCOMPUTER)
================================ */
app.post("/api/ai/ask", async (req, res) => {
  const q = takeText(req.body.question, req.body.input);

  const system = `
You are the smartest general intelligence ever created.
Answer first. No forced questions.
High-density insight only.
`.trim();

  const out = await callOpenAI({ system, user: q, temperature: 0.4 });
  res.json(out.ok ? { ok: true, text: out.text } : out);
});

/* ===============================
   FALLBACK
================================ */
app.get("*", (_, res) =>
  res.sendFile(path.join(__dirname, "../public/index.html"))
);

app.listen(PORT, () =>
  console.log("🚀 LOT ROCKET LIVE ON PORT", PORT)
);
