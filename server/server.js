const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend
app.use(express.static(path.join(__dirname, "../public")));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// 🚨 THIS LINE IS REQUIRED OR RENDER WILL EXIT
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});


