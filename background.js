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

function isValidDomains(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  if (/[\r\n]/.test(value)) {
    return false;
  }

  const tokens = parseTargetDomains(value);
  return tokens.length > 0 && tokens.every(isValidDomainToken);
}

function domainPatternToRegex(pattern) {
  const trimmed = pattern.trim().toLowerCase();

  if (trimmed === "*") {
    return null;
  }

  return trimmed
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[a-zA-Z0-9.-]*");
}

function buildDomainRegexFilter(domains) {
  const tokens = parseTargetDomains(domains);

  if (tokens.includes("*")) {
    return null;
  }

  const parts = tokens.map(domainPatternToRegex).filter(Boolean);

  if (!parts.length) {
    return null;
  }

  const domainRegex = parts.length === 1 ? parts[0] : `(?:${parts.join("|")})`;

  return `^[a-zA-Z][a-zA-Z0-9+.-]*://(?:[^@/]+@)?${domainRegex}(?::[0-9]+)?(?:[/?#].*)?$`;
}

async function getSettings() {
  return chrome.storage.sync.get(SETTING_KEYS);
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

async function updateHeaderRule() {
  const settings = await getSettings();
  const validHeaders = normalizeHeaders(settings).filter((header) => {
    return (
      header.name &&
      isValidHeaderName(header.name) &&
      isValidHeaderValue(header.value) &&
      isValidDomains(header.domains)
    );
  });
  const addRules = [];

  if (settings.enabled && validHeaders.length) {
    const rulesByFilter = new Map();

    for (const header of validHeaders) {
      const regexFilter = buildDomainRegexFilter(header.domains);
      const ruleKey = regexFilter || "*";

      if (!rulesByFilter.has(ruleKey)) {
        rulesByFilter.set(ruleKey, {
          regexFilter,
          requestHeaders: []
        });
      }

      const group = rulesByFilter.get(ruleKey);
      const existingHeader = group.requestHeaders.find(
        (h) => h.header.toLowerCase() === header.name.toLowerCase()
      );

      if (existingHeader) {
        existingHeader.value = header.value;
      } else {
        group.requestHeaders.push({
          header: header.name,
          operation: "set",
          value: header.value
        });
      }
    }

    let ruleId = 1;

    for (const { regexFilter, requestHeaders } of rulesByFilter.values()) {
      const condition = {
        resourceTypes: RESOURCE_TYPES
      };

      if (regexFilter) {
        condition.regexFilter = regexFilter;
        condition.isUrlFilterCaseSensitive = false;
      }

      addRules.push({
        id: ruleId++,
        priority: regexFilter ? 2 : 1,
        action: {
          type: "modifyHeaders",
          requestHeaders
        },
        condition
      });
    }
  }

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
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
