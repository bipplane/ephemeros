import { loadDotEnv } from "../src/envFile.js";

loadDotEnv();

process.env.EPHEMEROS_CONTEXT_SOURCE = "vpn-check";
process.env.EPHEMEROS_DEMO_EVIDENCE_FILE = process.env.EPHEMEROS_DEMO_EVIDENCE_FILE ?? "bob_sessions/demo-vpn-context.md";

if (!process.env.EPHEMEROS_VPN_TEST_URL) {
  console.error("EPHEMEROS_VPN_TEST_URL is required. Use a permitted VPN-only URL. Remote content will not be stored.");
  process.exit(1);
}

await import("./demo-mcp-flow.js");
