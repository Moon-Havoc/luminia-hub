const form = document.getElementById("key-form");
const result = document.getElementById("result");
const generateButton = document.getElementById("generate-button");
const servicePill = document.getElementById("service-pill");
const prefillBanner = document.getElementById("prefill-banner");
const prefillCopy = document.getElementById("prefill-copy");
const terminalLines = [...document.querySelectorAll("[data-terminal-line]")];

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

  const reduceMotion = window.LuminiaSite?.reduceMotion;
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
      window.LuminiaSite?.observeReveal(result, 0);
    });
    return;
  }

  const headline = payload.created ? "Fresh key generated" : "Existing active key found";
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
    window.LuminiaSite?.observeReveal(result, 0);
  });
}

const query = new URLSearchParams(window.location.search);
const robloxUserField = document.getElementById("robloxUser");
const prefilledRobloxUser = query.get("robloxUser");
if (prefilledRobloxUser && robloxUserField) {
  robloxUserField.value = prefilledRobloxUser;
  prefillBanner.classList.remove("hidden");
  prefillCopy.textContent = `Roblox user detected: ${prefilledRobloxUser}`;
}

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
