// public/app.js – Lot Rocket V2 frontend

document.addEventListener('DOMContentLoaded', () => {
  const apiBase = '';

  // ---------- Elements ----------

  const vehicleUrlInput = document.getElementById('vehicleUrl');
  const vehicleLabelInput = document.getElementById('vehicleLabel');
  const priceInfoInput = document.getElementById('priceInfo');
  const boostButton = document.getElementById('boostButton');
  const statusText = document.getElementById('statusText');

  const photoGrid = document.getElementById('photoGrid');

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
  const selfieScript = document.getElementById('selfieScript');
  const shotPlan = document.getElementById('shotPlan');
  const canvaIdea = document.getElementById('canvaIdea');

  const newPostButtons = document.querySelectorAll('.new-post-btn');
  const newSelfieScriptBtn = document.getElementById('newSelfieScript');
  const copyButtons = document.querySelectorAll('.copy-btn');

  // Creative Lab
  const videoVehicle = document.getElementById('videoVehicle');
  const videoHook = document.getElementById('videoHook');
  const videoStyle = document.getElementById('videoStyle');
  const videoLength = document.getElementById('videoLength');
  const generateVideoIdea = document.getElementById('generateVideoIdea');
  const videoIdeaOutput = document.getElementById('videoIdeaOutput');

  const layoutType = document.getElementById('layoutType');
  const layoutHeadline = document.getElementById('layoutHeadline');
  const layoutCta = document.getElementById('layoutCta');
  const layoutVibe = document.getElementById('layoutVibe');
  const generateLayoutIdea = document.getElementById('generateLayoutIdea');
  const layoutOutput = document.getElementById('layoutOutput');

  const photoUpload = document.getElementById('photoUpload');
  const brightnessSlider = document.getElementById('brightnessSlider');
  const contrastSlider = document.getElementById('contrastSlider');
  const saturationSlider = document.getElementById('saturationSlider');
  const photoPreview = document.getElementById('photoPreview');

  const themeToggle = document.getElementById('themeToggle');

  // Floating tools
  const objectionLauncher = document.getElementById('objectionLauncher');
  const paymentLauncher = document.getElementById('paymentLauncher');
  const incomeLauncher = document.getElementById('incomeLauncher');
  const messageLauncher = document.getElementById('messageLauncher'); // AI Work Flow Expert

  const messageBuilderLauncher = document.getElementById('messageBuilderLauncher');
  const askAiLauncher = document.getElementById('askAiLauncher');
  const carExpertLauncher = document.getElementById('carExpertLauncher');

  // Modals
  const objectionModal = document.getElementById('objectionModal');
  const objectionClose = document.getElementById('objectionClose');
  const objectionText = document.getElementById('objectionText');
  const objectionContext = document.getElementById('objectionContext');
  const objectionSubmit = document.getElementById('objectionSubmit');
  const objectionOutput = document.getElementById('objectionOutput');

  const paymentModal = document.getElementById('paymentModal');
  const paymentClose = document.getElementById('paymentClose');
  const payPrice = document.getElementById('payPrice');
  const payDown = document.getElementById('payDown');
  const payTerm = document.getElementById('payTerm');
  const payRate = document.getElementById('payRate');
  const paymentSubmit = document.getElementById('paymentSubmit');
  const paymentOutput = document.getElementById('paymentOutput');

  const incomeModal = document.getElementById('incomeModal');
  const incomeClose = document.getElementById('incomeClose');
  const incomeTarget = document.getElementById('incomeTarget');
  const incomeDebts = document.getElementById('incomeDebts');
  const incomeTerm = document.getElementById('incomeTerm');
  const incomeRate = document.getElementById('incomeRate');
  const incomeSubmit = document.getElementById('incomeSubmit');
  const incomeOutput = document.getElementById('incomeOutput');

  const messageModal = document.getElementById('messageModal');
  const messageClose = document.getElementById('messageClose');
  const workflowSituation = document.getElementById('workflowSituation');
  const workflowType = document.getElementById('workflowType');
  const workflowSubmit = document.getElementById('workflowSubmit');
  const workflowOutput = document.getElementById('workflowOutput');

  // New modals
  const messageBuilderModal = document.getElementById('messageBuilderModal');
  const messageBuilderClose = document.getElementById('messageBuilderClose');
  const messageBuilderType = document.getElementById('messageBuilderType');
  const messageBuilderGoal = document.getElementById('messageBuilderGoal');
  const messageBuilderDetails = document.getElementById('messageBuilderDetails');
  const messageBuilderGenerate = document.getElementById('messageBuilderGenerate');
  const messageBuilderOutput = document.getElementById('messageBuilderOutput');
  const messageBuilderCopy = document.getElementById('messageBuilderCopy');

  const askAiModal = document.getElementById('askAiModal');
  const askAiClose = document.getElementById('askAiClose');
  const askAiQuestion = document.getElementById('askAiQuestion');
  const askAiSubmit = document.getElementById('askAiSubmit');
  const askAiAnswer = document.getElementById('askAiAnswer');
  const askAiCopy = document.getElementById('askAiCopy');

  const carExpertModal = document.getElementById('carExpertModal');
  const carExpertClose = document.getElementById('carExpertClose');
  const carExpertQuestion = document.getElementById('carExpertQuestion');
  const carExpertSubmit = document.getElementById('carExpertSubmit');
  const carExpertAnswer = document.getElementById('carExpertAnswer');
  const carExpertCopy = document.getElementById('carExpertCopy');

  // ---------- Helpers ----------

  function setStatus(msg, isError = false) {
    if (!statusText) return;
    statusText.textContent = msg;
    statusText.classList.toggle('error', !!isError);
  }

  function openModal(modal) {
    if (modal) modal.classList.remove('hidden');
  }

  function closeModal(modal) {
    if (modal) modal.classList.add('hidden');
  }

  async function copyToClipboard(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Clipboard error', err);
    }
  }

  function applyPhotoFilters() {
    if (!photoPreview) return;
    const b = parseInt(brightnessSlider.value || '0', 10);
    const c = parseInt(contrastSlider.value || '0', 10);
    const s = parseInt(saturationSlider.value || '0', 10);

    const brightness = 100 + b;
    const contrast = 100 + c;
    const saturation = 100 + s;

    photoPreview.style.filter = `
      brightness(${brightness}%)
      contrast(${contrast}%)
      saturate(${saturation}%)
    `;
  }

  function renderPhotoGrid(photos) {
    if (!photoGrid) return;
    photoGrid.innerHTML = '';
    if (!Array.isArray(photos) || photos.length === 0) return;

    photos.forEach((url) => {
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Vehicle photo';
      img.className = 'photo-thumb';
      photoGrid.appendChild(img);
    });
  }

  // ---------- Theme toggle ----------
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
    });
  }

  // ---------- Step 1 + Step 2: Boost workflow ----------

  if (boostButton) {
    boostButton.addEventListener('click', async () => {
      const url = (vehicleUrlInput.value || '').trim();
      const label = (vehicleLabelInput.value || '').trim();
      const price = (priceInfoInput.value || '').trim();

      if (!url) {
        setStatus('Please paste a dealer listing URL.', true);
        return;
      }

      setStatus('Scraping and generating social kit...');

      try {
        // grab photos
        const photosRes = await fetch(`${apiBase}/api/grab-photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (photosRes.ok) {
          const photosData = await photosRes.json();
          renderPhotoGrid(photosData.photos || []);
        }

        // full social kit
        const res = await fetch(`${apiBase}/api/social-kit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, label, price }),
        });

        if (!res.ok) {
          setStatus('Error generating kit. Try again.', true);
          return;
        }

        const data = await res.json();

        const kit = data.kit || {};
        const meta = data.meta || {};
        const photos = data.photos || [];

        renderPhotoGrid(photos);

        summaryLabel.textContent = meta.label || label || '—';
        summaryPrice.textContent = meta.price || price || '—';

        facebookPost.value = kit.facebook || '';
        instagramPost.value = kit.instagram || '';
        tiktokPost.value = kit.tiktok || '';
        linkedinPost.value = kit.linkedin || '';
        twitterPost.value = kit.twitter || '';
        textBlurb.value = kit.sms || '';
        marketplacePost.value = kit.marketplace || '';
        hashtags.value = kit.hashtags || '';
        selfieScript.value = kit.selfie_script || '';
        shotPlan.value = kit.shot_plan || '';
        canvaIdea.value = kit.canva_idea || '';

        setStatus('Social kit ready! 🎯');
      } catch (err) {
        console.error(err);
        setStatus('Something went wrong. Check your URL and try again.', true);
      }
    });
  }

  // ---------- Regenerate single platform posts ----------

  if (newPostButtons && newPostButtons.length) {
    newPostButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const platform = btn.getAttribute('data-platform');
        if (!platform) return;

        const url = (vehicleUrlInput.value || '').trim();
        const label = (vehicleLabelInput.value || '').trim();
        const price = (priceInfoInput.value || '').trim();

        const context = `
URL: ${url}
Label: ${label}
Price: ${price}
Current content:
Facebook: ${facebookPost.value}
Instagram: ${instagramPost.value}
TikTok: ${tiktokPost.value}
LinkedIn: ${linkedinPost.value}
Twitter: ${twitterPost.value}
        `;

        btn.disabled = true;
        btn.textContent = 'Thinking...';

        try {
          const res = await fetch(`${apiBase}/api/new-post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, context }),
          });

          if (!res.ok) {
            alert('Error generating new post.');
            return;
          }

          const data = await res.json();
          const post = data.post || '';

          switch (platform) {
            case 'facebook':
              facebookPost.value = post;
              break;
            case 'instagram':
              instagramPost.value = post;
              break;
            case 'tiktok':
              tiktokPost.value = post;
              break;
            case 'linkedin':
              linkedinPost.value = post;
              break;
            case 'twitter':
              twitterPost.value = post;
              break;
          }
        } catch (err) {
          console.error(err);
          alert('Error generating new post.');
        } finally {
          btn.disabled = false;
          btn.textContent = 'New Post';
        }
      });
    });
  }

  // ---------- New selfie script from context ----------
  if (newSelfieScriptBtn) {
    newSelfieScriptBtn.addEventListener('click', async () => {
      const url = (vehicleUrlInput.value || '').trim();
      const label = (vehicleLabelInput.value || '').trim();
      const price = (priceInfoInput.value || '').trim();

      const context = `
URL: ${url}
Label: ${label}
Price: ${price}
Current script:
${selfieScript.value}
      `;

      newSelfieScriptBtn.disabled = true;
      newSelfieScriptBtn.textContent = 'Thinking...';

      try {
        const res = await fetch(`${apiBase}/api/new-script`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context }),
        });

        if (!res.ok) {
          alert('Error generating new script.');
          return;
        }

        const data = await res.json();
        selfieScript.value = data.script || '';
      } catch (err) {
        console.error(err);
        alert('Error generating new script.');
      } finally {
        newSelfieScriptBtn.disabled = false;
        newSelfieScriptBtn.textContent = 'New Script';
      }
    });
  }

  // ---------- Universal copy buttons ----------
  if (copyButtons && copyButtons.length) {
    copyButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetId = btn.getAttribute('data-target');
        if (!targetId) return;
        const el = document.getElementById(targetId);
        if (!el) return;

        const text = el.value || el.textContent || '';
        if (!text.trim()) return;

        try {
          await navigator.clipboard.writeText(text.trim());
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = original;
          }, 1200);
        } catch (err) {
          console.error('Copy failed', err);
        }
      });
    });
  }

  // ---------- Creative Lab: video idea ----------
  if (generateVideoIdea) {
    generateVideoIdea.addEventListener('click', async () => {
      const payload = {
        vehicle: videoVehicle.value,
        hook: videoHook.value,
        style: videoStyle.value,
        length: videoLength.value,
      };

      videoIdeaOutput.value = 'Generating video idea...';

      const context = `
Vehicle: ${payload.vehicle}
Hook: ${payload.hook}
Style: ${payload.style}
Length/aspect: ${payload.length}
`;

      try {
        const res = await fetch(`${apiBase}/api/new-script`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context }),
        });

        if (!res.ok) {
          videoIdeaOutput.value = 'Error generating video idea.';
          return;
        }

        const data = await res.json();
        videoIdeaOutput.value = data.script || 'No idea returned.';
      } catch (err) {
        console.error(err);
        videoIdeaOutput.value = 'Error generating video idea.';
      }
    });
  }

  // ---------- Creative Lab: layout idea ----------
  if (generateLayoutIdea) {
    generateLayoutIdea.addEventListener('click', async () => {
      const payload = {
        creativeType: layoutType.value,
        headline: layoutHeadline.value,
        cta: layoutCta.value,
        vibe: layoutVibe.value,
      };

      layoutOutput.value = 'Generating layout idea...';

      try {
        const res = await fetch(`${apiBase}/api/design-idea`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          layoutOutput.value = 'Error generating layout idea.';
          return;
        }

        const data = await res.json();
        layoutOutput.value = data.layout || 'No layout idea returned.';
      } catch (err) {
        console.error(err);
        layoutOutput.value = 'Error generating layout idea.';
      }
    });
  }

  // ---------- Photo quick editor ----------
  if (photoUpload) {
    photoUpload.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        photoPreview.src = evt.target.result;
        applyPhotoFilters();
      };
      reader.readAsDataURL(file);
    });
  }

  [brightnessSlider, contrastSlider, saturationSlider].forEach((slider) => {
    if (!slider) return;
    slider.addEventListener('input', applyPhotoFilters);
  });

  // ---------- Floating tools: open/close modals ----------

  if (objectionLauncher) {
    objectionLauncher.addEventListener('click', () =>
      openModal(objectionModal)
    );
  }
  if (paymentLauncher) {
    paymentLauncher.addEventListener('click', () => openModal(paymentModal));
  }
  if (incomeLauncher) {
    incomeLauncher.addEventListener('click', () => openModal(incomeModal));
  }
  if (messageLauncher) {
    messageLauncher.addEventListener('click', () => openModal(messageModal));
  }
  if (messageBuilderLauncher) {
    messageBuilderLauncher.addEventListener('click', () =>
      openModal(messageBuilderModal)
    );
  }
  if (askAiLauncher) {
    askAiLauncher.addEventListener('click', () => openModal(askAiModal));
  }
  if (carExpertLauncher) {
    carExpertLauncher.addEventListener('click', () =>
      openModal(carExpertModal)
    );
  }

  if (objectionClose) {
    objectionClose.addEventListener('click', () =>
      closeModal(objectionModal)
    );
  }
  if (paymentClose) {
    paymentClose.addEventListener('click', () => closeModal(paymentModal));
  }
  if (incomeClose) {
    incomeClose.addEventListener('click', () => closeModal(incomeModal));
  }
  if (messageClose) {
    messageClose.addEventListener('click', () => closeModal(messageModal));
  }
  if (messageBuilderClose) {
    messageBuilderClose.addEventListener('click', () =>
      closeModal(messageBuilderModal)
    );
  }
  if (askAiClose) {
    askAiClose.addEventListener('click', () => closeModal(askAiModal));
  }
  if (carExpertClose) {
    carExpertClose.addEventListener('click', () =>
      closeModal(carExpertModal)
    );
  }

  // ---------- Tool API calls ----------

  // Objection coach
  if (objectionSubmit) {
    objectionSubmit.addEventListener('click', async () => {
      const objection = objectionText.value.trim();
      const context = objectionContext.value.trim();

      if (!objection) {
        objectionOutput.value = 'Please enter a customer objection.';
        return;
      }

      objectionOutput.value = 'Coaching...';

      try {
        const res = await fetch(`${apiBase}/api/objection-coach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objection, context }),
        });

        if (!res.ok) {
          objectionOutput.value = 'Error generating coaching.';
          return;
        }

        const data = await res.json();
        objectionOutput.value = data.advice || 'No coaching returned.';
      } catch (err) {
        console.error(err);
        objectionOutput.value = 'Error generating coaching.';
      }
    });
  }

  // Payment helper
  if (paymentSubmit) {
    paymentSubmit.addEventListener('click', async () => {
      const payload = {
        price: payPrice.value,
        down: payDown.value,
        termMonths: payTerm.value,
        rate: payRate.value,
      };

      paymentOutput.value = 'Estimating payment...';

      try {
        const res = await fetch(`${apiBase}/api/payment-helper`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          paymentOutput.value = 'Error estimating payment.';
          return;
        }

        const data = await res.json();
        paymentOutput.value = data.paymentHelp || 'No estimate returned.';
      } catch (err) {
        console.error(err);
        paymentOutput.value = 'Error estimating payment.';
      }
    });
  }

  // Income helper
  if (incomeSubmit) {
    incomeSubmit.addEventListener('click', async () => {
      const payload = {
        paymentTarget: incomeTarget.value,
        otherDebts: incomeDebts.value,
        termMonths: incomeTerm.value,
        rate: incomeRate.value,
      };

      incomeOutput.value = 'Estimating income...';

      try {
        const res = await fetch(`${apiBase}/api/income-helper`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          incomeOutput.value = 'Error estimating income.';
          return;
        }

        const data = await res.json();
        incomeOutput.value = data.incomeHelp || 'No estimate returned.';
      } catch (err) {
        console.error(err);
        incomeOutput.value = 'Error estimating income.';
      }
    });
  }

  // AI Work Flow Expert
  if (workflowSubmit) {
    workflowSubmit.addEventListener('click', async () => {
      const situation = workflowSituation.value.trim();
      const customerType = workflowType.value.trim();

      if (!situation) {
        workflowOutput.value =
          'Describe the customer situation to build a workflow.';
        return;
      }

      workflowOutput.value = 'Building workflow...';

      try {
        const res = await fetch(`${apiBase}/api/message-helper`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ situation, customerType }),
        });

        if (!res.ok) {
          workflowOutput.value = 'Error generating workflow.';
          return;
        }

        const data = await res.json();
        workflowOutput.value = data.workflow || 'No workflow returned.';
      } catch (err) {
        console.error(err);
        workflowOutput.value = 'Error generating workflow.';
      }
    });
  }

  // AI Message Builder
  if (messageBuilderGenerate) {
    messageBuilderGenerate.addEventListener('click', async () => {
      const type = messageBuilderType.value;
      const goal = messageBuilderGoal.value.trim();
      const details = messageBuilderDetails.value.trim();

      if (!goal && !details) {
        messageBuilderOutput.value =
          'Please describe what you want the message to do.';
        return;
      }

      messageBuilderOutput.value = 'Generating message...';

      try {
        const res = await fetch(`${apiBase}/api/message-builder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, goal, details }),
        });

        if (!res.ok) {
          messageBuilderOutput.value =
            'Error: Unable to generate message.';
          return;
        }

        const data = await res.json();
        messageBuilderOutput.value =
          data.message || 'No response text returned.';
      } catch (err) {
        console.error(err);
        messageBuilderOutput.value = 'Error: Something went wrong.';
      }
    });
  }

  if (messageBuilderCopy) {
    messageBuilderCopy.addEventListener('click', async () => {
      const text = messageBuilderOutput.value.trim();
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        const original = messageBuilderCopy.textContent;
        messageBuilderCopy.textContent = 'Copied!';
        setTimeout(() => {
          messageBuilderCopy.textContent = original;
        }, 1200);
      } catch (err) {
        console.error('Copy failed', err);
      }
    });
  }

  // Ask AI
  if (askAiSubmit) {
    askAiSubmit.addEventListener('click', async () => {
      const question = askAiQuestion.value.trim();
      if (!question) {
        askAiAnswer.value = 'Please enter a question.';
        return;
      }

      askAiAnswer.value = 'Thinking...';

      try {
        const res = await fetch(`${apiBase}/api/ask-ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });

        if (!res.ok) {
          askAiAnswer.value = 'Error: Unable to get answer.';
          return;
        }

        const data = await res.json();
        askAiAnswer.value = data.answer || 'No answer was returned.';
      } catch (err) {
        console.error(err);
        askAiAnswer.value = 'Error: Something went wrong.';
      }
    });
  }

  if (askAiCopy) {
    askAiCopy.addEventListener('click', async () => {
      const text = askAiAnswer.value.trim();
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        const original = askAiCopy.textContent;
        askAiCopy.textContent = 'Copied!';
        setTimeout(() => {
          askAiCopy.textContent = original;
        }, 1200);
      } catch (err) {
        console.error('Copy failed', err);
      }
    });
  }

  // AI Car Expert
  if (carExpertSubmit) {
    carExpertSubmit.addEventListener('click', async () => {
      const question = carExpertQuestion.value.trim();
      if (!question) {
        carExpertAnswer.value = 'Please enter an automotive question.';
        return;
      }

      carExpertAnswer.value = 'Revving up an answer...';

      try {
        const res = await fetch(`${apiBase}/api/car-expert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });

        if (!res.ok) {
          carExpertAnswer.value = 'Error: Unable to get answer.';
          return;
        }

        const data = await res.json();
        carExpertAnswer.value = data.answer || 'No answer was returned.';
      } catch (err) {
        console.error(err);
        carExpertAnswer.value = 'Error: Something went wrong.';
      }
    });
  }

  if (carExpertCopy) {
    carExpertCopy.addEventListener('click', async () => {
      const text = carExpertAnswer.value.trim();
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        const original = carExpertCopy.textContent;
        carExpertCopy.textContent = 'Copied!';
        setTimeout(() => {
          carExpertCopy.textContent = original;
        }, 1200);
      } catch (err) {
        console.error('Copy failed', err);
      }
    });
  }
});
