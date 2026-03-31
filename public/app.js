const form = document.getElementById("key-form");
const result = document.getElementById("result");
const generateButton = document.getElementById("generate-button");
const servicePill = document.getElementById("service-pill");
const prefillBanner = document.getElementById("prefill-banner");
const prefillCopy = document.getElementById("prefill-copy");
const accessPanelTitle = document.getElementById("access-panel-title");
const accessPanelCopy = document.getElementById("access-panel-copy");
const normalAccessView = document.getElementById("normal-access-view");
const paidAccessView = document.getElementById("paid-access-view");
const paidAccessTitle = document.getElementById("paid-access-title");
const paidAccessDescription = document.getElementById("paid-access-description");
const paidAccessCommand = document.getElementById("paid-access-command");
const paidAccessCommandCopy = document.getElementById("paid-access-command-copy");
const terminalLines = [...document.querySelectorAll("[data-terminal-line]")];

const ACCESS_SCOPES = {
  normal: {
    label: "Normal access",
  },
  premium: {
    label: "Premium access",
    command: "~prem-gen {user} {robloxuser} {duration}",
    title: "Premium key required",
    description: "This access lane uses a staff-issued premium key with a set duration.",
  },
  bb: {
    label: "Blade Ball",
    command: "~bb {user} {robloxuser}",
    title: "Blade Ball key required",
    description: "This script is locked to Blade Ball paid keys. Normal website keys will not unlock it.",
  },
  sab: {
    label: "Steal A Brainrot",
    command: "~sab {user} {robloxuser}",
    title: "Steal A Brainrot key required",
    description: "This script is locked to Steal A Brainrot paid keys. Normal website keys will not unlock it.",
  },
  arsenal: {
    label: "Arsenal",
    command: "~arsenal {user} {robloxuser}",
    title: "Arsenal key required",
    description: "This script is locked to Arsenal paid keys. Normal website keys will not unlock it.",
  },
};

function typeTerminalLine(node, text, delay) {
  window.setTimeout(() => {
    let index = 0;
    node.textContent = "";

    function tick() {
      node.textContent = text.slice(0, index);
      index += 1;
      if (index <= text.length) {
        window.setTimeout(tick, 16);
      }
    }

    tick();
  }, delay);
}

function animateTerminal() {
  if (!terminalLines.length) {
    return;
  }

  const reduceMotion = window.AmethystSite?.reduceMotion;
  if (reduceMotion) {
    terminalLines.forEach((line) => {
      line.textContent = line.dataset.text || line.textContent;
    });
    return;
  }

  const queue = terminalLines.map((line) => line.dataset.text || line.textContent);

  function runCycle() {
    let delay = 0;
    terminalLines.forEach((line, index) => {
      line.textContent = "";
      typeTerminalLine(line, queue[index], delay);
      delay += queue[index].length * 16 + 280;
    });

    window.setTimeout(runCycle, delay + 2400);
  }

  runCycle();
}

function humanExpiry(value) {
  return value === "never" ? "Never" : new Date(value).toLocaleString();
}

function setServiceStatus(mode, label) {
  servicePill.classList.remove("loading", "online", "offline");
  servicePill.classList.add(mode);
  servicePill.querySelector("span:last-child").textContent = label;
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error("Health check failed");
    }

    setServiceStatus("online", `ONLINE • ${new Date(payload.time).toLocaleTimeString()}`);
  } catch (error) {
    setServiceStatus("offline", "OFFLINE");
  }
}

function resultChip(type, error) {
  if (error) {
    return '<span class="status-chip error">Issue detected</span>';
  }

  if (type === "premium") {
    return '<span class="status-chip premium">Premium access</span>';
  }

  return '<span class="status-chip normal">Normal access</span>';
}

function renderResult(payload, error = false) {
  result.classList.remove("hidden");
  result.classList.toggle("error", error);
  result.setAttribute("data-reveal", "");
  result.classList.remove("is-visible");

  if (error) {
    result.innerHTML = `
      <div class="result-header">
        <p class="result-label">Request status</p>
        ${resultChip(null, true)}
      </div>
      <h3>Something needs attention</h3>
      <p>${payload}</p>
    `;
    window.requestAnimationFrame(() => {
      window.AmethystSite?.observeReveal(result, 0);
    });
    return;
  }

  const headline = payload.created ? "Fresh key generated" : "Existing active key found";
  const accessName = ACCESS_SCOPES[payload.scope || "normal"]?.label || payload.scope || payload.type;
  result.innerHTML = `
    <div class="result-header">
      <p class="result-label">${headline}</p>
      ${resultChip(payload.type, false)}
    </div>
    <div class="key-wrap">
      <div class="key-value">${payload.key}</div>
      <button class="copy-button" type="button" data-copy-key="${payload.key}">Copy Key</button>
    </div>
    <div class="result-meta">
      <article>
        <span>Access</span>
        <strong>${accessName}</strong>
      </article>
      <article>
        <span>Type</span>
        <strong>${payload.type}</strong>
      </article>
      <article>
        <span>Status</span>
        <strong>${payload.status}</strong>
      </article>
      <article>
        <span>Expires</span>
        <strong>${humanExpiry(payload.expiresAt)}</strong>
      </article>
    </div>
  `;

  window.requestAnimationFrame(() => {
    window.AmethystSite?.observeReveal(result, 0);
  });
}

function toggleAccessMode(scope, robloxUser) {
  const normalizedScope = ACCESS_SCOPES[scope] ? scope : "normal";
  const access = ACCESS_SCOPES[normalizedScope] || ACCESS_SCOPES.normal;
  const isPaid = normalizedScope !== "normal";

  normalAccessView.classList.toggle("hidden", isPaid);
  paidAccessView.classList.toggle("hidden", !isPaid);

  if (!isPaid) {
    accessPanelTitle.textContent = "Generate a normal key";
    accessPanelCopy.textContent = "Public access panel for 24-hour keys.";
    return;
  }

  accessPanelTitle.textContent = `${access.label} access`;
  accessPanelCopy.textContent = "This route is reserved for staff-issued access keys.";
  paidAccessTitle.textContent = access.title;
  paidAccessDescription.textContent = access.description;
  paidAccessCommand.textContent = access.command;
  paidAccessCommandCopy.textContent = robloxUser
    ? `Ask staff to issue this key for ${robloxUser}.`
    : "Ask staff to issue the correct key for this Roblox username.";
}

const query = new URLSearchParams(window.location.search);
const robloxUserField = document.getElementById("robloxUser");
const prefilledRobloxUser = query.get("robloxUser");
const rawRequestedScope = query.get("scope");
const requestedScope = ACCESS_SCOPES[rawRequestedScope] ? rawRequestedScope : "normal";
if (prefilledRobloxUser && robloxUserField) {
  robloxUserField.value = prefilledRobloxUser;
  prefillBanner.classList.remove("hidden");
  prefillCopy.textContent =
    requestedScope !== "normal"
      ? `Roblox user detected: ${prefilledRobloxUser} • ${ACCESS_SCOPES[requestedScope].label} route`
      : `Roblox user detected: ${prefilledRobloxUser}`;
}

toggleAccessMode(requestedScope, prefilledRobloxUser);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const idleLabel = generateButton.textContent;

  try {
    generateButton.disabled = true;
    generateButton.textContent = "Generating...";

    const response = await fetch("/api/keys/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to generate key.");
    }

    renderResult(data);
  } catch (error) {
    renderResult(error.message, true);
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = idleLabel;
  }
});

result.addEventListener("click", async (event) => {
  const copyButton = event.target.closest("[data-copy-key]");
  if (!copyButton) {
    return;
  }

  try {
    await navigator.clipboard.writeText(copyButton.dataset.copyKey);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy Key";
    }, 1400);
  } catch (error) {
    copyButton.textContent = "Copy failed";
  }
});

loadHealth();
animateTerminal();
