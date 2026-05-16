import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { invokeVpnPageContext } from "./vpnPageConnector.js";
import { invokeVpnCheckContext } from "./vpnConnector.js";
import { filterSecureEnclaveContext, readSecureEnclaveText } from "./watsonxFilter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.resolve(__dirname, "../data/synthetic-restricted-context.json");
const secureEnclavePath = path.resolve(__dirname, "../mock-secure-enclave/proprietary_data.txt");

async function loadDataset() {
  const raw = await fs.readFile(datasetPath, "utf8");
  return JSON.parse(raw);
}

export async function invokeMockRestrictedContext(payload) {
  if (process.env.EPHEMEROS_CONTEXT_SOURCE === "vpn-check") {
    return invokeVpnCheckContext(payload);
  }

  if (process.env.EPHEMEROS_CONTEXT_SOURCE === "vpn-page") {
    return invokeVpnPageContext(payload);
  }

  if (process.env.EPHEMEROS_CONTEXT_SOURCE === "secure-enclave") {
    const rawText = await readSecureEnclaveText(process.env.EPHEMEROS_SECURE_ENCLAVE_FILE ?? secureEnclavePath);
    const filtered = await filterSecureEnclaveContext({ text: rawText, resourceId: payload.resourceId });
    return {
      contextId: payload.requestId ?? "bob-demo-bond-yields",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      metadata: {
        dataset: "synthetic_secure_enclave",
        classification: "synthetic-demo",
        filterProvider: process.env.EPHEMEROS_FILTER_PROVIDER ?? "local",
        filterGuard: "local-schema-allowlist",
        source: "mock-secure-enclave/proprietary_data.txt",
        fetchedBy: os.userInfo().username
      },
      content: filtered
    };
  }

  const dataset = await loadDataset();
  const resource = dataset.resources.find(
    (item) => item.resourceType === payload.resourceType && item.resourceId === payload.resourceId
  );

  if (!resource) {
    throw new Error(`Synthetic resource not found: ${payload.resourceType}/${payload.resourceId}`);
  }

  return {
    contextId: payload.requestId ?? resource.contextId,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    metadata: {
      ...resource.metadata,
      fetchedBy: os.userInfo().username,
      source: "data/synthetic-restricted-context.json"
    },
    content: resource.content
  };
}
