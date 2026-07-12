const RULE_ID = 1;

const SETTING_KEYS = [
  "enabled",
  "headers",
  "headerName",
  "headerValue"
];
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other"
];

function isValidHeaderName(value) {
  return HEADER_NAME_PATTERN.test(value);
}

function isValidHeaderValue(value) {
  return !/[\r\n]/.test(value);
}

async function getSettings() {
  return chrome.storage.sync.get(SETTING_KEYS);
}

function normalizeHeaders(settings) {
  if (Array.isArray(settings.headers)) {
    return settings.headers.map((header) => ({
      name: String(header?.name ?? "").trim(),
      value: String(header?.value ?? "")
    }));
  }

  const legacyName = String(settings.headerName ?? "").trim();

  if (!legacyName) {
    return [];
  }

  return [
    {
      name: legacyName,
      value: String(settings.headerValue ?? "")
    }
  ];
}

async function updateHeaderRule() {
  const settings = await getSettings();
  const requestHeaders = normalizeHeaders(settings)
    .filter((header) => {
      return (
        header.name &&
        isValidHeaderName(header.name) &&
        isValidHeaderValue(header.value)
      );
    })
    .map((header) => ({
      header: header.name,
      operation: "set",
      value: header.value
    }));
  const addRules = [];

  if (settings.enabled && requestHeaders.length) {
    addRules.push({
      id: RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders
      },
      condition: {
        resourceTypes: RESOURCE_TYPES
      }
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules
  });
}

chrome.runtime.onInstalled.addListener(() => {
  updateHeaderRule();
});

chrome.runtime.onStartup.addListener(() => {
  updateHeaderRule();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  if (SETTING_KEYS.some((key) => key in changes)) {
    updateHeaderRule();
  }
});
