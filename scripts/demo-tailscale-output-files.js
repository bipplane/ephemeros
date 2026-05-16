import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { loadDotEnv } from "../src/envFile.js";

loadDotEnv();

const outputDir = path.resolve("bob_sessions");
const configuredTargetUrl = process.env.EPHEMEROS_VPN_TEST_URL ?? "http://100.82.136.35:8080/ephemeros-vpn-health.txt";
const localFallbackUrl = process.env.EPHEMEROS_LOCAL_TARGET_URL ?? "http://127.0.0.1:8080/ephemeros-vpn-health.txt";
const allowLocalFallback = process.env.EPHEMEROS_ALLOW_LOCAL_TARGET_FALLBACK !== "false";
const outputPrefix = process.env.EPHEMEROS_DEMO_OUTPUT_PREFIX ?? "demo-tailscale";
const targetOutputPath = path.join(outputDir, `${outputPrefix}-target-output.txt`);
const bridgeOutputPath = path.join(outputDir, `${outputPrefix}-bridge-output.txt`);
const combinedOutputPath = path.join(outputDir, `${outputPrefix}-combined-output.txt`);

await fs.mkdir(outputDir, { recursive: true });

const targetReport = await checkTargetWithFallback(configuredTargetUrl);
const targetOutput = formatTargetReport(targetReport);
await fs.writeFile(targetOutputPath, targetOutput, "utf8");

const bridgeResult = spawnSync(process.execPath, ["scripts/demo-vpn-check-flow.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    EPHEMEROS_VPN_TEST_URL: targetReport.url,
    EPHEMEROS_DEMO_EVIDENCE_FILE: `bob_sessions/${outputPrefix}-context.md`
  },
  encoding: "utf8"
});

const bridgeOutput = formatBridgeReport(bridgeResult);
await fs.writeFile(bridgeOutputPath, bridgeOutput, "utf8");
await fs.writeFile(combinedOutputPath, formatCombinedReport({ targetOutput, bridgeOutput }), "utf8");

console.log("Tailscale Demo Output Files");
console.log("===========================");
console.log(`Target URL: ${targetReport.url}`);
if (targetReport.fallbackFrom) {
  console.log(`Fallback from: ${targetReport.fallbackFrom}`);
}
console.log(`Target output: ${targetOutputPath}`);
console.log(`Bridge output: ${bridgeOutputPath}`);
console.log(`Combined output: ${combinedOutputPath}`);
console.log(`Target status: ${targetReport.ok ? "success" : "failed"}`);
console.log(`Bridge status: ${bridgeResult.status === 0 ? "success" : "failed"}`);

if (!targetReport.ok || bridgeResult.status !== 0) {
  process.exit(1);
}

async function checkTargetWithFallback(url) {
  const primaryReport = await checkTarget(url);
  if (primaryReport.ok || !allowLocalFallback || url === localFallbackUrl) {
    return primaryReport;
  }

  const fallbackReport = await checkTarget(localFallbackUrl);
  return {
    ...fallbackReport,
    fallbackFrom: url,
    fallbackReason: primaryReport.error ?? `${primaryReport.status} ${primaryReport.statusText ?? ""}`.trim()
  };
}

async function checkTarget(url) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(Number.parseInt(process.env.EPHEMEROS_VPN_TIMEOUT_MS ?? "10000", 10))
    });
    const body = await response.text();
    return {
      ok: response.ok,
      checkedAt,
      url,
      host: new URL(url).host,
      status: response.status,
      statusText: response.statusText,
      bytes: Buffer.byteLength(body, "utf8"),
      body
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt,
      url,
      host: safeHost(url),
      error: error.message
    };
  }
}

function formatTargetReport(report) {
  const lines = [
    "Ephemeros Target Check",
    "======================",
    "Role: target = VPN-only HTTP file that proves network reachability.",
    `Status: ${report.ok ? "success" : "failed"}`,
    `Checked at: ${report.checkedAt}`,
    `URL: ${report.url}`,
    `Host: ${report.host}`
  ];

  if (report.fallbackFrom) {
    lines.push(`Fallback from: ${report.fallbackFrom}`, `Fallback reason: ${report.fallbackReason}`);
  }

  if (report.ok) {
    lines.push(`HTTP status: ${report.status} ${report.statusText}`, `Bytes received: ${report.bytes}`, "", "Body:", report.body.trim());
  } else {
    lines.push(`Error: ${report.error}`);
  }

  return `${lines.join("\n")}\n`;
}

function formatBridgeReport(result) {
  return [
    "Ephemeros Bridge Check",
    "======================",
    "Role: bridge = Bob-facing MCP flow. It checks target reachability, then writes safe local context for Bob.",
    `Status: ${result.status === 0 ? "success" : "failed"}`,
    `Exit code: ${result.status ?? "unknown"}`,
    "",
    "Command output:",
    `${result.stdout}${result.stderr}`.trim(),
    ""
  ].join("\n");
}

function formatCombinedReport({ targetOutput, bridgeOutput }) {
  return [
    "Ephemeros VPN Demo Combined Report",
    "==================================",
    "Flow: Chrome/Bob reaches target URL -> bridge verifies reachability -> Bob receives sanitized local context -> cleanup removes temp file.",
    "",
    targetOutput.trim(),
    "",
    bridgeOutput.trim(),
    ""
  ].join("\n");
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}
