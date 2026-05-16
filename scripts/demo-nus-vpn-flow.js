import { loadDotEnv } from "../src/envFile.js";

loadDotEnv();

const gateway = process.env.EPHEMEROS_NUS_VPN_GATEWAY ?? "https://webvpn.comp.nus.edu.sg:443";
const internalTarget = process.env.EPHEMEROS_NUS_VPN_TEST_URL;

async function checkGateway() {
  try {
    const response = await fetch(gateway, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(Number.parseInt(process.env.EPHEMEROS_VPN_TIMEOUT_MS ?? "10000", 10))
    });
    return {
      reachable: true,
      host: new URL(gateway).host,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return {
      reachable: false,
      host: safeHost(gateway),
      error: error.message
    };
  }
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

const gatewayResult = await checkGateway();
console.log("NUS FortiClient VPN Preflight");
console.log("============================");
console.log(`Gateway: ${gatewayResult.host}`);
console.log(`Gateway reachable: ${gatewayResult.reachable}`);
if (gatewayResult.reachable) {
  console.log(`Gateway HTTP status: ${gatewayResult.status} ${gatewayResult.statusText}`);
} else {
  console.log(`Gateway error: ${gatewayResult.error}`);
}
console.log("");
console.log("Note: gateway reachability only proves the SSO/VPN portal is reachable.");
console.log("VPN proof requires a permitted internal URL reachable only after FortiClient SSO login.");

if (!internalTarget || internalTarget.includes("<")) {
  console.log("");
  console.log("Missing EPHEMEROS_NUS_VPN_TEST_URL.");
  console.log("Set it to a permitted NUS VPN-internal URL. Remote content will not be stored or sent to Bob.");
  process.exitCode = gatewayResult.reachable ? 0 : 1;
} else {
  process.env.EPHEMEROS_CONTEXT_SOURCE = "vpn-check";
  process.env.EPHEMEROS_VPN_TEST_URL = internalTarget;
  process.env.EPHEMEROS_DEMO_EVIDENCE_FILE = process.env.EPHEMEROS_DEMO_EVIDENCE_FILE ?? "bob_sessions/demo-nus-vpn-context.md";

  await import("./demo-mcp-flow.js");
}
