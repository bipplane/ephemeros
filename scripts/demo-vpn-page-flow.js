import { loadDotEnv } from "../src/envFile.js";

loadDotEnv();

process.env.EPHEMEROS_CONTEXT_SOURCE = "vpn-page";
process.env.EPHEMEROS_DEMO_EVIDENCE_FILE = process.env.EPHEMEROS_DEMO_EVIDENCE_FILE ?? "bob_sessions/demo-vpn-page-context.md";
process.env.EPHEMEROS_DEMO_RESOURCE_TYPE = "docs";
process.env.EPHEMEROS_DEMO_RESOURCE_ID = "vpn/page";
process.env.EPHEMEROS_DEMO_PURPOSE =
  "Sanitized context is needed from one permitted VPN-only page";

if (!process.env.EPHEMEROS_VPN_PAGE_URL || process.env.EPHEMEROS_VPN_PAGE_URL.includes("<")) {
  console.error("EPHEMEROS_VPN_PAGE_URL is required. Use one permitted NUS VPN-only page. Do not use pages with PI/confidential data.");
  process.exit(1);
}

await import("./demo-mcp-flow.js");
