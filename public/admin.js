const loginView = document.getElementById("admin-login-view");
const dashboardView = document.getElementById("admin-dashboard-view");
const loginForm = document.getElementById("admin-login-form");
const loginButton = document.getElementById("login-button");
const loginFeedback = document.getElementById("login-feedback");
const logoutButton = document.getElementById("logout-button");
const configWarning = document.getElementById("admin-config-warning");
const adminUserLabel = document.getElementById("admin-user-label");
const scriptCountLabel = document.getElementById("script-count-label");
const adminApiStatus = document.getElementById("admin-api-status");
const scriptForm = document.getElementById("script-form");
const scriptEditId = document.getElementById("script-edit-id");
const scriptTitle = document.getElementById("script-title");
const scriptSlug = document.getElementById("script-slug");
const scriptDescription = document.getElementById("script-description");
const scriptFile = document.getElementById("script-file");
const scriptContent = document.getElementById("script-content");
const scriptSaveButton = document.getElementById("script-save-button");
const scriptResetButton = document.getElementById("script-reset-button");
const scriptFeedback = document.getElementById("script-feedback");
const scriptList = document.getElementById("script-list");
const scriptEmptyState = document.getElementById("script-empty-state");

let scripts = [];
let slugEditedManually = false;

function setFeedback(node, message, type) {
  node.textContent = message;
  node.classList.remove("hidden", "error", "success");
  if (type) {
    node.classList.add(type);
  }
}

function clearFeedback(node) {
  node.textContent = "";
  node.classList.add("hidden");
  node.classList.remove("error", "success");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function showLogin(configured) {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
  logoutButton.classList.add("hidden");

  if (!configured) {
    configWarning.classList.remove("hidden");
    configWarning.textContent =
      "Admin access is not configured yet. Add ADMIN_USERS and ADMIN_SESSION_SECRET in your environment.";
  } else {
    configWarning.classList.add("hidden");
    configWarning.textContent = "";
  }
}

function showDashboard(username) {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  adminUserLabel.textContent = username;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({
    ok: false,
    error: "Invalid server response.",
  }));

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

async function refreshHealth() {
  try {
    const payload = await requestJson("/api/health", { headers: {} });
    adminApiStatus.textContent = `Live • ${new Date(payload.time).toLocaleTimeString()}`;
  } catch (error) {
    adminApiStatus.textContent = "Offline";
  }
}

function rawUrlFor(slug) {
  return `${window.location.origin}/api/scripts/${slug}/raw`;
}

function resetScriptForm() {
  scriptEditId.value = "";
  scriptForm.reset();
  slugEditedManually = false;
  scriptSaveButton.textContent = "Save Script";
  clearFeedback(scriptFeedback);
}

function loadScriptIntoForm(script) {
  scriptEditId.value = script.id;
  scriptTitle.value = script.title;
  scriptSlug.value = script.slug;
  scriptDescription.value = script.description || "";
  scriptContent.value = script.content;
  slugEditedManually = true;
  scriptSaveButton.textContent = "Update Script";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderScripts() {
  scriptList.innerHTML = "";
  scriptCountLabel.textContent = String(scripts.length);
  scriptEmptyState.classList.toggle("hidden", scripts.length > 0);

  scripts.forEach((script) => {
    const card = document.createElement("article");
    card.className = "script-card";

    const header = document.createElement("header");
    const headingWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = script.title;

    const description = document.createElement("p");
    description.textContent = script.description || "No description provided.";

    headingWrap.append(title, description);
    header.appendChild(headingWrap);

    const meta = document.createElement("div");
    meta.className = "script-meta";

    const slugMeta = document.createElement("span");
    slugMeta.textContent = `Slug: ${script.slug}`;

    const byMeta = document.createElement("span");
    byMeta.textContent = `By: ${script.uploaded_by}`;

    const updatedMeta = document.createElement("span");
    updatedMeta.textContent = `Updated: ${new Date(script.updated_at).toLocaleString()}`;

    meta.append(slugMeta, byMeta, updatedMeta);

    const actions = document.createElement("div");
    actions.className = "script-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.dataset.editScript = script.id;
    editButton.textContent = "Edit";

    const copyButton = document.createElement("button");
    copyButton.className = "ghost-button";
    copyButton.type = "button";
    copyButton.dataset.copyScript = script.slug;
    copyButton.textContent = "Copy Raw URL";

    const openLink = document.createElement("a");
    openLink.className = "ghost-button";
    openLink.href = rawUrlFor(script.slug);
    openLink.target = "_blank";
    openLink.rel = "noreferrer";
    openLink.textContent = "Open Raw";

    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button";
    deleteButton.type = "button";
    deleteButton.dataset.deleteScript = script.id;
    deleteButton.textContent = "Delete";

    actions.append(editButton, copyButton, openLink, deleteButton);
    card.append(header, meta, actions);
    scriptList.appendChild(card);
  });
}

async function loadScripts() {
  const payload = await requestJson("/api/admin/scripts", { headers: {} });
  scripts = payload.scripts || [];
  renderScripts();
}

async function bootstrap() {
  await refreshHealth();

  try {
    const payload = await requestJson("/api/admin/session", { headers: {} });
    if (payload.authenticated) {
      showDashboard(payload.username);
      await loadScripts();
      return;
    }

    showLogin(payload.configured);
  } catch (error) {
    showLogin(false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFeedback(loginFeedback);

  const body = {
    username: document.getElementById("login-username").value,
    password: document.getElementById("login-password").value,
  };

  try {
    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    const payload = await requestJson("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(body),
    });

    showDashboard(payload.username);
    await loadScripts();
  } catch (error) {
    setFeedback(loginFeedback, error.message, "error");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Enter Dashboard";
  }
});

logoutButton.addEventListener("click", async () => {
  await requestJson("/api/admin/logout", {
    method: "POST",
  }).catch(() => {});
  showLogin(true);
});

scriptTitle.addEventListener("input", () => {
  if (!slugEditedManually) {
    scriptSlug.value = slugify(scriptTitle.value);
  }
});

scriptSlug.addEventListener("input", () => {
  slugEditedManually = true;
});

scriptFile.addEventListener("change", async () => {
  const [file] = scriptFile.files || [];
  if (!file) {
    return;
  }

  const text = await file.text();
  scriptContent.value = text;

  if (!scriptTitle.value) {
    scriptTitle.value = file.name.replace(/\.[^/.]+$/, "");
  }

  if (!slugEditedManually) {
    scriptSlug.value = slugify(scriptTitle.value || file.name);
  }
});

scriptResetButton.addEventListener("click", () => {
  resetScriptForm();
});

scriptForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFeedback(scriptFeedback);

  const payload = {
    title: scriptTitle.value,
    slug: scriptSlug.value,
    description: scriptDescription.value,
    content: scriptContent.value,
  };

  try {
    scriptSaveButton.disabled = true;
    scriptSaveButton.textContent = scriptEditId.value ? "Updating..." : "Saving...";

    await requestJson("/api/admin/scripts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setFeedback(scriptFeedback, "Script saved successfully.", "success");
    await loadScripts();
    resetScriptForm();
  } catch (error) {
    setFeedback(scriptFeedback, error.message, "error");
  } finally {
    scriptSaveButton.disabled = false;
    scriptSaveButton.textContent = scriptEditId.value ? "Update Script" : "Save Script";
  }
});

scriptList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-script]");
  if (editButton) {
    const script = scripts.find((entry) => String(entry.id) === editButton.dataset.editScript);
    if (script) {
      loadScriptIntoForm(script);
    }
    return;
  }

  const copyButton = event.target.closest("[data-copy-script]");
  if (copyButton) {
    try {
      await navigator.clipboard.writeText(rawUrlFor(copyButton.dataset.copyScript));
      copyButton.textContent = "Copied URL";
      window.setTimeout(() => {
        copyButton.textContent = "Copy Raw URL";
      }, 1400);
    } catch (error) {
      copyButton.textContent = "Copy failed";
    }
    return;
  }

  const deleteButton = event.target.closest("[data-delete-script]");
  if (deleteButton) {
    const script = scripts.find((entry) => String(entry.id) === deleteButton.dataset.deleteScript);
    if (!script) {
      return;
    }

    const confirmed = window.confirm(`Delete ${script.title}?`);
    if (!confirmed) {
      return;
    }

    try {
      await requestJson(`/api/admin/scripts/${script.id}`, {
        method: "DELETE",
      });
      await loadScripts();
    } catch (error) {
      setFeedback(scriptFeedback, error.message, "error");
    }
  }
});

bootstrap();
