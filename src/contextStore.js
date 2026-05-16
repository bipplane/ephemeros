import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SAFE_ID = /^[A-Za-z0-9._-]+$/;

export function safeContextId(input) {
  const raw = input ?? crypto.randomUUID();
  const normalized = raw.replaceAll(":", "_");
  if (!SAFE_ID.test(normalized)) {
    throw new Error("Invalid context id");
  }
  return normalized;
}

export function contextPath(contextDir, contextId) {
  const filePath = path.resolve(contextDir, `${safeContextId(contextId)}.md`);
  const root = path.resolve(contextDir);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Context path escaped context directory");
  }
  return filePath;
}

export async function writeContextFile({ contextDir, contextId, content }) {
  await fs.mkdir(contextDir, { recursive: true, mode: 0o700 });
  const filePath = contextPath(contextDir, contextId);
  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempPath, content, { encoding: "utf8", mode: 0o600 });
  await fs.rename(tempPath, filePath);
  return filePath;
}

export async function removeContextFile({ contextDir, contextId }) {
  const filePath = contextPath(contextDir, contextId);
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function removeAllContextFiles(contextDir) {
  await fs.rm(contextDir, { recursive: true, force: true });
}
