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

// ---------------- Helper: scrape vehicle photos (with URL validation) ----------------

async function scrapeVehiclePhotos(pageUrl) {
  try {
    // Make sure we actually got a URL, not a VIN or random text
    let urlObj;
    try {
      urlObj = new URL(pageUrl);
    } catch {
      console.error(
        'scrapeVehiclePhotos: invalid pageUrl, expected a full URL but got:',
