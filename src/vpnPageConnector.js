const DEFAULT_MAX_BYTES = 65536;

export async function fetchVpnPage({
  url,
  fetchImpl = fetch,
  timeoutMs = Number.parseInt(process.env.EPHEMEROS_VPN_TIMEOUT_MS ?? "10000", 10),
  maxBytes = Number.parseInt(process.env.EPHEMEROS_VPN_PAGE_MAX_BYTES ?? `${DEFAULT_MAX_BYTES}`, 10)
}) {
  if (!url) {
    throw new Error("EPHEMEROS_VPN_PAGE_URL is required when EPHEMEROS_CONTEXT_SOURCE=vpn-page");
  }
  assertAllowedUrl(url);

  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`VPN page fetch failed: HTTP ${response.status}`);
  }

  const contentType = response.headers?.get?.("content-type") ?? "";
  const raw = await response.text();
  const clipped = raw.slice(0, maxBytes);
  const text = contentType.includes("html") || clipped.includes("<html")
    ? htmlToText(clipped)
    : clipped;

  return {
    urlHost: new URL(url).host,
    contentType,
    bytesRead: Buffer.byteLength(clipped, "utf8"),
    sanitizedText: redactSensitiveText(normalizeWhitespace(text))
  };
}

export async function invokeVpnPageContext(payload) {
  const page = await fetchVpnPage({
    url: process.env.EPHEMEROS_VPN_PAGE_URL
  });

  return {
    contextId: payload.requestId ?? "bob-demo-vpn-page",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    metadata: {
      dataset: "vpn_page_sanitized",
      classification: "sanitized-vpn-page",
      connector: "vpn-page",
      remoteContentStored: false,
      remoteContentSentToBob: "sanitized-text-only",
      urlHost: page.urlHost,
      contentType: page.contentType,
      bytesRead: page.bytesRead,
      redaction: "email-phone-id-patterns"
    },
    content: [
      "# Sanitized VPN Page Context",
      "",
      "Remote page body was fetched once, sanitized in memory, and not stored raw.",
      "",
      "## Page Text",
      "",
      page.sanitizedText
    ].join("\n")
  };
}

export function redactSensitiveText(text) {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[REDACTED_PHONE]")
    .replace(/\b[AU]\d{7}[A-Z]\b/gi, "[REDACTED_NUS_ID]");
}

function assertAllowedUrl(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("VPN page URL must use http or https");
  }

  const allowedSuffixes = (process.env.EPHEMEROS_VPN_ALLOWED_HOST_SUFFIXES ?? "nus.edu.sg")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const host = parsed.hostname.toLowerCase();
  const allowed = allowedSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  if (!allowed) {
    throw new Error(`VPN page host ${parsed.hostname} is not in EPHEMEROS_VPN_ALLOWED_HOST_SUFFIXES`);
  }
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeWhitespace(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, Number.parseInt(process.env.EPHEMEROS_VPN_PAGE_OUTPUT_MAX_CHARS ?? "12000", 10));
}
