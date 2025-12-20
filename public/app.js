// public/app.js – Lot Rocket frontend logic v2.6 (CLEAN SINGLE-PASS)
// Goal: one boot, one store, one wiring pass, zero duplicate blocks, zero syntax landmines.

window.document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 JS FILE LOADED");

  // ===============================
  // TRUTH HOOK — PROVE CLICKS / OVERLAYS
  // ===============================
  console.log("🧪 TRUTH HOOK ACTIVE");

  document.addEventListener(
    "click",
    (e) => {
      const el = e.target;
      console.log("🖱️ CLICK:", el.tagName, el.id ? `#${el.id}` : "", el.className || "");
    },
    true
  );

  window.addEventListener("error", (e) => {
    console.error("💥 WINDOW ERROR:", e.message, e.filename, e.lineno);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("💥 PROMISE REJECTION:", e.reason);
  });

  const DOC = window.document;
  const $ = (id) => DOC.getElementById(id);

  // ✅ BOOT GUARD
  if (window.__LOTROCKET_BOOTED__) {
    console.warn("🚫 Lot Rocket boot blocked (double init)");
    return;
  }
  window.__LOTROCKET_BOOTED__ = true;

  console.log("✅ Lot Rocket frontend loaded (v2.6 clean) BRANCH: test/clean-rewrite");
  const apiBase = "";
let imageUrls = [];

  // ==================================================
  // CORE CONSTANTS + SINGLE GLOBAL STORE
  // ==================================================
  const MAX_PHOTOS = 24;

  window.LOTROCKET = window.LOTROCKET || {};
  const STORE = window.LOTROCKET;

  STORE.creativePhotos = Array.isArray(STORE.creativePhotos) ? STORE.creativePhotos : [];
  STORE.designStudioPhotos = Array.isArray(STORE.designStudioPhotos) ? STORE.designStudioPhotos : [];
  STORE.socialReadyPhotos = Array.isArray(STORE.socialReadyPhotos) ? STORE.socialReadyPhotos : [];

  STORE.lastTitle = STORE.lastTitle || "";
  STORE.lastPrice = STORE.lastPrice || "";

  STORE.step1Photos = Array.isArray(STORE.step1Photos) ? STORE.step1Photos : []; // [{url, selected, dead}]
  STORE.lastBoostPhotos = Array.isArray(STORE.lastBoostPhotos) ? STORE.lastBoostPhotos : []; // [url]

  let socialIndex = 0;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // ==================================================
  // UTIL
  // ==================================================
  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 4 + "px";
  }

  function parseSrcset(srcset) {
    if (!srcset) return [];
    return String(srcset)
      .split(",")
      .map((s) => s.trim().split(/\s+/)[0])
      .filter(Boolean);
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error || data?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  function normalizeSocialReady() {
    STORE.socialReadyPhotos = (STORE.socialReadyPhotos || [])
      .map((p) =>
        typeof p === "string" ? { url: p, originalUrl: p, selected: true, locked: false } : p
      )
      .filter((p) => p && p.url);

    if (STORE.socialReadyPhotos.length > MAX_PHOTOS) {
      STORE.socialReadyPhotos = STORE.socialReadyPhotos.slice(-MAX_PHOTOS);
    }

    if (!STORE.socialReadyPhotos.length) socialIndex = 0;
    else socialIndex = clamp(socialIndex, 0, STORE.socialReadyPhotos.length - 1);
  }

  // Proxy helper for CORS-sensitive images
  function getProxiedImageUrl(rawUrl) {
    if (!rawUrl) return rawUrl;
    try {
      const u = new URL(rawUrl, window.location.origin);

      if (u.origin === window.location.origin || u.protocol === "blob:" || u.protocol === "data:") {
        return rawUrl;
      }

      if (u.pathname.startsWith("/api/proxy-image")) return rawUrl;
      return `/api/proxy-image?url=${encodeURIComponent(u.href)}`;
    } catch {
      return rawUrl;
    }
  }

  function triggerDownload(url, filename) {
    if (!url) return;
    const a = DOC.createElement("a");
    a.href = url;
    a.download = filename || "lot-rocket.jpg";
    a.rel = "noopener";
    DOC.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ==================================================
  // THEME TOGGLE (single source)
  // ==================================================
  const themeToggleInput = $("themeToggle");

  function applyTheme(isDark) {
    DOC.body.classList.toggle("dark-theme", isDark);
    if (themeToggleInput) themeToggleInput.checked = isDark;
  }

  applyTheme(true);

  if (themeToggleInput) {
    themeToggleInput.addEventListener("change", () => {
      applyTheme(themeToggleInput.checked);
    });
  }

  DOC.querySelectorAll("textarea").forEach((ta) => {
    autoResizeTextarea(ta);
    ta.addEventListener("input", () => autoResizeTextarea(ta));
  });

  // ==================================================
  // STEP 1 — BOOST + PHOTO GRID (SINGLE COPY ONLY)
  // ==================================================
  const dealerUrlInput = $("dealerUrl");
  const vehicleLabelInput = $("vehicleLabel");
  const priceOfferInput = $("priceOffer");

  // IMPORTANT: boostBtn is LET because bulletproof picker will override it
  let boostBtn =
    $("boostListingBtn") || $("boostThisListingBtn") || $("boostThisListing") || $("boostButton") || null;

  const sendTopBtn =
    $("sendTopPhotosBtn") ||
    $("sendPhotosToCreative") ||
    $("sendTopPhotosToCreative") ||
    $("sendTopPhotosToCreativeLab") ||
    $("sendPhotosToCreativeLab") ||
    $("sendTopPhotosToDesignStudio") ||
    $("sendPhotosToStudio") ||
    $("sendPhotosToDesignStudio") ||
    null;

  const vehicleTitleEl = $("vehicleTitle") || $("vehicleName") || $("summaryVehicle");
  const vehiclePriceEl = $("vehiclePrice") || $("summaryPrice");
  const photosGridEl = $("photosGrid");

  function setBtnLoading(btn, isLoading, label) {
    if (!btn) return;
    if (isLoading) {
      if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
      btn.textContent = label || "Working…";
      btn.disabled = true;
      btn.classList.add("btn-loading");
    } else {
      btn.textContent = btn.dataset.originalText || btn.textContent;
      btn.disabled = false;
      btn.classList.remove("btn-loading");
    }
  }

  function extractPhotoUrlsFromDom() {
    const urls = [];

    DOC.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      const d1 = img.getAttribute("data-src");
      const d2 = img.getAttribute("data-lazy");
      const d3 = img.getAttribute("data-original");
      const srcset = img.getAttribute("srcset");

      if (d1) urls.push(d1);
      if (d2) urls.push(d2);
      if (d3) urls.push(d3);
      if (src) urls.push(src);

      if (srcset) {
        const parsed = parseSrcset(srcset);
        const pick = parsed[parsed.length - 1];
        if (pick) urls.push(pick);
      }
    });

    DOC.querySelectorAll("[style*='background']").forEach((el) => {
      const style = el.getAttribute("style") || "";
      const m = style.match(/background-image\s*:\s*url\(["']?(.*?)["']?\)/i);
      if (m && m[1]) urls.push(m[1]);
    });

    DOC.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (/\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(href)) urls.push(href);
    });

    return urls;
  }

  function extractBoostPhotosFromResponse(data) {
    // BACKEND RETURNS: { title, price, photos }
    const arr = data?.photos || data?.imageUrls || data?.images || [];
    return Array.isArray(arr) ? arr : [];
  }

  function extractBoostTitleFromResponse(data) {
    return data?.title || data?.vehicle || data?.name || "";
  }

  function extractBoostPriceFromResponse(data) {
    return data?.price || data?.msrp || data?.internetPrice || "";
  }

  // ✅ REQUIRED: normalizeUrl (fixes "normalizeUrl is not defined")
  function normalizeUrl(input) {
    if (!input) return "";
    let u = ("" + input).trim();
    if (!u) return "";

    if (u.startsWith("blob:")) return u;
    if (u.startsWith("data:")) return u;

    if ((u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'"))) {
      u = u.slice(1, -1).trim();
    }

    if (u.startsWith("//")) u = "https:" + u;

    try {
      const url = new URL(u, window.location.href);
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((k) =>
        url.searchParams.delete(k)
      );
      return url.origin + url.pathname + (url.search ? url.search : "");
    } catch {
      return u;
    }
  }

  function uniqCleanCap(arr, cap) {
    const max = typeof cap === "number" && cap > 0 ? cap : MAX_PHOTOS;
    if (!Array.isArray(arr)) return [];

    const out = [];
    const seen = new Set();

    for (let i = 0; i < arr.length; i++) {
      let raw = arr[i];
      if (raw && typeof raw === "object" && raw.url) raw = raw.url;

      const u = normalizeUrl(raw);
      if (!u) continue;

      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
        if (out.length >= max) break;
      }
    }
    return out;
  }

  function setStep1FromUrls(urls) {
    const clean = uniqCleanCap(urls || [], MAX_PHOTOS);

    const prev = Array.isArray(STORE.step1Photos) ? STORE.step1Photos : [];
    const prevSel = new Map(prev.map((p) => [p?.url, !!p?.selected]));

    STORE.step1Photos = clean.map((u) => ({
      url: u,
      selected: prevSel.get(u) || false,
      dead: false,
    }));
  }

  function getSelectedStep1Urls(max) {
    const lim = Number.isFinite(max) ? max : MAX_PHOTOS;
    return (STORE.step1Photos || [])
      .filter((p) => p && !p.dead && p.selected && p.url)
      .map((p) => p.url)
      .slice(0, lim);
  }

  function renderStep1Photos(urls) {
    if (!photosGridEl) return;

    setStep1FromUrls(urls);

    photosGridEl.style.display = "grid";
    photosGridEl.style.gridTemplateColumns = "repeat(4, 1fr)";
    photosGridEl.style.gap = "8px";
    photosGridEl.innerHTML = "";

    (STORE.step1Photos || []).forEach((item, idx) => {
      const src = getProxiedImageUrl(item.url);

      const btn = DOC.createElement("button");
      btn.type = "button";
      btn.className = "photo-thumb";
      btn.setAttribute("data-i", String(idx));
      btn.style.position = "relative";
      btn.style.height = "64px";
      btn.style.borderRadius = "12px";
      btn.style.overflow = "hidden";
      btn.style.border = "1px solid rgba(148,163,184,.55)";
      btn.style.background = "#0b1120";
      btn.style.padding = "0";
      btn.style.cursor = "pointer";
      btn.style.opacity = item.selected ? "1" : "0.85";

      const img = DOC.createElement("img");
      img.src = src;
      img.alt = "photo";
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.display = "block";
      img.style.objectFit = "cover";

      const check = DOC.createElement("span");
      check.className = "photo-check";
      check.textContent = "✓";
      check.style.position = "absolute";
      check.style.top = "6px";
      check.style.right = "6px";
      check.style.width = "18px";
      check.style.height = "18px";
      check.style.borderRadius = "999px";
      check.style.background = "rgba(0,0,0,.55)";
      check.style.color = "#fff";
      check.style.fontSize = "12px";
      check.style.lineHeight = "18px";
      check.style.textAlign = "center";
      check.style.display = item.selected ? "block" : "none";

      btn.appendChild(img);
      btn.appendChild(check);
      photosGridEl.appendChild(btn);
    });

    photosGridEl.onclick = (e) => {
      const btnEl = e?.target?.closest ? e.target.closest("[data-i]") : null;
      if (!btnEl) return;

      const idx = Number(btnEl.getAttribute("data-i"));
      const item = STORE.step1Photos[idx];
      if (!item || item.dead) return;

      item.selected = !item.selected;

      btnEl.style.opacity = item.selected ? "1" : "0.45";
      const check = btnEl.querySelector(".photo-check");
      if (check) check.style.display = item.selected ? "block" : "none";
    };
  }

  async function boostListing() {
    const url = (dealerUrlInput?.value || "").trim();
    if (!url) return alert("Paste a dealer URL first.");
    if (!boostBtn) return alert("Boost button not found.");

    setBtnLoading(boostBtn, true, "Boosting…");

    try {
      const payload = {
        url,
        labelOverride: (vehicleLabelInput?.value || "").trim(),
        priceOverride: (priceOfferInput?.value || "").trim(),
        maxPhotos: MAX_PHOTOS,
      };

      const data = await postJSON(`${apiBase}/api/boost`, payload);

      const title = extractBoostTitleFromResponse(data);
      const price = extractBoostPriceFromResponse(data);
      const photos = extractBoostPhotosFromResponse(data);

      const domPhotos = extractPhotoUrlsFromDom();
      const merged = [...(photos || []), ...(domPhotos || [])];

      STORE.lastBoostPhotos = uniqCleanCap(merged, MAX_PHOTOS);
      STORE.lastTitle = title;
      STORE.lastPrice = price;

      if (vehicleTitleEl) vehicleTitleEl.textContent = title || "—";
      if (vehiclePriceEl) vehiclePriceEl.textContent = price || "—";

      renderStep1Photos(STORE.lastBoostPhotos);

      console.log("✅ Boost complete", { count: STORE.lastBoostPhotos.length });
    } catch (e) {
      console.error("❌ Boost failed:", e);
      alert(e?.message || "Boost failed.");
    } finally {
      setBtnLoading(boostBtn, false);
    }
  }

  function sendSelectedToCreative() {
    if (!sendTopBtn) return;

    setBtnLoading(sendTopBtn, true, "Sending…");

    try {
      const selected = getSelectedStep1Urls(MAX_PHOTOS);
      if (!selected.length) {
        alert("Select at least 1 photo first.");
        return;
      }

      const deduped = uniqCleanCap(selected, MAX_PHOTOS);

      STORE.creativePhotos = deduped;
      STORE.designStudioPhotos = deduped;
      STORE.socialReadyPhotos = deduped.map((u) => ({
        url: u,
        originalUrl: u,
        selected: true,
        locked: false,
      }));

      normalizeSocialReady();

      if (typeof renderCreativeThumbs === "function") renderCreativeThumbs();
      if (typeof renderSocialStrip === "function") renderSocialStrip();
      if (typeof refreshDesignStudioStrip === "function") refreshDesignStudioStrip();

      console.log("✅ Sent to Step 3", { count: deduped.length });
    } catch (e) {
      console.error("❌ Send to Step 3 failed:", e);
      alert(e?.message || "Send failed.");
    } finally {
      setTimeout(() => {
        try {
          setBtnLoading(sendTopBtn, false);
        } catch (_) {}
      }, 250);
    }
  }

  // ===============================
  // BOOST BUTTON — BULLETPROOF WIRE
  // Sets boostBtn to the actual visible/clickable element.
  // ===============================
  (function wireBoostBulletproof() {
    const ids = ["boostThisListingBtn", "boostListingBtn", "boostThisListing", "boostButton"];

    const candidates = ids.flatMap((id) => Array.from(DOC.querySelectorAll(`#${CSS.escape(id)}`)));

    const pick =
      candidates.find((el) => {
        const r = el.getBoundingClientRect();
        const visible = r.width > 0 && r.height > 0;
        const notHidden = !!(el.offsetParent || el.getClientRects().length);
        return visible && notHidden;
      }) || null;

    console.log("🔎 Boost candidates:", candidates.map((e) => `#${e.id}`).join(", ") || "NONE");
    console.log("🔎 Boost picked:", pick ? `#${pick.id}` : "NONE");

    if (!pick) return;

    // overwrite boostBtn with the real one
    boostBtn = pick;

    // Force it clickable
    pick.disabled = false;
    pick.removeAttribute("disabled");
    pick.removeAttribute("aria-disabled");
    pick.style.pointerEvents = "auto";
    pick.style.cursor = "pointer";
    pick.style.zIndex = "9999";
    pick.onclick = null;

    if (pick.dataset.wired === "true") {
      console.log("ℹ️ Boost already wired:", pick.id);
      return;
    }
    pick.dataset.wired = "true";
    pick.type = "button";

    pick.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log("🟢 BOOST CLICKED:", pick.id);

        const r = pick.getBoundingClientRect();
        const topEl = DOC.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        console.log(
          "🧱 Element on top of Boost:",
          topEl ? (topEl.id ? `#${topEl.id}` : topEl.tagName) : "NONE",
          topEl
        );

        try {
          await boostListing();
          console.log("🟢 boostListing finished");
        } catch (err) {
          console.error("❌ boostListing error:", err);
        }
      },
      true
    );

    console.log("✅ Boost wired (pick):", pick.id);
  })();

  // ---------- Wire SEND TOP button ONCE ----------
  if (sendTopBtn && sendTopBtn.dataset.wired !== "true") {
    sendTopBtn.dataset.wired = "true";
    sendTopBtn.type = "button";
    sendTopBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sendSelectedToCreative();
    });
  }

  // ===============================
  // FINAL INIT (SAFE BOOT) — SINGLE COPY ONLY
  // ===============================
  try {
    console.log("✅ FINAL INIT REACHED");

    if (Array.isArray(STORE.lastBoostPhotos) && STORE.lastBoostPhotos.length) {
      renderStep1Photos(STORE.lastBoostPhotos);
    }

    if (typeof renderCreativeThumbs === "function") renderCreativeThumbs();
    if (typeof renderSocialStrip === "function") renderSocialStrip();
    if (typeof wireObjectionCoach === "function") wireObjectionCoach();
  } catch (e) {
    console.error("❌ Final init failed:", e);
  }
});
