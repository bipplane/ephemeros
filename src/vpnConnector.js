import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultSyntheticSchemaPath = path.resolve(__dirname, "../data/vpn-synthetic-schema.md");

export async function checkVpnReachability({
  url,
  fetchImpl = fetch,
  timeoutMs = Number.parseInt(process.env.EPHEMEROS_VPN_TIMEOUT_MS ?? "10000", 10)
}) {
  if (!url) {
    throw new Error("EPHEMEROS_VPN_TEST_URL is required when EPHEMEROS_CONTEXT_SOURCE=vpn-check");
  }

  const startedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs)
    });

    return {
      urlHost: safeHost(url),
      startedAt,
      checkedAt: new Date().toISOString(),
      reachable: true,
      status: response.status,
      statusText: response.statusText,
      redirected: response.redirected
    };
  } catch (error) {
    const unreachable = new Error(`VPN target unreachable: ${error.message}`);
    unreachable.statusCode = 503;
    unreachable.details = {
      urlHost: safeHost(url),
      startedAt,
      checkedAt: new Date().toISOString(),
      reachable: false
    };
    throw unreachable;
  }
}

export async function loadVpnSyntheticContext(filePath = process.env.EPHEMEROS_VPN_SYNTHETIC_SCHEMA_FILE) {
  return fs.readFile(filePath ? path.resolve(filePath) : defaultSyntheticSchemaPath, "utf8");
}

export async function invokeVpnCheckContext(payload) {
  const reachability = await checkVpnReachability({
    url: process.env.EPHEMEROS_VPN_TEST_URL
  });
  const content = await loadVpnSyntheticContext();

  return {
    contextId: payload.requestId ?? "bob-demo-vpn-check",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    metadata: {
      dataset: "vpn_synthetic_schema",
      classification: "synthetic-demo",
      connector: "vpn-check",
      remoteContentStored: false,
      remoteContentSentToBob: false,
      urlHost: reachability.urlHost,
      httpStatus: reachability.status,
      checkedAt: reachability.checkedAt
    },
    content
  };
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}
