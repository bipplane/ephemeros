import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const targetPort = "18080";
const targetUrl = `http://127.0.0.1:${targetPort}/ephemeros-vpn-health.txt`;
const baseEnv = {
  ...process.env,
  EPHEMEROS_DEMO_TIMEOUT_MS: "30000"
};

let targetServer;

try {
  targetServer = startTargetServer();
  await waitForTarget(targetUrl);

  runStep("MCP context flow", ["scripts/demo-mcp-flow.js"], {
    EPHEMEROS_CONTEXT_SOURCE: "",
    EPHEMEROS_DEMO_EVIDENCE_FILE: "false",
    EPHEMEROS_DEMO_REQUEST_ID: "product-mcp-schema"
  });

  runStep("Filtered context flow", ["scripts/demo-secure-enclave-flow.js"], {
    EPHEMEROS_DEMO_EVIDENCE_FILE: "false",
    EPHEMEROS_DEMO_REQUEST_ID: "product-secure-schema"
  });

  runStep("Reachability flow", ["scripts/demo-tailscale-output-files.js"], {
    EPHEMEROS_VPN_TEST_URL: targetUrl,
    EPHEMEROS_ALLOW_LOCAL_TARGET_FALLBACK: "false",
    EPHEMEROS_DEMO_OUTPUT_PREFIX: "demo-product"
  });

  await assertContextDirectoryClean();

  console.log("");
  console.log("Product smoke test passed");
  console.log("=========================");
  console.log("Covered: fetch_context, cleanup_context, filtering, HTTP reachability, local context output.");
} finally {
  if (targetServer) {
    targetServer.kill();
  }
}

function startTargetServer() {
  return spawn(process.execPath, ["scripts/serve-vpn-target.js"], {
    cwd: process.cwd(),
    env: {
      ...baseEnv,
      EPHEMEROS_VPN_BIND_HOST: "127.0.0.1",
      EPHEMEROS_VPN_TARGET_PORT: targetPort
    },
    stdio: "ignore",
    windowsHide: true
  });
}

async function waitForTarget(url) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      const body = await response.text();
      if (response.ok && body.includes("Ephemeros VPN reachability proof")) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(`Target did not become reachable: ${url}`);
}

function runStep(label, args, envOverrides) {
  console.log("");
  console.log(label);
  console.log("-".repeat(label.length));

  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: {
      ...baseEnv,
      ...envOverrides
    },
    encoding: "utf8",
    timeout: 60000
  });

  if (result.stdout) {
    console.log(result.stdout.trim());
  }
  if (result.stderr) {
    console.error(result.stderr.trim());
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

async function assertContextDirectoryClean() {
  const contextDir = path.resolve(".bob_restricted_context");
  try {
    const entries = await fs.readdir(contextDir);
    if (entries.length > 0) {
      throw new Error(`Context directory still contains files: ${entries.join(", ")}`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}
