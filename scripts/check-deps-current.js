const packages = [
  "express",
  "@aws-sdk/client-lambda",
  "@modelcontextprotocol/sdk",
  "zod",
  "vitest",
  "supertest",
  "eslint",
  "globals"
];

const packageJson = JSON.parse(await fsRead("package.json"));
const declared = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

async function fsRead(file) {
  const { readFile } = await import("node:fs/promises");
  return readFile(file, "utf8");
}

async function latestVersion(name) {
  const encoded = encodeURIComponent(name);
  const response = await fetch(`https://registry.npmjs.org/${encoded}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch npm metadata for ${name}: ${response.status}`);
  }
  const metadata = await response.json();
  return metadata["dist-tags"].latest;
}

let failed = false;

for (const name of packages) {
  const latest = await latestVersion(name);
  const current = declared[name];
  if (current !== latest) {
    failed = true;
    console.error(`${name} is ${current}, latest is ${latest}`);
  } else {
    console.log(`${name} ${current} current`);
  }
}

if (failed) {
  process.exitCode = 1;
}
