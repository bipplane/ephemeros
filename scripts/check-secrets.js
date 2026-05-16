import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set(["node_modules", ".git", ".bob_restricted_context"]);
const ignoredFiles = new Set(["package-lock.json", ".env"]);
const findings = [];
const patterns = [
  { name: "AWS access key id", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "AWS secret assignment", regex: /\bAWS_SECRET_ACCESS_KEY\s*=\s*['"]?[A-Za-z0-9/+=]{20,}/gi },
  { name: "IBM or Bob API key assignment", regex: /\b(IBM|BOB|WATSONX)[A-Z0-9_]*API[_-]?KEY\s*=\s*['"]?[A-Za-z0-9._-]{16,}/gi },
  { name: "generic private key block", regex: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
  { name: "bearer token literal", regex: /\bBearer\s+[A-Za-z0-9._~+/-]{24,}/g }
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(root, fullPath);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walk(fullPath);
      }
      continue;
    }
    if (ignoredFiles.has(entry.name)) {
      continue;
    }
    await scanFile(fullPath, relative);
  }
}

async function scanFile(fullPath, relative) {
  let text;
  try {
    text = await fs.readFile(fullPath, "utf8");
  } catch {
    return;
  }

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      findings.push(`${relative}: possible ${pattern.name}: ${match[0].slice(0, 48)}`);
    }
  }
}

await walk(root);

if (findings.length > 0) {
  console.error("Potential secrets found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exitCode = 1;
} else {
  console.log("No obvious credentials or API keys found.");
}
