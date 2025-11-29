// public/app.js

document.addEventListener('DOMContentLoaded', () => {
  const apiBase = '';

  // -----------------------------
  // DOM ELEMENTS – STEP 1 & 2
  // -----------------------------

  const vehicleUrlInput = document.getElementById('vehicleUrl');
  const vehicleLabelInput = document.getElementById('vehicleLabel');
  const priceInfoInput = document.getElementById('priceInfo');
  const boostButton = document.getElementById('boostButton');
  const statusText = document.getElementById('statusText');

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

  const buildVideoButton = document.getElementById('buildVideoButton');
  const photosGrid = document.getElementById('photosGrid');
  const photosStatus = document.getElementById('photosStatus');
  const videoPlan = document.getElementById('videoPlan');

  const newScriptButton = document.getElementById('newScriptButton');

  const designTypeSelect = document.getElementById('designType');
  const designButton = document.getElementById('designButton');
  const designOutput = document.getElementById('designOutput');

  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const themeLabel = document.getElementById('themeLabel');

  const newPostButtons = document.querySelectorAll('.button-new-post');
  const copyButtons = document.querySelectorAll('.button-copy');

  // -----------------------------
  // FLOATING TOOL LAUNCHERS
  // -----------------------------
  const objectionLauncher = document.getElementById('objectionLauncher');
  const paymentLauncher = document.getElementById('paymentLauncher');
  const incomeLauncher = document.getElementById('incomeLauncher');
  const messageLauncher = document.getElementById('messageLauncher');

  // -----------------------------
  // OBJECTION MODAL
  // -----------------------------
  const objectionModal = document.getElementById('objectionModal');
  const objectionCloseButton = document.getElementById('objectionCloseButton');
  const objectionHistory = document.getElementById('objectionHistory');
  const objectionInput = document.getElementById('objectionInput');
  const objectionSendButton = document.getElementById('objectionSendButton');

  // -----------------------------
  // PAYMENT MODAL
  // -----------------------------
  const paymentModal = document.getElementById('paymentModal');
  const paymentCloseButton = document.getElementById('paymentCloseButton');
  const payPrice = document.getElementById('payPrice');
  const payDown = document.getElementById('payDown');
  const payApr = document.getElementById('payApr');
  const payTerm = document.getElementById('payTerm');
  const paymentCalcButton = document.getElementById('paymentCalcButton');
  const paymentResultText = document.getElementById('paymentResultText');

  // -----------------------------
  // INCOME MODAL
  // -----------------------------
  const incomeModal = document.getElementById('incomeModal');
  const incomeCloseButton = document.getElementById('incomeCloseButton');
  const incHourly = document.getElementById('incHourly');
  const incHours = document.getElementById('incHours');
  const incomeCalcButton = document.getElementById('incomeCalcButton');
  const incomeResultText = document.getElementById('incomeResultText');

  // -----------------------------
  // MESSAGE BUILDER MODAL
  // -----------------------------
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

  // -----------------------------
  // STEP 3 · CREATIVE LAB ELEMENTS
  // -----------------------------

  // Quick Sales Video
  const creativeVideoVehicle = document.getElementById('creativeVideoVehicle');
  const creativeVideoHook = document.getElementById('creativeVideoHook');
  const creativeVideoAspect = document.getElementById('creativeVideoAspect');
  const creativeVideoLength = document.getElementById('creativeVideoLength');
  const creativeVideoStyle = document.getElementById('creativeVideoStyle');
  const generateVideoPlanBtn = document.getElementById('generateVideoPlanBtn');
  const creativeVideoOutput = document.getElementById('creativeVideoOutput');

  // Canva-style Layout Planner
  const creativeLayoutType = document.getElementById('creativeLayoutType');
  const creativeLayoutHeadline = document.getElementById('creativeLayoutHeadline');
  const creativeLayoutCta = document.getElementById('creativeLayoutCta');
  const creativeLayoutBrand = document.getElementById('creativeLayoutBrand');
  const generateLayoutPlanBtn = document.getElementById('generateLayoutPlanBtn');
  const creativeLayoutOutput = document.getElementById('creativeLayoutOutput');

  // Photo & Video Quick Editor
  const creativeEditorFile = document.getElementById('creativeEditorFile');
  const creativeEditorPlaceholder = document.getElementById('creativeEditorPlaceholder');
  const creativeEditorImage = document.getElementById('creativeEditorImage');
  const creativeEditorBrightness = document.getElementById('creativeEditorBrightness');
  const creativeEditorContrast = document.getElementById('creativeEditorContrast');
  const creativeEditorSaturation = document.getElementById('creativeEditorSaturation');

  // -----------------------------
  // STATE
  // -----------------------------

  let currentPhotos = [];
  let currentUrl = '';
  let isBoosting = false;
  let objectionMessages = []; // { role: 'user' | 'assistant', content: string }

  // -----------------------------
  // THEME
  // -----------------------------

  function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      if (themeIcon) themeIcon.textContent = '🌙';
      if (themeLabel) themeLabel.textContent = 'Dark';
    } else {
      if (themeIcon) themeIcon.textContent = '☀️';
      if (themeLabel) themeLabel.textContent = 'Light';
    }
    try {
      localStorage.setItem('lotRocketTheme', theme);
    } catch (e) {
      console.warn('Theme save error:', e);
    }
  }

  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem('lotRocketTheme');
    } catch (e) {
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

  // -----------------------------
  // HELPERS
  // -----------------------------

  function safeTrim(str) {
    return (str || '').toString().trim();
  }

  function setStatus(text, isLoading = false) {
    if (!statusText) return;
    if (isLoading) {
      statusText.innerHTML = '<span class="loading-dot"></span>' + text;
    } else {
      statusText.textContent = text;
    }
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
    photosStatus.textContent = photos.length + ' photos found. Click any to open full size.';
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

  // -----------------------------
  // OBJECTION CHAT RENDER
  // -----------------------------

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
      bubble.className = 'objection-bubble ' + (m.role === 'assistant' ? 'coach' : 'you');
      bubble.textContent = m.content || '';

      objectionHistory.appendChild(labelDiv);
      objectionHistory.appendChild(bubble);
    });

    objectionHistory.scrollTop = objectionHistory.scrollHeight;
  }

  // -----------------------------
  // STEP 1: BOOST FLOW
  // -----------------------------

  async function handleBoost() {
    if (isBoosting) return;
    if (!boostButton) return;

    const url = safeTrim(vehicleUrlInput && vehicleUrlInput.value);
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
    boostButton.disabled = true;
    setStatus('Building social kit with AI…', true);

    try {
      currentUrl = url;
      const resp = await callJson('/api/social-kit', { url, label, price });
      if (!resp.success) throw new Error('API returned error');
      fillSocialKit(resp.kit || {});
      updateSummary(label, price);
      setStatus('Social kit ready. You can spin new posts or scripts anytime.');

      // reset objection chat for new vehicle
      objectionMessages = [];
      renderObjectionChat();

      // Auto-load photos
      if (photosStatus) photosStatus.textContent = 'Trying to grab photos from dealer page…';
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
        if (photosStatus) photosStatus.textContent = 'Auto photo load failed.';
      }
    } catch (err) {
      console.error(err);
      setStatus('Something went wrong. Try again or check the URL.');
      alert('Error building social kit. Check the URL and try again.');
    } finally {
      isBoosting = false;
      boostButton.disabled = false;
    }
  }

  if (boostButton) {
    boostButton.addEventListener('click', handleBoost);
  }

  // -----------------------------
  // STEP 2: NEW POST BUTTONS
  // -----------------------------

  if (newPostButtons && newPostButtons.length) {
    newPostButtons.forEach((btn) => {
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
  }

  // -----------------------------
  // STEP 2: NEW VIDEO SCRIPT
  // -----------------------------

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
        if (videoScript) videoScript.value = resp.script || '';
      } catch (err) {
        console.error(err);
        alert('Error generating a new script. Try again.');
      } finally {
        newScriptButton.disabled = false;
        newScriptButton.innerHTML = oldText;
      }
    });
  }

  // -----------------------------
  // STEP 2: BUILD VIDEO FROM PHOTOS
  // -----------------------------

  if (buildVideoButton) {
    buildVideoButton.addEventListener('click', async () => {
      if (!currentPhotos || !currentPhotos.length) {
        alert('No photos yet. Boost a listing first so we can grab photos.');
        return;
      }

      buildVideoButton.disabled = true;
      const oldText = buildVideoButton.innerHTML;
      buildVideoButton.innerHTML = '<span class="icon">⏳</span><span>Building…</span>';

      try {
        const label = safeTrim(vehicleLabelInput && vehicleLabelInput.value) || 'this vehicle';
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

  // -----------------------------
  // STEP 2: DESIGN LAB
  // -----------------------------

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
        if (designOutput) designOutput.value = resp.design || '';
      } catch (err) {
        console.error(err);
        alert('Error generating a design idea. Try again.');
      } finally {
        designButton.disabled = false;
        designButton.innerHTML = oldText;
      }
    });
  }

  // -----------------------------
  // COPY BUTTONS (STEP 2)
  // -----------------------------

  if (copyButtons && copyButtons.length) {
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
  }

  // -----------------------------
  // OBJECTION COACH MODAL LOGIC
  // -----------------------------

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
      if (e.target === objectionModal) {
        closeObjectionModal();
      }
    });
  }

  function sendObjection() {
    if (!objectionInput || !objectionSendButton) return;
    const text = (objectionInput.value || '').trim();
    if (!text) {
      alert('Type the customer’s objection or your question first.');
      return;
    }

    const label = safeTrim(vehicleLabelInput && vehicleLabelInput.value) || 'this vehicle';
    const price = safeTrim(priceInfoInput && priceInfoInput.value) || 'Message for current pricing';

    objectionMessages.push({ role: 'user', content: text });
    renderObjectionChat();
    objectionInput.value = '';

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

  // -----------------------------
  // PAYMENT MODAL LOGIC
  // -----------------------------

  function openPaymentModal() {
    if (!paymentModal) return;
    paymentModal.classList.remove('hidden');
    setTimeout(() => payPrice && payPrice.focus(), 50);
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
    if (!paymentResultText) return;
    const price = parseFloat(payPrice && payPrice.value) || 0;
    const down = parseFloat(payDown && payDown.value) || 0;
    const apr = parseFloat(payApr && payApr.value) || 0;
    const term = parseInt(payTerm && payTerm.value, 10) || 0;

    const loanAmount = price - down;
    if (loanAmount <= 0 || term <= 0) {
      paymentResultText.textContent = 'Enter a valid price, down payment, and term.';
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

    paymentResultText.textContent =
      'Estimated Payment: $' +
      payment.toFixed(2) +
      ' / month (rough estimate, not final finance terms).';
  }

  if (paymentCalcButton) {
    paymentCalcButton.addEventListener('click', calculatePayment);
  }

  // -----------------------------
  // INCOME MODAL LOGIC
  // -----------------------------

  function openIncomeModal() {
    if (!incomeModal) return;
    incomeModal.classList.remove('hidden');
    setTimeout(() => incHourly && incHourly.focus(), 50);
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
    if (!incomeResultText) return;
    const hourly = parseFloat(incHourly && incHourly.value) || 0;
    const hoursPerWeek = parseFloat(incHours && incHours.value) || 0;

    if (hourly <= 0 || hoursPerWeek <= 0) {
      incomeResultText.textContent = 'Enter a valid hourly wage and hours per week.';
      return;
    }

    const yearly = hourly * hoursPerWeek * 52;
    incomeResultText.textContent =
      'Estimated Yearly Gross Income: $' + yearly.toFixed(2);
  }

  if (incomeCalcButton) {
    incomeCalcButton.addEventListener('click', calculateIncome);
  }

  // -----------------------------
  // MESSAGE BUILDER MODAL LOGIC
  // -----------------------------

  function openMessageModal() {
    if (!messageModal) return;
    messageModal.classList.remove('hidden');
    setTimeout(() => msgGoal && msgGoal.focus(), 50);
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
    if (!messageGenerateButton || !msgResult) return;

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

  // ------------------------------------------------------------
  // STEP 3 · CREATIVE LAB – FRONT-END ONLY
  // ------------------------------------------------------------

  function generateQuickVideoIdea() {
    if (!creativeVideoOutput) return;

    const vehicle =
      safeTrim(creativeVideoVehicle && creativeVideoVehicle.value) ||
      safeTrim(vehicleLabelInput && vehicleLabelInput.value) ||
      'this vehicle';

    const hook =
      safeTrim(creativeVideoHook && creativeVideoHook.value) ||
      'A quick walk-around that feels like a VIP appointment.';

    const aspect = (creativeVideoAspect && creativeVideoAspect.value) || '9:16';
    const length = (creativeVideoLength && creativeVideoLength.value) || '30';
    const style = (creativeVideoStyle && creativeVideoStyle.value) || 'hype';

    const styleLineMap = {
      hype: 'Fast cuts, punchy on-screen text, and upbeat music.',
      family: 'Warm, steady shots with close-ups on space, comfort, and safety.',
      luxury: 'Smooth, slow pans with focus on details, stitching, and tech.',
      budget: 'Payment-focused, clear text callouts, and simple, honest framing.',
    };

    const styleLine = styleLineMap[style] || styleLineMap.hype;

    const text = `
VIDEO BLUEPRINT – ${vehicle}
Aspect: ${aspect} · Length: ~${length} seconds
Style: ${style.toUpperCase()}

1) HOOK (0–3s)
- Shot: Close-up of the front end, then step back to reveal the full vehicle.
- On-screen text: "${hook}"
- Voiceover: "If you've been hunting for something like this, pause for 30 seconds."

2) WALK-AROUND (3–15s)
- Shot: Slow walk around the vehicle – front, side, rear.
- On-screen text: Quick callouts: "Low miles · Clean history · Ready today"
- Tip: Move the camera slowly, keep horizon level.

3) INTERIOR / FEATURES (15–25s)
- Shot: Open the door, show the dash, steering wheel, and main screens.
- On-screen text: Payment or key benefit: "Keep it around your payment goal."

4) FINAL HOOK & CTA (25–${length}s)
- Shot: You in frame next to ${vehicle}.
- Voiceover: "DM me 'INFO' and I'll send you a quick payment estimate and availability."
- On-screen text: "DM 'INFO' for payment + availability."

EXTRA NOTES
- ${styleLine}
- Keep clips short and steady. Re-record any shot that feels shaky.
`.trim();

    creativeVideoOutput.value = text;
  }

  function generateLayoutPlan() {
    if (!creativeLayoutOutput) return;

    const type = (creativeLayoutType && creativeLayoutType.value) || 'feed';
    const headline =
      safeTrim(creativeLayoutHeadline && creativeLayoutHeadline.value) ||
      'Drive home this ride today';
    const cta =
      safeTrim(creativeLayoutCta && creativeLayoutCta.value) ||
      'Message me for a VIP test drive';
    const brand =
      safeTrim(creativeLayoutBrand && creativeLayoutBrand.value) ||
      'Red + dark navy · bold, confident';

    let canvasLabel = 'Feed post';
    if (type === 'story') canvasLabel = 'Story / Reels cover';
    if (type === 'thumbnail') canvasLabel = 'Thumbnail';
    if (type === 'flyer') canvasLabel = 'Print-style flyer';

    const text = `
CANVA LAYOUT BLUEPRINT – ${canvasLabel}

1) TITLE / MAIN HOOK TEXT
"${headline}"

2) SUBHEAD / SUPPORT LINE
"Limited availability – lock in your VIP test drive."

3) BODY TEXT BLOCK (3–6 bullets)
- ✅ Clean history, ready to go
- ✅ Payment options to fit real budgets
- ✅ Fast trade-in appraisal
- ✅ VIP one-on-one appointment

4) CTA TEXT
"${cta}"

5) LAYOUT IDEA
- Top: Big bold headline centered, overlapping the upper part of the main vehicle photo.
- Middle: Large photo of the vehicle, edge-to-edge. Use a subtle gradient at the bottom so white text stays readable.
- Bottom-left: Bullet list in a rounded box (slight shadow).
- Bottom-right: CTA button-style box: "DM me 'INFO'" or "Tap to message".
- Corner: Small logo or "Lot Rocket" style badge in the top-left or top-right.

6) COLORS & VIBE
- Brand guideline: ${brand}
- Background: Soft gradient or solid that contrasts with the vehicle color.
- Accent: Use the accent color for the CTA box border and small underline under the headline.
- Vibe: Clean, high-confidence, minimal clutter. Everything should be easy to read at a glance on a phone screen.
`.trim();

    creativeLayoutOutput.value = text;
  }

  function updateCreativeEditorFilters() {
    if (!creativeEditorImage) return;
    const b = parseInt(creativeEditorBrightness && creativeEditorBrightness.value, 10) || 100;
    const c = parseInt(creativeEditorContrast && creativeEditorContrast.value, 10) || 100;
    const s = parseInt(creativeEditorSaturation && creativeEditorSaturation.value, 10) || 110;

    creativeEditorImage.style.filter =
      'brightness(' + b + '%) contrast(' + c + '%) saturate(' + s + '%)';
  }

  function initCreativeEditor() {
    if (!creativeEditorFile || !creativeEditorImage || !creativeEditorPlaceholder) return;

    creativeEditorFile.addEventListener('change', () => {
      const file = creativeEditorFile.files && creativeEditorFile.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        creativeEditorImage.src = e.target.result;
        creativeEditorImage.classList.remove('hidden');
        creativeEditorPlaceholder.classList.add('hidden');
        updateCreativeEditorFilters();
      };
      reader.readAsDataURL(file);
    });

    if (creativeEditorBrightness) {
      creativeEditorBrightness.addEventListener('input', updateCreativeEditorFilters);
    }
    if (creativeEditorContrast) {
      creativeEditorContrast.addEventListener('input', updateCreativeEditorFilters);
    }
    if (creativeEditorSaturation) {
      creativeEditorSaturation.addEventListener('input', updateCreativeEditorFilters);
    }
  }

  function initCreativeLab() {
    // Quick Sales Video
    if (generateVideoPlanBtn && creativeVideoOutput) {
      generateVideoPlanBtn.addEventListener('click', generateQuickVideoIdea);
    }

    // Canva-style Layout Planner
    if (generateLayoutPlanBtn && creativeLayoutOutput) {
      generateLayoutPlanBtn.addEventListener('click', generateLayoutPlan);
    }

    // Photo & Video Quick Editor
    initCreativeEditor();
  }

  initCreativeLab();

  // initial render for objection history
  renderObjectionChat();
});
