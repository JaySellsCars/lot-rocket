// public/app.js – frontend logic for Lot Rocket Toolkit

document.addEventListener("DOMContentLoaded", () => {
  /* ===============================
   *  PANEL SWITCHING (LEFT BUTTONS)
   * =============================== */

  const objectionLauncher = document.getElementById("objectionLauncher");
  const paymentLauncher = document.getElementById("paymentLauncher");
  const messageLauncher = document.getElementById("messageLauncher");
  const incomeLauncher = document.getElementById("incomeLauncher");

  const panels = {
    objection: document.getElementById("panel-objection"),
    payment: document.getElementById("panel-payment"),
    message: document.getElementById("panel-message"),
    income: document.getElementById("panel-income"),
  };

  const placeholder = document.getElementById("workspacePlaceholder");

  function showPanel(key) {
    if (placeholder) placeholder.style.display = "none";

    Object.values(panels).forEach((panel) => {
      if (panel) panel.classList.remove("is-active");
    });

    const active = panels[key];
    if (active) active.classList.add("is-active");
  }

  if (objectionLauncher) {
    objectionLauncher.addEventListener("click", () => showPanel("objection"));
  }
  if (paymentLauncher) {
    paymentLauncher.addEventListener("click", () => showPanel("payment"));
  }
  if (messageLauncher) {
    messageLauncher.addEventListener("click", () => showPanel("message"));
  }
  if (incomeLauncher) {
    incomeLauncher.addEventListener("click", () => showPanel("income"));
  }

  /* ===============================
   *  OBJECTION COACH
   * =============================== */

  const objectionForm = document.getElementById("objectionForm");
  const objectionOutput = document.getElementById("objectionOutput");

  if (objectionForm && objectionOutput) {
    objectionForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name =
        document.getElementById("objectionCustomer").value.trim() || "you";
      const type = document.getElementById("objectionType").value;
      const exact = document.getElementById("objectionExact").value.trim();

      const opener =
        "I totally understand where you're coming from, and I appreciate you being honest with me.";

      let body = "";
      let close =
        `The last thing I want is for ${name} to feel pressured. ` +
        "If the numbers and the vehicle make sense, the only thing left is for you to feel good about the decision. " +
        "What questions can I clear up right now so you can feel confident moving forward?";

      switch (type) {
        case "think":
          body =
            "Usually when someone tells me they need to “think about it”, it means there’s one or two specific things that aren’t perfectly clear yet – " +
            "whether it’s the payment, the vehicle itself, or timing. If we can put our heads together for a minute, " +
            "we can usually clear those up so you can make the best decision tonight instead of taking this home as extra stress.";
          break;
        case "payment":
          body =
            "Let’s focus on what feels comfortable instead of what feels tight. We can work backwards from a monthly payment that fits your budget " +
            "and then structure the term and down payment around that. My job is not to squeeze you into a payment – it’s to make the payment fit you.";
          break;
        case "trade":
          body =
            "I hear you on the trade value. No one wants to feel like they’re giving their vehicle away. " +
            "What I can do is walk you through exactly how we arrived at that number – current market, condition, and similar vehicles sold – " +
            "and if we missed anything on your vehicle’s condition or equipment, we’ll correct it.";
          break;
        case "spouse":
          body =
            "That makes total sense – this is a big decision and it affects both of you. " +
            "What we can do is make sure all the numbers, payments, and details are clear and in writing, so when you talk with your spouse, " +
            "you’re not trying to explain it from memory. If you’d like, we can even give them a quick call together.";
          break;
        default:
          body =
            "Thank you for sharing that. Let’s slow it down for a second and make sure we dial in what’s most important to you – " +
            "whether that’s payment, timing, or the vehicle itself – so you don’t feel like you’re settling on anything.";
      }

      const quote = exact ? `\n\nThey said: "${exact}"\n` : "";

      objectionOutput.value = `${opener}\n\n${quote}${body}\n\n${close}`;
    });
  }

  /* ===============================
   *  PAYMENT HELPER
   * =============================== */

  const paymentForm = document.getElementById("paymentForm");
  const paymentResult = document.getElementById("paymentResult");
  const amountFinancedEl = document.getElementById("amountFinanced");
  const totalPaidEl = document.getElementById("totalPaid");

  if (paymentForm && paymentResult && amountFinancedEl && totalPaidEl) {
    paymentForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const price = Number(document.getElementById("price").value) || 0;
      const down = Number(document.getElementById("downPayment").value) || 0;
      const term = Number(document.getElementById("term").value) || 0;
      const apr = Number(document.getElementById("apr").value) || 0;

      if (!price || !term) {
        paymentResult.textContent = "Enter price and term.";
        amountFinancedEl.textContent = "$0";
        totalPaidEl.textContent = "$0";
        return;
      }

      const amountFinanced = Math.max(price - down, 0);
      const monthlyRate = apr > 0 ? apr / 100 / 12 : 0;

      let payment = 0;
      if (monthlyRate === 0) {
        payment = amountFinanced / term;
      } else {
        const factor =
          (monthlyRate * Math.pow(1 + monthlyRate, term)) /
          (Math.pow(1 + monthlyRate, term) - 1);
        payment = amountFinanced * factor;
      }

      const totalPaid = payment * term;

      paymentResult.textContent = `$${payment.toFixed(2)} / mo`;
      amountFinancedEl.textContent = `$${amountFinanced.toFixed(2)}`;
      totalPaidEl.textContent = `$${totalPaid.toFixed(2)}`;
    });
  }

  /* ===============================
   *  CUSTOM MESSAGE GENERATOR
   * =============================== */

  const messageForm = document.getElementById("messageForm");
  const messageOutput = document.getElementById("messageOutput");

  if (messageForm && messageOutput) {
    messageForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name =
        document.getElementById("msgCustomer").value.trim() || "there";
      const platform = document.getElementById("msgPlatform").value;
      const vehicle = document.getElementById("msgVehicle").value.trim();
      const goal = document.getElementById("msgGoal").value;
      const notes = document.getElementById("msgNotes").value.trim();

      const greeting = platform === "email" ? `Hi ${name},` : `Hey ${name},`;

      const vehicleLine = vehicle
        ? `I’ve got that ${vehicle} ready for you and it looks even better in person.`
        : `I’ve got a few options here that match what you told me you’re looking for.`;

      let goalLine = "";

      switch (goal) {
        case "appointment":
          goalLine =
            "I’ve got some time available later today and tomorrow. What works better for you – after work today or sometime tomorrow?";
          break;
        case "trade":
          goalLine =
            "If you can send me a couple pictures and the miles on your current vehicle, I can get you a strong trade estimate before you even show up.";
          break;
        case "followup":
          goalLine =
            "I just wanted to thank you again for stopping in and make sure you didn’t have any unanswered questions holding you back.";
          break;
        case "credit":
          goalLine =
            "We work with a lot of people in similar credit situations every single day. The biggest win is usually just getting a real plan in place.";
          break;
        default:
          goalLine = "";
      }

      const notesLine = notes
        ? `\n\nQuick note based on what you shared: ${notes}`
        : "";

      const closing =
        "\n\nShoot me a quick reply here and I’ll take care of the rest for you.\n\n– Jay";

      messageOutput.value = `${greeting}\n\n${vehicleLine}\n${goalLine}${notesLine}${closing}`;
    });
  }

  /* ===============================
   *  INCOME BUILDER
   * =============================== */

  const incomeForm = document.getElementById("incomeForm");
  const dealsPerMonthEl = document.getElementById("dealsPerMonth");
  const dealsPerDayEl = document.getElementById("dealsPerDay");
  const appointmentsPerDayEl = document.getElementById("appointmentsPerDay");
  const showsPerDayEl = document.getElementById("showsPerDay");

  if (
    incomeForm &&
    dealsPerMonthEl &&
    dealsPerDayEl &&
    appointmentsPerDayEl &&
    showsPerDayEl
  ) {
    incomeForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const incomeGoal =
        Number(document.getElementById("incomeGoal").value) || 0;
      const commissionPerDeal =
        Number(document.getElementById("commissionPerDeal").value) || 0;
      const workDays = Number(document.getElementById("workDays").value) || 0;
      const closeRate =
        Number(document.getElementById("closeRate").value) || 0;

      if (!incomeGoal || !commissionPerDeal || !workDays || !closeRate) {
        dealsPerMonthEl.textContent = "0";
        dealsPerDayEl.textContent = "0";
        appointmentsPerDayEl.textContent = "0";
        showsPerDayEl.textContent = "0";
        return;
      }

      const dealsPerMonth = incomeGoal / commissionPerDeal;
      const dealsPerDay = dealsPerMonth / workDays;

      const closeFraction = closeRate / 100;
      const showsPerDay = dealsPerDay / (closeFraction || 1);
      const appointmentsPerDay = showsPerDay; // tweak later if you want a diff ratio

      dealsPerMonthEl.textContent = dealsPerMonth.toFixed(1);
      dealsPerDayEl.textContent = dealsPerDay.toFixed(2);
      appointmentsPerDayEl.textContent = appointmentsPerDay.toFixed(2);
      showsPerDayEl.textContent = showsPerDay.toFixed(2);
    });
  }

  /* ===============================
   *  COPY BUTTONS (shared)
   * =============================== */

  document
    .querySelectorAll(".secondary-btn[data-copy-target]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-copy-target");
        const el = document.getElementById(targetId);
        if (!el) return;

        el.select();
        el.setSelectionRange(0, 99999);
        document.execCommand("copy");

        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = original;
        }, 1500);
      });
    });
});
