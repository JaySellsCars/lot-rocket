// public/app.js – frontend logic for Lot Rocket Social Kit

document.addEventListener('DOMContentLoaded', () => {
  const apiBase = '';

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

  // Launchers (right side)
  const objectionLauncher = document.getElementById('objectionLauncher');
  const paymentLauncher = document.getElementById('paymentLauncher');
  const messageLauncher = document.getElementById('messageLauncher');
  const incomeLauncher = document.getElementById('incomeLauncher');

  // Objection modal pieces
  const objectionModal = document.getElementById('objectionModal');
  const objectionCloseButton = document.getElementById('objectionCloseButton');
  const objectionHistory = document.getElementById('objectionHistory');
  const objectionInput = document.getElementById('objectionInput');
  const objectionSendButton = document.getElementById('objectionSendButton');

  let currentPhotos = [];
  let currentUrl = '';
  let isBoosting = false;

  // chat history for objection coach
  let objectionMessages = []; // { role: 'user' | 'assistant', content: string }

  // ----- Theme handling -----

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
    localStorage.setItem('lotRocketTheme', theme);
  }

  function initTheme() {
    const saved = localStorage.getItem('lotRocketTheme');
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

  // ----- Helpers -----

  function setStatus(text, isLoading = false) {
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
    summaryLabel.textContent = safeTrim(label) || 'Vehicle ready';
    summaryPrice.textContent = safeTrim(price) || 'Message for current pricing';
  }

  function fillSocialKit(kit) {
    facebookPost.value = kit.facebook || '';
    instagramPost.value = kit.instagram || '';
    tiktokPost.value = kit.tiktok || '';
    linkedinPost.value = kit.linkedin || '';
    twitterPost.value = kit.twitter || '';
    textBlurb.value = kit.textBlurb || '';
    marketplacePost.value = kit.marketplace || '';
    hashtags.value = kit.hashtags || '';
    videoScript.value = kit.videoScript || '';
    shotPlan.value = kit.shotPlan || '';
  }

  function renderPhotosGrid(photos) {
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

  // render objection chat history into modal
  function renderObjectionChat() {
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

  // ----- Boost flow -----

  async function handleBoost() {
    if (isBoosting) return;
    const url = safeTrim(vehicleUrlInput.value);
    if (!url) {
      alert('Paste a dealer vehicle URL first.');
      return;
    }

    let label = safeTrim(vehicleLabelInput.value);
    if (!label) {
      label = 'This vehicle';
      vehicleLabelInput.value = label;
    }
    let price = safeTrim(priceInfoInput.value);
    if (!price) {
      price = 'Message for current pricing';
      priceInfoInput.value = price;
    }

    isBoosting = true;
    boostButton.disabled = true;
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
      try {
        photosStatus.textContent = 'Trying to grab photos from dealer page…';
        const photoResp = await callJson('/api/grab-photos', { url });
        if (photoResp.success) {
          currentPhotos = photoResp.photos || [];
          renderPhotosGrid(currentPhotos);
        } else {
          photosStatus.textContent = 'Could not grab photos.';
        }
      } catch (err) {
        console.error('Auto photo grab failed:', err);
        photosStatus.textContent = 'Auto photo load failed.';
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

  // ----- New post buttons -----

  document.querySelectorAll('.button-new-post').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const platform = btn.getAttribute('data-platform');
      const url = safeTrim(vehicleUrlInput.value);
      const label = safeTrim(vehicleLabelInput.value);
      const price = safeTrim(priceInfoInput.value);

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
            facebookPost.value = text;
            break;
          case 'instagram':
            instagramPost.value = text;
            break;
          case 'tiktok':
            tiktokPost.value = text;
            break;
          case 'linkedin':
            linkedinPost.value = text;
            break;
          case 'twitter':
            twitterPost.value = text;
            break;
          case 'text':
            textBlurb.value = text;
            break;
          case 'marketplace':
            marketplacePost.value = text;
            break;
          case 'hashtags':
            hashtags.value = text;
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

  // ----- New video script -----

  if (newScriptButton) {
    newScriptButton.addEventListener('click', async () => {
      const url = safeTrim(vehicleUrlInput.value);
      const label = safeTrim(vehicleLabelInput.value);
      const price = safeTrim(priceInfoInput.value);

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
        videoScript.value = resp.script || '';
      } catch (err) {
        console.error(err);
        alert('Error generating a new script. Try again.');
      } finally {
        newScriptButton.disabled = false;
        newScriptButton.innerHTML = oldText;
      }
    });
  }

  // ----- Build video plan from photos -----

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
        const label = safeTrim(vehicleLabelInput.value) || 'this vehicle';
        const resp = await callJson('/api/video-from-photos', {
          photos: currentPhotos,
          label,
        });
        if (!resp.success) throw new Error('API error');
        videoPlan.value = resp.plan || '';
      } catch (err) {
        console.error(err);
        alert('Error building video plan. Try again.');
      } finally {
        buildVideoButton.disabled = false;
        buildVideoButton.innerHTML = oldText;
      }
    });
  }

  // ----- Design Lab -----

  if (designButton) {
    designButton.addEventListener('click', async () => {
      const type = designTypeSelect.value;
      const url = safeTrim(vehicleUrlInput.value);
      const label = safeTrim(vehicleLabelInput.value);
      const price = safeTrim(priceInfoInput.value);

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
        designOutput.value = resp.design || '';
      } catch (err) {
        console.error(err);
        alert('Error generating a design idea. Try again.');
      } finally {
        designButton.disabled = false;
        designButton.innerHTML = oldText;
      }
    });
  }

  // ----- Objection Coach modal -----

  function openObjectionModal() {
    objectionModal.classList.remove('hidden');
    if (!objectionMessages.length) {
      renderObjectionChat();
    }
    setTimeout(() => {
      objectionInput.focus();
    }, 50);
  }

  function closeObjectionModal() {
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
    const text = (objectionInput.value || '').trim();
    if (!text) {
      alert('Type the customer’s objection or your question first.');
      return;
    }

    const label = safeTrim(vehicleLabelInput.value) || 'this vehicle';
    const price = safeTrim(priceInfoInput.value) || 'Message for current pricing';

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

  // ----- Placeholder actions for other launchers -----

  if (paymentLauncher) {
    paymentLauncher.addEventListener('click', () => {
      alert('Payment Helper is coming soon. Button is wired and ready.');
    });
  }

  if (messageLauncher) {
    messageLauncher.addEventListener('click', () => {
      alert('Custom Message tool is coming soon. Button is wired and ready.');
    });
  }

  if (incomeLauncher) {
    incomeLauncher.addEventListener('click', () => {
      alert('Income Builder is coming soon. Button is wired and ready.');
    });
  }

  // initial render
  renderObjectionChat();
});
