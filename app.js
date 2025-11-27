// public/app.js – frontend logic for Lot Rocket

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
          (Math.pow(1 + monthlyRat
