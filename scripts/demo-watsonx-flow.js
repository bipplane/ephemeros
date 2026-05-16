import { loadDotEnv } from "../src/envFile.js";

loadDotEnv();

process.env.EPHEMEROS_CONTEXT_SOURCE = "secure-enclave";
process.env.EPHEMEROS_FILTER_PROVIDER = "watsonx";
process.env.EPHEMEROS_DEMO_EVIDENCE_FILE = process.env.EPHEMEROS_DEMO_EVIDENCE_FILE ?? "bob_sessions/demo-watsonx-context.md";

if (!process.env.IBM_API_KEY || !process.env.WATSONX_PROJECT_ID) {
  console.error("IBM_API_KEY and WATSONX_PROJECT_ID are required for live watsonx.ai filtering.");
  process.exit(1);
}

await import("./demo-mcp-flow.js");
