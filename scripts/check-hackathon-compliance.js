import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set(["node_modules", ".git", ".bob_restricted_context"]);
const disallowed = [
  "llama-3-405b-instruct",
  "mistral-medium-2505",
  "mistral-medium-2502",
  "mistral-small-3-1-24b-instruct-2503",
  "Agent Lab",
  "Bring your own model",
  "Fine tuning",
  "AutoAI pipeline",
  "Evaluation Studio",
  "SPSS Modeler",
  "Build with AI (Preview)"
];
const findings = [];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walk(fullPath);
      }
      continue;
    }
    await scanFile(fullPath);
  }
}

async function scanFile(fullPath) {
  if (path.basename(fullPath) === "check-hackathon-compliance.js") {
    return;
  }
  let text;
  try {
    text = await fs.readFile(fullPath, "utf8");
  } catch {
    return;
  }
  const relative = path.relative(root, fullPath);
  for (const term of disallowed) {
    if (text.includes(term)) {
      findings.push(`${relative}: disallowed or out-of-scope term "${term}"`);
    }
  }
}

await walk(root);

if (findings.length > 0) {
  console.error("Hackathon compliance findings:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exitCode = 1;
} else {
  console.log("No disallowed hackathon technologies or models referenced.");
}
