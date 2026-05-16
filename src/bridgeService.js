import { contextRequestSchema, cleanupRequestSchema, lambdaPayloadSchema } from "./schemas.js";
import { removeAllContextFiles, removeContextFile, safeContextId, writeContextFile } from "./contextStore.js";

function toMarkdown({ request, lambdaPayload }) {
  const metadata = lambdaPayload.metadata ?? {};
  const metadataLines = Object.entries(metadata).map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`);

  return [
    "# Ephemeros Restricted Context",
    "",
    `- resourceType: ${request.resourceType}`,
    `- resourceId: ${request.resourceId}`,
    `- purpose: ${request.purpose}`,
    `- expiresAt: ${lambdaPayload.expiresAt ?? "unknown"}`,
    ...metadataLines,
    "",
    "## Retrieved Content",
    "",
    lambdaPayload.content
  ].join("\n");
}

export async function fetchContext({ requestBody, config, invokeLambda }) {
  const request = contextRequestSchema.parse(requestBody);
  const lambdaPayload = lambdaPayloadSchema.parse(await invokeLambda(request));
  const contextId = safeContextId(lambdaPayload.contextId ?? request.requestId);
  const markdown = toMarkdown({ request, lambdaPayload });
  const byteLength = Buffer.byteLength(markdown, "utf8");
  const maxBytes = Math.min(request.maxBytes ?? config.maxContextBytes, config.maxContextBytes);

  if (byteLength > maxBytes) {
    const error = new Error(`Context payload too large: ${byteLength} bytes exceeds ${maxBytes}`);
    error.statusCode = 413;
    throw error;
  }

  const filePath = await writeContextFile({
    contextDir: config.contextDir,
    contextId,
    content: markdown
  });

  return {
    success: true,
    contextId,
    path: filePath,
    bytes: byteLength,
    expiresAt: lambdaPayload.expiresAt,
    content: markdown
  };
}

export async function cleanupContext({ requestBody = {}, config }) {
  const request = cleanupRequestSchema.parse(requestBody);
  const removed = request.contextId
    ? await removeContextFile({ contextDir: config.contextDir, contextId: request.contextId })
    : (await removeAllContextFiles(config.contextDir), true);

  return { success: true, removed };
}
