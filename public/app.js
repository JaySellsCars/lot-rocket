// public/script.js
// Lot Rocket · Social Media Kit – Front-end logic

'use strict';

const apiBase = '';

// ---------- DOM LOOKUPS ----------

// Step 1 / basics
const vehicleUrlInput = document.getElementById('vehicleUrl');
const vehicleLabelInput = document.getElementById('vehicleLabel');
const priceInfoInput = document.getElementById('priceInfo');
const boostButton = document.getElementById('boostButton');
const statusText = document.getElementById('statusText');

// Summary / social kit outputs
const summaryLabel = document.getElementById('summaryLabel');
const summaryPrice = document.getElementById('summaryPrice');

const facebookPost = document.getElementById('facebookPost');
const instagramPost = document.getElementById('instagramPost');
const tiktokPost = document.getElementById('tiktokPost');
const linkedinPost = document.getElementById('linkedinPost');
const twitterPost = document.getElementById('twitterPost');
const textBlurb = document.getElementById('textBlurb');
const marketplacePost = document.getElementById('marketplacePost');
const hashtags = document.getElementById('hashtags');
const videoScript = document.getElementById('videoScript');
const shotPlan = document.getElementById('shotPlan');

// Photos + video-from-photos
const buildVideoButton = document.getElementById('buildVideoButton');
const photosGrid = document.getElementById('photosGrid');
const photosStatus = document.getElementById('photosStatus');
const videoPlan = document.getElementById('videoPlan');

// Video engine (script)
const newScriptButton = document.getElementById('newScriptButton');

// Design Lab
const designTypeSelect = document.getElementById('designType');
const designButton = document.getElementById('designButton');
const designOutput = document.getElementById('designOutput');

// Theme
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');

// Floating tool launchers
const objectionLauncher = document.getElementById('objectionLauncher');
const paymentLauncher = document.getElementById('paymentLauncher');
const incomeLauncher = document.getElementById('incomeLauncher');
const messageLauncher = document.getElementById('messageLauncher');

// Objection modal
const objectionModal = document.getElementById('objectionModal');
const objectionCloseButton = document.getElementById('objectionCloseButton');
const objectionHistory = document.getElementById('objectionHistory');
const objectionInput = document.getElementById('objectionInput');
const objectionSendButton = document.getElementById('objectionSendButton');

// Payment modal
const paymentModal = document.getElementById('paymentModal');
const paymentCloseButton = document.getElementById('paymentCloseButton');
const payPrice = document.getElementById('payPrice');
const payDown = document.getElementById('payDown');
const payApr = document.getElementById('payApr');
const payTerm = document.getElementById('payTerm');
const paymentCalcButton = document.getElementById('paymentCalcButton');
const paymentResultText = document.getElementById('paymentResultText');

// Income modal
const incomeModal = document.getElementById('incomeModal');
const incomeCloseButton = document.getElementById('incomeCloseButton');
const incHourly = document.getElementById('incHourly');
const incHours = document.getElementById('incHours');
const incomeCalcButton = document.getElementById('incomeCalcButton');
const incomeResultText = document.getElementById('incomeResultText');

// AI Message modal
const messageModal = document.getElementById('messageModal');
const messageCloseButton = document.getElementById('messageCloseButton');
const msgChannel = document.getElementById('msgChannel');
const msgTone = document.getElementById('msgTone');
const msgFollowups = document.getElementById('msgFollowups');
const msgVariants = document.getElementById('msgVariants');
const msgAudience = document.getElementById('msgAudience');
const msgGoal = document.getElementById('msgGoal');
const msgDetails = document.getElementById('msgDetails');
const messageGenerateButton = document.getElementById('messageGenerateButton');
const msgResult = document.getElementById('msgResult');

// Copy buttons (Step 2)
const copyButtons = document.querySelectorAll('.copy-btn');

// Optional Creative Lab hooks (will only run if the HTML exists)
const creativeVideoIdeas = document.getElementById('creativeVideoIdeas');
const creativeCanvasNotes = document.getElementById('creativeCanvasNotes');
const creativeEditorNotes = document.getElementById('creativeEditorNotes');
const creativeGenerateVideoButton = document.getElementById('creativeGenerateVideoButton');

// ---------- STATE ----------

let currentPhotos = [];
let currentUrl = '';
let isBoosting = false;

// chat history for objection coach
// { role: 'user' | 'assistant', content: string }
let objectionMessages = [];

// ---------- THEME ----------

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    themeIcon.textContent = '🌙';
    themeLabel.textContent = 'Dark';
  } else {
    themeIcon.textContent = '☀️';
    themeLabel.textContent = 'Light';
  }
  try {
    localStorage.setItem('lotRocketTheme', theme);
  } catch (_) {
    // ignore
  }
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem('lotRocketTheme');
  } catch (_) {
    saved = null;
  }

  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved);
  } else {
    applyTheme('dark');
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

initTheme();

// ---------- HELPERS ----------

function setStatus(text, isLoading = false) {
  if (!statusText) return;
  if (isLoading) {
    statusText.innerHTML = '<span class="loading-dot"></span>' + text;
  } else {
    statusText.textContent = text;
  }
}

function safeTrim(str) {
  return (str || '').toString().trim();
}

function updateSummary(label, price) {
  if (summaryLabel) {
    summaryLabel.textContent = safeTrim(label) || 'Vehicle ready';
  }
  if (summaryPrice) {
    summaryPrice.textContent = safeTrim(price) || 'Message for current pricing';
  }
}

function fillSocialKit(kit) {
  if (!kit) return;
  if (facebookPost) facebookPost.value = kit.facebook || '';
  if (instagramPost) instagramPost.value = kit.instagram || '';
  if (tiktokPost) tiktokPost.value = kit.tiktok || '';
  if (linkedinPost) linkedinPost.value = kit.linkedin || '';
  if (twitterPost) twitterPost.value = kit.twitter || '';
  if (textBlurb) textBlurb.value = kit.textBlurb || '';
  if (marketplacePost) marketplacePost.value = kit.marketplace || '';
  if (hashtags) hashtags.value = kit.hashtags || '';
  if (videoScript) videoScript.value = kit.videoScript || '';
  if (shotPlan) shotPlan.value = kit.shotPlan || '';
}

function renderPhotosGrid(photos) {
  if (!photosGrid || !photosStatus) return;

  photosGrid.innerHTML = '';
  if (!photos || !photos.length) {
    photosStatus.textContent = 'No photos found yet.';
    return;
  }

  photos.forEach((url) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-thumb';
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Vehicle photo';
    wrapper.appendChild(img);
    wrapper.addEventListener('click', () => {
      window.open(url, '_blank');
    });
    photosGrid.appendChild(wrapper);
  });

  photosStatus.textContent =
    photos.length + ' photos found. Click any to open full size.';
}

async function callJson(endpoint, body) {
  const res = await fetch(apiBase + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('Request failed: ' + res.status + ' ' + txt);
  }
  return res.json();
}

// ---------- OBJECTION CHAT RENDER ----------

function renderObjectionChat() {
  if (!objectionHistory) return;

  objectionHistory.innerHTML = '';

  if (!objectionMessages.length) {
    const empty = document.createElement('div');
    empty.className = 'objection-bubble';
    empty.style.opacity = '0.7';
    empty.textContent =
      'Paste the customer objection (or ask a question) and your Andy Elliott–style coach will give you word tracks and breakdowns.';
    objectionHistory.appendChild(empty);
    return;
  }

  objectionMessages.forEach((m) => {
    const labelDiv = document.createElement('div');
    labelDiv.className =
      'objection-bubble ' + (m.role === 'assistant' ? 'coach-label' : 'you-label');
    labelDiv.textContent = m.role === 'assistant' ? 'COACH' : 'YOU';

    const bubble = document.createElement('div');
    bubble.className =
      'objection-bubble ' + (m.role === 'assistant' ? 'coach' : 'you');
    bubble.textContent = m.content || '';

    objectionHistory.appendChild(labelDiv);
    objectionHistory.appendChild(bubble);
  });

  objectionHistory.scrollTop = objectionHistory.scrollHeight;
}

// ---------- BOOST FLOW (Step 1) ----------

async function handleBoost() {
  if (isBoosting) return;
  if (!vehicleUrlInput) return;

  const url = safeTrim(vehicleUrlInput.value);
  if (!url) {
    alert('Paste a dealer vehicle URL first.');
    return;
  }

  let label = safeTrim(vehicleLabelInput && vehicleLabelInput.value);
  if (!label) {
    label = 'This vehicle';
    if (vehicleLabelInput) vehicleLabelInput.value = label;
  }

  let price = safeTrim(priceInfoInput && priceInfoInput.value);
  if (!price) {
    price = 'Message for current pricing';
    if (priceInfoInput) priceInfoInput.value = price;
  }

  isBoosting = true;
  if (boostButton) boostButton.disabled = true;
  setStatus('Building social kit with AI…', true);

  try {
    currentUrl = url;
    const resp = await callJson('/api/social-kit', { url, label, price });
    if (!resp.success) throw new Error('API returned error');
    fillSocialKit(resp.kit);
    updateSummary(label, price);
    setStatus('Social kit ready. You can spin new posts or scripts anytime.');

    // reset objection chat for the new vehicle
    objectionMessages = [];
    renderObjectionChat();

    // Auto load photos
    if (photosStatus) {
      photosStatus.textContent = 'Trying to grab photos from dealer page…';
    }
    try {
      const photoResp = await callJson('/api/grab-photos', { url });
      if (photoResp.success) {
        currentPhotos = photoResp.photos || [];
        renderPhotosGrid(currentPhotos);
      } else if (photosStatus) {
        photosStatus.textContent = 'Could not grab photos.';
      }
    } catch (err) {
      console.error('Auto photo grab failed:', err);
      if (photosStatus) {
        photosStatus.textContent = 'Auto photo load failed.';
      }
    }
  } catch (err) {
    console.error(err);
    setStatus('Something went wrong. Try again or check the URL.');
    alert('Error building social kit. Check the URL and try again.');
  } finally {
    isBoosting = false;
    if (boostButton) boostButton.disabled = false;
  }
}

if (boostButton) {
  boostButton.addEventListener('click', handleBoost);
}

// ---------- NEW POST BUTTONS (Step 2) ----------

document.querySelectorAll('.button-new-post').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const platform = btn.getAttribute('data-platform');
    const url = safeTrim(vehicleUrlInput && vehicleUrlInput.value);
    const label = safeTrim(vehicleLabelInput && vehicleLabelInput.value);
    const price = safeTrim(priceInfoInput && priceInfoInput.value);

    if (!url || !label) {
      alert('Please paste a URL and hit Boost at least once before spinning posts.');
      return;
    }

    btn.disabled = true;
    const oldText = btn.innerHTML;
    btn.innerHTML = '<span class="icon">⏳</span><span>Working…</span>';

    try {
      const resp = await callJson('/api/new-post', { platform, url, label, price });
      if (!resp.success) throw new Error('API returned error');
      const text = resp.post || '';

      switch (platform) {
        case 'facebook':
          if (facebookPost) facebookPost.value = text;
          break;
        case 'instagram':
          if (instagramPost) instagramPost.value = text;
          break;
        case 'tiktok':
          if (tiktokPost) tiktokPost.value = text;
          break;
        case 'linkedin':
          if (linkedinPost) linkedinPost.value = text;
          break;
        case 'twitter':
          if (twitterPost) twitterPost.value = text;
          break;
        case 'text':
          if (textBlurb) textBlurb.value = text;
          break;
        case 'marketplace':
          if (marketplacePost) marketplacePost.value = text;
          break;
        case 'hashtags':
          if (hashtags) hashtags.value = text;
          break;
      }
    } catch (err) {
      console.error(err);
      alert('Error generating a new post. Try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = oldText;
    }
  });
});

// ---------- NEW VIDEO SCRIPT ----------

if (newScriptButton) {
  newScriptButton.addEventListener('click', async () => {
    const url = safeTrim(vehicleUrlInput && vehicleUrlInput.value);
    const label = safeTrim(vehicleLabelInput && vehicleLabelInput.value);
    const price = safeTrim(priceInfoInput && priceInfoInput.value);

    if (!url || !label) {
      alert('Please paste a URL and hit Boost at least once before spinning scripts.');
      return;
    }

    newScriptButton.disabled = true;
    const oldText = newScriptButton.innerHTML;
    newScriptButton.innerHTML = '<span class="icon">⏳</span><span>Working…</span>';

    try {
      const resp = await callJson('/api/new-script', { url, label, price });
      if (!resp.success) throw new Error('API error');
      if (videoScript) videoScript.value = (resp.script || '').trim();
    } catch (err) {
      console.error(err);
      alert('Error generating a new script. Try again.');
    } finally {
      newScriptButton.disabled = false;
      newScriptButton.innerHTML = oldText;
    }
  });
}

// ---------- VIDEO FROM PHOTOS ----------

if (buildVideoButton) {
  buildVideoButton.addEventListener('click', async () => {
    if (!currentPhotos || !currentPhotos.length) {
      alert('No photos yet. Boost a listing first so we can grab photos.');
      return;
    }

    buildVideoButton.disabled = true;
    const oldText = buildVideoButton.innerHTML;
    buildVideoButton.innerHTML =
      '<span class="icon">⏳</span><span>Building…</span>';

    try {
      const label =
        safeTrim(vehicleLabelInput && vehicleLabelInput.value) || 'this vehicle';
      const resp = await callJson('/api/video-from-photos', {
        photos: currentPhotos,
        label,
      });
      if (!resp.success) throw new Error('API error');
      if (videoPlan) videoPlan.value = resp.plan || '';
    } catch (err) {
      console.error(err);
      alert('Error building video plan. Try again.');
    } finally {
      buildVideoButton.disabled = false;
      buildVideoButton.innerHTML = oldText;
    }
  });
}

// ---------- DESIGN LAB ----------

if (designButton) {
  designButton.addEventListener('click', async () => {
    const type = designTypeSelect && designTypeSelect.value;
    const url = safeTrim(vehicleUrlInput && vehicleUrlInput.value);
    const label = safeTrim(vehicleLabelInput && vehicleLabelInput.value);
    const price = safeTrim(priceInfoInput && priceInfoInput.value);

    if (!url || !label) {
      alert('Please paste a URL and hit Boost at least once before generating design ideas.');
      return;
    }

    designButton.disabled = true;
    const oldText = designButton.innerHTML;
    designButton.innerHTML = '<span class="icon">⏳</span><span>Designing…</span>';

    try {
      const resp = await callJson('/api/design-idea', { type, url, label, price });
      if (!resp.success) throw new Error('API error');
      if (designOutput) designOutput.value = (resp.design || '').trim();
    } catch (err) {
      console.error(err);
      alert('Error generating a design idea. Try again.');
    } finally {
      designButton.disabled = false;
      designButton.innerHTML = oldText;
    }
  });
}

// ---------- OBJECTION MODAL ----------

function openObjectionModal() {
  if (!objectionModal) return;
  objectionModal.classList.remove('hidden');
  if (!objectionMessages.length) {
    renderObjectionChat();
  }
  setTimeout(() => {
    if (objectionInput) objectionInput.focus();
  }, 50);
}

function closeObjectionModal() {
  if (!objectionModal) return;
  objectionModal.classList.add('hidden');
}

if (objectionLauncher) {
  objectionLauncher.addEventListener('click', openObjectionModal);
}
if (objectionCloseButton) {
  objectionCloseButton.addEventListener('click', closeObjectionModal);
}
if (objectionModal) {
  objectionModal.addEventListener('click', (e) => {
    if (e.target === objectionModal) closeObjectionModal();
  });
}

function sendObjection() {
  if (!objectionInput) return;
  const text = (objectionInput.value || '').trim();
  if (!text) {
    alert('Type the customer’s objection or your question first.');
    return;
  }

  const label =
    safeTrim(vehicleLabelInput && vehicleLabelInput.value) || 'this vehicle';
  const price =
    safeTrim(priceInfoInput && priceInfoInput.value) || 'Message for current pricing';

  objectionMessages.push({ role: 'user', content: text });
  renderObjectionChat();
  objectionInput.value = '';

  if (!objectionSendButton) return;

  objectionSendButton.disabled = true;
  const oldText = objectionSendButton.innerHTML;
  objectionSendButton.innerHTML = '<span>⏳ Coaching…</span>';

  callJson('/api/objection-coach', {
    messages: objectionMessages,
    label,
    price,
  })
    .then((resp) => {
      if (!resp.success) throw new Error('API error');
      const reply = resp.reply || '';
      objectionMessages.push({ role: 'assistant', content: reply });
      renderObjectionChat();
    })
    .catch((err) => {
      console.error(err);
      alert('Error generating a response. Try again.');
    })
    .finally(() => {
      objectionSendButton.disabled = false;
      objectionSendButton.innerHTML = oldText;
    });
}

if (objectionSendButton) {
  objectionSendButton.addEventListener('click', sendObjection);
}
if (objectionInput) {
  objectionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendObjection();
    }
  });
}

// ---------- PAYMENT MODAL ----------

function openPaymentModal() {
  if (!paymentModal) return;
  paymentModal.classList.remove('hidden');
  setTimeout(() => {
    if (payPrice) payPrice.focus();
  }, 50);
}
function closePaymentModal() {
  if (!paymentModal) return;
  paymentModal.classList.add('hidden');
}

if (paymentLauncher) {
  paymentLauncher.addEventListener('click', openPaymentModal);
}
if (paymentCloseButton) {
  paymentCloseButton.addEventListener('click', closePaymentModal);
}
if (paymentModal) {
  paymentModal.addEventListener('click', (e) => {
    if (e.target === paymentModal) closePaymentModal();
  });
}

function calculatePayment() {
  const price = parseFloat(payPrice && payPrice.value) || 0;
  const down = parseFloat(payDown && payDown.value) || 0;
  const apr = parseFloat(payApr && payApr.value) || 0;
  const term = parseInt(payTerm && payTerm.value, 10) || 0;

  const loanAmount = price - down;
  if (loanAmount <= 0 || term <= 0) {
    if (paymentResultText) {
      paymentResultText.textContent =
        'Enter a valid price, down payment, and term.';
    }
    return;
  }

  const monthlyRate = apr > 0 ? apr / 100 / 12 : 0;
  let payment;
  if (monthlyRate === 0) {
    payment = loanAmount / term;
  } else {
    const pow = Math.pow(1 + monthlyRate, term);
    payment = (loanAmount * (monthlyRate * pow)) / (pow - 1);
  }

  if (paymentResultText) {
    paymentResultText.textContent =
      'Estimated Payment: $' +
      payment.toFixed(2) +
      ' / month (rough estimate, not final finance terms).';
  }
}

if (paymentCalcButton) {
  paymentCalcButton.addEventListener('click', calculatePayment);
}

// ---------- INCOME MODAL ----------

function openIncomeModal() {
  if (!incomeModal) return;
  incomeModal.classList.remove('hidden');
  setTimeout(() => {
    if (incHourly) incHourly.focus();
  }, 50);
}
function closeIncomeModal() {
  if (!incomeModal) return;
  incomeModal.classList.add('hidden');
}

if (incomeLauncher) {
  incomeLauncher.addEventListener('click', openIncomeModal);
}
if (incomeCloseButton) {
  incomeCloseButton.addEventListener('click', closeIncomeModal);
}
if (incomeModal) {
  incomeModal.addEventListener('click', (e) => {
    if (e.target === incomeModal) closeIncomeModal();
  });
}

function calculateIncome() {
  const hourly = parseFloat(incHourly && incHourly.value) || 0;
  const hoursPerWeek = parseFloat(incHours && incHours.value) || 0;

  if (hourly <= 0 || hoursPerWeek <= 0) {
    if (incomeResultText) {
      incomeResultText.textContent =
        'Enter a valid hourly wage and hours per week.';
    }
    return;
  }

  const yearly = hourly * hoursPerWeek * 52;
  if (incomeResultText) {
    incomeResultText.textContent =
      'Estimated Yearly Gross Income: $' + yearly.toFixed(2);
  }
}

if (incomeCalcButton) {
  incomeCalcButton.addEventListener('click', calculateIncome);
}

// ---------- AI MESSAGE MODAL ----------

function openMessageModal() {
  if (!messageModal) return;
  messageModal.classList.remove('hidden');
  setTimeout(() => {
    if (msgGoal) msgGoal.focus();
  }, 50);
}
function closeMessageModal() {
  if (!messageModal) return;
  messageModal.classList.add('hidden');
}

if (messageLauncher) {
  messageLauncher.addEventListener('click', openMessageModal);
}
if (messageCloseButton) {
  messageCloseButton.addEventListener('click', closeMessageModal);
}
if (messageModal) {
  messageModal.addEventListener('click', (e) => {
    if (e.target === messageModal) closeMessageModal();
  });
}

async function generateMessages() {
  const channel = (msgChannel && msgChannel.value) || 'sms';
  const tone = (msgTone && msgTone.value) || 'friendly';
  const followups = parseInt(msgFollowups && msgFollowups.value, 10) || 4;
  const variants = parseInt(msgVariants && msgVariants.value, 10) || 2;
  const audience = safeTrim(msgAudience && msgAudience.value) || 'car buyer';
  const goal = safeTrim(msgGoal && msgGoal.value);
  const details = safeTrim(msgDetails && msgDetails.value);

  if (!goal && !details) {
    alert('Tell the AI what you’re trying to accomplish or give some details.');
    return;
  }

  if (!messageGenerateButton || !msgResult) return;

  messageGenerateButton.disabled = true;
  const oldText = messageGenerateButton.innerHTML;
  messageGenerateButton.innerHTML = '<span>⏳ Building…</span>';
  msgResult.value = 'Thinking up your messages and workflows…';

  try {
    const resp = await callJson('/api/ai-message', {
      channel,
      goal,
      details,
      audience,
      tone,
      followups,
      variants,
    });

    let display = '';

    if (Array.isArray(resp.variants)) {
      resp.variants.forEach((variant, idx) => {
        display += '=== Campaign Option ' + (idx + 1) + ' ===\n\n';
        if (variant.primaryMessage) {
          display += 'Primary Message:\n' + variant.primaryMessage + '\n\n';
        }
        if (Array.isArray(variant.campaign)) {
          display += 'Follow-up Workflow:\n';
          variant.campaign.forEach((step, sIdx) => {
            display +=
              '\nStep ' +
              (sIdx + 1) +
              ' - Day ' +
              (step.dayOffset ?? '?') +
              ' (' +
              (step.channel || 'sms') +
              ')';
            if (step.purpose) display += '\nPurpose: ' + step.purpose;
            if (step.message) display += '\nMessage: ' + step.message;
            display += '\n';
          });
        }
        display += '\n';
      });
    } else {
      display = 'No variants data returned from AI.';
    }

    msgResult.value = display || 'No data returned.';
  } catch (err) {
    console.error(err);
    msgResult.value = 'Error generating AI message workflow. Try again.';
  } finally {
    messageGenerateButton.disabled = false;
    messageGenerateButton.innerHTML = oldText;
  }
}

if (messageGenerateButton) {
  messageGenerateButton.addEventListener('click', generateMessages);
}

// ---------- COPY BUTTONS (Step 2) ----------

copyButtons.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const targetId = btn.getAttribute('data-target');
    if (!targetId) return;

    const field = document.getElementById(targetId);
    if (!field) {
      alert('Could not find field to copy from.');
      return;
    }

    const value = field.value || field.textContent || '';
    if (!value.trim()) {
      alert('Nothing to copy yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      const old = btn.innerHTML;
      btn.innerHTML = '<span class="icon">✅</span><span>Copied</span>';
      setTimeout(() => {
        btn.innerHTML = old;
      }, 1100);
    } catch (err) {
      console.error('Clipboard error:', err);
      alert('Could not copy to clipboard. You can still select and copy manually.');
    }
  });
});

// ---------- CREATIVE LAB (OPTIONAL, SAFE) ----------

// Example: simple random short-form video idea generator based on existing shots.
// Only runs if IDs exist in the HTML.
if (creativeGenerateVideoButton && creativeVideoIdeas) {
  creativeGenerateVideoButton.addEventListener('click', () => {
    const label =
      safeTrim(vehicleLabelInput && vehicleLabelInput.value) || 'this vehicle';

    const ideas = [
      `Hook with a quick walk up to ${label}, punch in on the front grille, then snap cut to the interior with on-screen text: “Is this your next ride?”`,
      `Start with a door close shot of ${label}, then a fast montage of 3–4 interior clips synced to a beat. Overlay big text: “Payments less than your phone bill?”`,
      `Do a POV test-drive style video in ${label}, filming from the driver’s seat. Emphasize tech, comfort, and how it feels when you first drive it off the lot.`,
      `Film a 360° walk-around of ${label} in under 10 seconds, then punch in on your favorite feature (sunroof / screen / wheels) with “DM ‘INFO’ for a private walk-through.”`,
      `Start with you tossing the keys in the air next to ${label}, then hard cut to the dash, backup camera, and rear seat space. End with “Who needs this?” and a pointing arrow.`,
    ];

    const idea = ideas[Math.floor(Math.random() * ideas.length)];
    creativeVideoIdeas.value = idea;
  });
}

// initial render of objection chat (blank message)
renderObjectionChat();
