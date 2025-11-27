// TEMP TEST – Lot Rocket frontend JS
console.log("Lot Rocket frontend JS loaded");

document.addEventListener("DOMContentLoaded", () => {
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
    Object.values(panels).forEach((p) => p && p.classList.remove("is-active"));
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
});
