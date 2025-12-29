// ==================================================
// HIDE NEXT-VERSION UI (SINGLE SOURCE, SAFE + PERSISTENT)
// Hides:
// - Tool rail future buttons (Image AI / Video AI / Canvas / Design + long label variants)
// - Step 3 button: #sendToDesignStudio
// - Bottom sections: Video Script / Shot List / AI Video Prompt / Thumbnail Prompt / Canvas Studio overlay
// Survives re-renders via MutationObserver + retry
// ==================================================
function installHideNextVersionUI() {
  // 1) Best: hide by data-ai-action (stable)
  const actionsToHide = new Set([
    "image_ai",
    "video_ai",
    "canvas_studio",
    "design_studio",
    "canvas",
    "design",
    "image",
    "video",
  ]);

  // 2) Fallback: hide by visible label
  const labelMatchers = [
    /^ai image generation$/i,
    /^ai video generation$/i,
    /^canvas studio$/i,
    /^design studio$/i,
    /^image ai$/i,
    /^video ai$/i,
    /^canvas$/i,
    /^design$/i,
    /^image$/i,
    /^video$/i,
  ];

  // 3) Bottom sections (the ones in your screenshots)
  const sectionHeadMatchers = [
    /^1\.\s*video script\s*\(spoken\)$/i,
    /^2\.\s*shot list\s*\(timeline\)$/i,
    /^3\.\s*ai video generator prompt$/i,
    /^4\.\s*thumbnail prompt$/i,
    /^canvas studio\s*[-–]\s*creative overlay$/i,
    /^design studio 3\.0\s*\(beta\)$/i,
  ];

  const normalize = (s) =>
    String(s || "")
      .replace(/\s+/g, " ")
      .replace(/[^\w\s().\-–]/g, "") // keep numbers/punctuation used in headings
      .trim();

  const shouldHideLabel = (label) => labelMatchers.some((rx) => rx.test(label));

  const hideEl = (el) => {
    if (!el || el.dataset.lrHidden === "true") return false;
    el.dataset.lrHidden = "true";
    el.setAttribute("aria-hidden", "true");
    el.hidden = true;
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("pointer-events", "none", "important");
    return true;
  };

  const findSectionContainer = (el) => {
    if (!el) return null;
    return (
      el.closest(
        "section, article, .lab-card, .panel, .card, .tool, .tool-card, .modal, .side-modal, .overlay, .studio, .studio-panel, .generator, .ai-generator"
      ) ||
      el.parentElement ||
      null
    );
  };

  const hideByHeadingText = () => {
    let hidden = 0;
    const nodes = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,strong,b,label,div"));
    nodes.forEach((n) => {
      const txt = normalize(n.textContent);
      if (!txt || txt.length > 90) return;
      if (!sectionHeadMatchers.some((rx) => rx.test(txt))) return;

      const container = findSectionContainer(n);
      if (hideEl(container)) hidden++;
    });
    return hidden;
  };

  const hideNow = () => {
    let hidden = 0;

    // A) Hide Step 3 “Send Selected to Design Studio 3.5”
    const step3Btn = document.getElementById("sendToDesignStudio");
    if (step3Btn) hidden += hideEl(step3Btn) ? 1 : 0;

    // B) Hide future buttons by data-ai-action
    document.querySelectorAll("[data-ai-action]").forEach((el) => {
      const action = (el.getAttribute("data-ai-action") || "").trim();
      if (action && actionsToHide.has(action)) {
        if (hideEl(el)) hidden++;
      }
    });

    // C) Fallback: hide by label anywhere
    document.querySelectorAll("button, a, [role='button']").forEach((el) => {
      const label = normalize(el.textContent);
      if (!label) return;
      if (shouldHideLabel(label)) {
        if (hideEl(el)) hidden++;
      }
    });

    // D) Hide bottom blocks by heading text
    hidden += hideByHeadingText();

    console.log("🙈 installHideNextVersionUI hidden:", hidden);
    return hidden;
  };

  // run once
  hideNow();

  // install observer ONCE
  if (!installHideNextVersionUI.__installed) {
    installHideNextVersionUI.__installed = true;

    const obs = new MutationObserver(() => hideNow());
    obs.observe(document.body, { childList: true, subtree: true });

    console.log("✅ installHideNextVersionUI observer installed");
  }

  // retry loop (late renders)
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    hideNow();
    if (tries >= 25) clearInterval(timer);
  }, 200);
}
