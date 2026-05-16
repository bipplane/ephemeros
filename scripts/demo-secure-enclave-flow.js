process.env.EPHEMEROS_CONTEXT_SOURCE = "secure-enclave";
process.env.EPHEMEROS_FILTER_PROVIDER = process.env.EPHEMEROS_FILTER_PROVIDER ?? "local";
process.env.EPHEMEROS_DEMO_EVIDENCE_FILE = process.env.EPHEMEROS_DEMO_EVIDENCE_FILE ?? "bob_sessions/demo-secure-context.md";

await import("./demo-mcp-flow.js");
