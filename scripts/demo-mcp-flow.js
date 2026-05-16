import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createEphemerosMcpServer } from "../src/mcpServer.js";
import { invokeMockRestrictedContext } from "../src/mockRestrictedContext.js";

async function withTimeout(promise, ms, label) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const contextDir = path.resolve(".bob_restricted_context");
  const server = createEphemerosMcpServer({
    config: {
      contextDir,
      maxContextBytes: 262144
    },
    invokeLambda: invokeMockRestrictedContext
  });
  const client = new Client({
    name: "bob-poc-client",
    version: "0.1.0"
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const verbose = process.env.EPHEMEROS_DEMO_VERBOSE === "true";

  try {
    await withTimeout(Promise.all([server.connect(serverTransport), client.connect(clientTransport)]), 10000, "MCP connect");

    const fetchResult = await withTimeout(
      client.callTool({
        name: "fetch_context",
        arguments: {
          requestId: process.env.EPHEMEROS_DEMO_REQUEST_ID ?? "bob-mcp-demo-bond-yields",
          resourceType: process.env.EPHEMEROS_DEMO_RESOURCE_TYPE ?? "schema",
          resourceId: process.env.EPHEMEROS_DEMO_RESOURCE_ID ?? "quant/rates/bond_yields",
          purpose:
            process.env.EPHEMEROS_DEMO_PURPOSE ??
            "IBM Bob needs schema context to write Python query code for historical bond yields"
        }
      }),
      Number.parseInt(process.env.EPHEMEROS_DEMO_TIMEOUT_MS ?? "60000", 10),
      "fetch_context"
    );
    const metadata = parseToolJson(fetchResult, "fetch_context");
    const fileContent = await fs.readFile(metadata.path, "utf8");
    const evidencePath = await writeEvidenceCopy(fileContent);

    printFetchResult({ metadata, fileContent, evidencePath, verbose });

    const cleanupResult = await withTimeout(
      client.callTool({
        name: "cleanup_context",
        arguments: {
          contextId: metadata.contextId
        }
      }),
      10000,
      "cleanup_context"
    );

    printCleanupResult(cleanupResult);
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
}

function printFetchResult({ metadata, fileContent, evidencePath, verbose }) {
  console.log("Ephemeros Demo Result");
  console.log("=====================");
  console.log(`Status: ${metadata.success ? "success" : "failed"}`);
  console.log(`Tool: fetch_context`);
  console.log(`Context ID: ${metadata.contextId}`);
  console.log(`Context file: ${metadata.path}`);
  if (evidencePath) {
    console.log(`Evidence copy: ${evidencePath}`);
  }
  console.log(`Bytes written: ${metadata.bytes}`);
  if (metadata.expiresAt) {
    console.log(`Expires at: ${metadata.expiresAt}`);
  }

  const metadataText = verbose ? fileContent : summarizeContext(fileContent);
  console.log("");
  console.log("Filtered Context Summary");
  console.log("------------------------");
  console.log(metadataText);
}

function printCleanupResult(cleanupResult) {
  const cleanup = parseToolJson(cleanupResult, "cleanup_context");
  console.log("");
  console.log("Cleanup");
  console.log("-------");
  console.log(`Status: ${cleanup.success ? "success" : "failed"}`);
  console.log(`Removed context file: ${cleanup.removed}`);
}

function parseToolJson(toolResult, toolName) {
  const text = toolResult.content?.[0]?.text ?? "";
  if (toolResult.isError) {
    throw new Error(`${toolName} failed: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${toolName} returned non-JSON output: ${text}`);
  }
}

async function writeEvidenceCopy(fileContent) {
  const evidenceFile = process.env.EPHEMEROS_DEMO_EVIDENCE_FILE ?? path.join("bob_sessions", "demo-mcp-context.md");
  if (evidenceFile.toLowerCase() === "false") {
    return null;
  }

  const evidencePath = path.resolve(evidenceFile);
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  await fs.writeFile(evidencePath, fileContent, "utf8");
  return evidencePath;
}

function summarizeContext(fileContent) {
  const lines = fileContent.split(/\r?\n/);
  const summaryKeys = [
    "resourceType",
    "resourceId",
    "dataset",
    "classification",
    "connector",
    "filterProvider",
    "filterGuard",
    "remoteContentStored",
    "remoteContentSentToBob",
    "urlHost",
    "httpStatus",
    "source"
  ];
  const summaryLines = lines.filter((line) => summaryKeys.some((key) => line.startsWith(`- ${key}:`)));
  const sqlStart = lines.findIndex((line) => line.trim() === "```sql");
  const sqlEnd = sqlStart >= 0 ? lines.findIndex((line, index) => index > sqlStart && line.trim() === "```") : -1;
  const sqlLines = sqlStart >= 0 && sqlEnd > sqlStart ? lines.slice(sqlStart, sqlEnd + 1) : [];
  const accessRule = lines.find((line) => line.startsWith("Access rule:"));

  return [
    ...summaryLines,
    "",
    sqlLines.length > 0 ? "Schema delivered to Bob:" : "Context delivered to Bob:",
    ...(sqlLines.length > 0 ? sqlLines : excerptRetrievedContent(lines)),
    accessRule ? "" : null,
    accessRule ?? null
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function excerptRetrievedContent(lines) {
  const start = lines.findIndex((line) => line.trim() === "## Retrieved Content");
  const contentLines = start >= 0 ? lines.slice(start + 1).filter(Boolean) : lines;
  return contentLines.slice(0, 24);
}

main()
  .then(() => {
    setTimeout(() => process.exit(0), 50).unref();
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
