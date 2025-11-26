// app.js
// Lot Rocket unified server:
// - Scrapes vehicle photos (skeleton)
// - AI message + multi-campaign workflow generator
// - Frontend:
//    - /       = simple home page
//    - /tools = Quick Deal Desk Tools (toolbar + calculators + AI tool)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 10000; // Render will use its own PORT env

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
        pageUrl
      );
      return [];
    }

    const res = await fetch(urlObj.toString());
    if (!res.ok) {
      console.error('Failed to fetch page for photos:', res.status);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const urls = new Set();

    $('img').each((i, el) => {
      let src = $(el).attr('data-src') || $(el).attr('src');
      if (!src) return;

      // Resolve relative URLs against the page URL
      try {
        const full =
