const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const SETTING_KEYS = [
  "enabled",
  "headers",
  "headerName",
  "headerValue"
];

const form = document.querySelector("#settings-form");
const enabledInput = document.querySelector("#enabled");
const addHeaderButton = document.querySelector("#add-header");
const headersList = document.querySelector("#headers-list");
const statusText = document.querySelector("#status");
const currentState = document.querySelector("#current-state");

let headers = [];

function isValidHeaderName(value) {
  return HEADER_NAME_PATTERN.test(value);
}

function isValidHeaderValue(value) {
  return !/[\r\n]/.test(value);
}

function isValidDomainToken(token) {
  return /^[a-zA-Z0-9.*_-]+$/.test(token);
}

function extractDomain(address) {
  if (!address || typeof address !== "string") {
    return "";
  }

  let cleaned = address.trim();
  cleaned = cleaned.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  cleaned = cleaned.replace(/^[^@/]+@/, "");
  cleaned = cleaned.replace(/[/?#].*$/, "");
  cleaned = cleaned.replace(/:[0-9]+$/, "");

  return cleaned.toLowerCase();
}

function parseTargetDomains(input) {
  if (!input || typeof input !== "string") {
    return ["*"];
  }

  const tokens = input
    .split(/[\s,;]+/)
    .map((item) => extractDomain(item))
    .filter(Boolean);

  return tokens.length ? tokens : ["*"];
}

function updateStateText() {
  currentState.textContent = enabledInput.checked ? "Enabled" : "Disabled";
}

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.className = type ? `status ${type}` : "status";
}

function createEmptyHeader() {
  return {
    name: "",
    value: "",
    domains: "*"
  };
}

function createHeaderField(labelText, placeholder, value, fieldName, index) {
  const label = document.createElement("label");
  label.className = "field";

  const labelTextElement = document.createElement("span");
  labelTextElement.textContent = labelText;

  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = placeholder;
  input.value = value;
  input.dataset.field = fieldName;
  input.setAttribute("aria-label", `${labelText} ${index + 1}`);

  label.append(labelTextElement, input);

  return label;
}

function renderHeaders() {
  headersList.replaceChildren();

  if (!headers.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "No headers configured.";
    headersList.append(emptyState);
    return;
  }

  headers.forEach((header, index) => {
    const row = document.createElement("div");
    row.className = "header-row";
    row.dataset.index = String(index);

    const fields = document.createElement("div");
    fields.className = "header-fields";
    fields.append(
      createHeaderField("Header name", "X-Custom-Header", header.name, "name", index),
      createHeaderField("Header value", "example", header.value, "value", index),
      createHeaderField("Target domain(s)", "*", header.domains ?? "*", "domains", index)
    );

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "X";
    removeButton.title = "Remove header";
    removeButton.setAttribute("aria-label", `Remove header ${index + 1}`);

    row.append(fields, removeButton);
    headersList.append(row);
  });
}

function normalizeHeaders(settings) {
  if (Array.isArray(settings.headers)) {
    return settings.headers.map((header) => ({
      name: String(header?.name ?? "").trim(),
      value: String(header?.value ?? ""),
      domains: String(header?.domains ?? "*").trim() || "*"
    }));
  }

  const legacyName = String(settings.headerName ?? "").trim();

  if (!legacyName) {
    return [];
  }

  return [
    {
      name: legacyName,
      value: String(settings.headerValue ?? ""),
      domains: "*"
    }
  ];
}

function getHeadersFromForm() {
  return Array.from(headersList.querySelectorAll(".header-row"))
    .map((row) => ({
      name: row.querySelector('[data-field="name"]').value.trim(),
      value: row.querySelector('[data-field="value"]').value,
      domains: (row.querySelector('[data-field="domains"]')?.value ?? "").trim()
    }))
    .filter((header) => header.name || header.value || (header.domains && header.domains !== "*"));
}

function validateHeaders(nextHeaders) {
  const headerKeys = new Set();

  for (const [index, header] of nextHeaders.entries()) {
    const number = index + 1;

    if (!header.name) {
      return `Header ${number} needs a name.`;
    }

    if (!isValidHeaderName(header.name)) {
      return `Header ${number} name contains invalid characters.`;
    }

    if (!isValidHeaderValue(header.value)) {
      return `Header ${number} value cannot contain line breaks.`;
    }

    if (!header.domains) {
      return `Header ${number} needs a target domain.`;
    }

    if (/[\r\n]/.test(header.domains)) {
      return `Header ${number} target domain cannot contain line breaks.`;
    }

    const domainTokens = parseTargetDomains(header.domains);

    if (!domainTokens.length) {
      return `Header ${number} needs a target domain.`;
    }

    for (const token of domainTokens) {
      if (!isValidDomainToken(token)) {
        return `Header ${number} target domain contains invalid characters.`;
      }
    }

    const normalizedName = header.name.toLowerCase();
    const normalizedDomains = domainTokens.includes("*")
      ? "*"
      : Array.from(new Set(domainTokens)).sort().join(",");
    const headerKey = `${normalizedName}:::${normalizedDomains}`;

    if (headerKeys.has(headerKey)) {
      return normalizedDomains === "*"
        ? `Header ${number} duplicates another header name.`
        : `Header ${number} duplicates another header name for the same domain.`;
    }

    headerKeys.add(headerKey);
  }

  return "";
}

function getFormSettings(allowEmptyEnabled = false) {
  const nextHeaders = getHeadersFromForm();

  return {
    enabled: enabledInput.checked && (allowEmptyEnabled || nextHeaders.length > 0),
    headers: nextHeaders
  };
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get(SETTING_KEYS);

  enabledInput.checked = Boolean(settings.enabled);
  headers = normalizeHeaders(settings);
  renderHeaders();
  updateStateText();
}

addHeaderButton.addEventListener("click", () => {
  headers.push(createEmptyHeader());
  renderHeaders();
  headersList.querySelector(".header-row:last-child input")?.focus();
  setStatus("Save to apply changes.");
});

headersList.addEventListener("input", (event) => {
  if (!(event.target instanceof HTMLInputElement)) {
    return;
  }

  const row = event.target.closest(".header-row");

  if (!row) {
    return;
  }

  const index = Number(row.dataset.index);
  const field = event.target.dataset.field;

  if (!headers[index] || !field) {
    return;
  }

  headers[index][field] = event.target.value;
});

headersList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const removeButton = event.target.closest(".remove-button");

  if (!removeButton) {
    return;
  }

  const row = removeButton.closest(".header-row");

  if (!row) {
    return;
  }

  const index = Number(row.dataset.index);

  headers.splice(index, 1);
  renderHeaders();
  setStatus("Save to apply changes.");
});

enabledInput.addEventListener("change", async () => {
  updateStateText();

  if (!enabledInput.checked) {
    try {
      await chrome.storage.sync.set({ enabled: false });
      setStatus("Disabled.", "success");
    } catch (error) {
      setStatus(error.message || "Could not update settings.", "error");
    }
    return;
  }

  const settings = getFormSettings(true);
  const error = settings.headers.length
    ? validateHeaders(settings.headers)
    : "Add at least one header before enabling.";

  if (error) {
    enabledInput.checked = false;
    updateStateText();
    setStatus(error, "error");
    return;
  }

  try {
    await chrome.storage.sync.set(settings);
    headers = settings.headers;
    renderHeaders();
    setStatus("Enabled.", "success");
  } catch (error) {
    enabledInput.checked = false;
    updateStateText();
    setStatus(error.message || "Could not update settings.", "error");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const settings = getFormSettings();
  const error = validateHeaders(settings.headers);

  if (error) {
    setStatus(error, "error");
    return;
  }

  try {
    await chrome.storage.sync.set(settings);
    enabledInput.checked = settings.enabled;
    headers = settings.headers;
    renderHeaders();
    updateStateText();
    setStatus(settings.enabled ? "Saved and enabled." : "Saved and disabled.", "success");
  } catch (error) {
    setStatus(error.message || "Could not save settings.", "error");
  }
});

loadSettings().catch((error) => {
  setStatus(error.message || "Could not load settings.", "error");
});
