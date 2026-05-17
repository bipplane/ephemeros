# Ephemeros
<p align="center">
<img
   src="https://github.com/user-attachments/assets/02fb75b5-149f-413e-8946-a8b24ce8d891"
   height = "100"
   object-position: 50% 50%;
   alt="Emphemeros">
</p>

<p align="center"> 
  <img src="https://img.shields.io/badge/status-proof--of--concept-yellow?style=for-the-badge" alt="Proof of Concept"> 
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="MIT License"> 
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 18+"> 
  <img src="https://img.shields.io/badge/Tailscale-Compatible-5C9EAD?style=for-the-badge&logo=tailscale&logoColor=white" alt="Tailscale Compatible"> 
  <img src="https://img.shields.io/badge/IBM%20Bob-Integrated-052FAD?style=for-the-badge" alt="IBM Bob Integrated"> 
</p>

Ephemeros is a proof-of-concept for an **Ephemeral Context Bridge** for IBM Bob (hence it's name).

Many companies these days host private systems behind a corporate firewall, and they want to use AI tools like Claude, Gemini, and perhaps even IBM Bob to analyze such data. But they don't want to expose the entire network, and they also don't want to store raw private data in logs or caches.

This idea aims to fulfill a small but crucial requirment: **AI tools such as Bob should be able to ask for one piece of restricted context, use it, and then lose access to it.** No permanent VPN tunnel. No broad indexing of private systems. No raw private page body stored in logs. 

Note: The restricted system in this repository is a basic one, and has been simulated with synthetic data, due to the short timeframe of this hackathon.

## What It Shows

- IBM Bob can use MCP tools to request missing enterprise context.
- Ephemeros writes only the filtered context Bob needs.
- The temporary context file is removed after use.
- A Tailscale/local HTTP target proves the network reachability part without using real private data.
- watsonx.ai filtering is optional; the main demo works offline with a deterministic local filter.

## Why This Is Different

Although MCP database connectors and internal-tool connectors already exist, and IBM Bob can already use MCP when configured properly, the gap that Ephemeros focuses on is narrower and special:

> How do we let Bob use private enterprise context without giving it broad, persistent access to private systems?

Here, Ephemeros treats context access as a short-lived security workflow:

- **Scoped request**: Bob asks for a specific resource such as `quant/rates/bond_yields`.
- **Purpose-bound access**: each request carries a reason.
- **Filtered output**: only the relevant schema/context is written locally.
- **Temporary file**: context lands in `.bob_restricted_context/`, not in the repo.
- **Cleanup step**: Bob calls `cleanup_context` after use.
- **Audit-ready metadata**: output includes resource ID, byte count, expiry, and source metadata.

That is the **moat**: Ephemeros is less about “connect AI to a database” and more about making private context access acceptable for security-conscious teams.

## Competitive Angle

Many hackathon projects will show Bob generating code, tests, docs, or a simple UI. Those are useful, but common. Ephemeros aims at a harder enterprise blocker: Bob cannot write accurate code against systems it cannot see.

Compared with generic MCP database tools, Ephemeros is more restrictive on purpose. It is built around temporary context, explicit cleanup, and narrow resource IDs instead of open-ended querying.

## Main Demo

Use this path for judges:

```powershell
npm.cmd install
npm.cmd test
npm.cmd run lint
npm.cmd run demo:mcp
npm.cmd run demo:secure
```

For the Tailscale reachability proof, first serve the synthetic target file:

```powershell
npm.cmd run serve:vpn-target
```

Then, in another terminal:

```powershell
npm.cmd run demo:tailscale-files
```

This writes clear proof files under `bob_sessions/`:

- `demo-tailscale-target-output.txt`: the HTTP target body.
- `demo-tailscale-bridge-output.txt`: the Bob-facing bridge flow.
- `demo-tailscale-combined-output.txt`: both parts in one report.
- `demo-tailscale-context.md`: safe context written for Bob before cleanup.

Open the target in Chrome:

[http://100.82.136.35:8080/ephemeros-vpn-health.txt](http://100.82.136.35:8080/ephemeros-vpn-health.txt)

Local fallback:

[http://127.0.0.1:8080/ephemeros-vpn-health.txt](http://127.0.0.1:8080/ephemeros-vpn-health.txt)

Expected target body:

```text
Ephemeros VPN reachability proof, 
blablabla tung tung tung sahur.
67.
Remote body is not stored or sent to Bob by the VPN connector.
```

## How Bob Fits

Bob is the operator, not a side feature.

1. Developer asks Bob to write code that needs internal schema.
2. Bob calls the Ephemeros MCP tool `fetch_context`.
3. Ephemeros checks the requested resource and writes a small markdown file under `.bob_restricted_context/`.
4. Bob reads that file and generates code with the correct table and column names.
5. Bob calls `cleanup_context`.
6. The temporary context file is removed.

The local script `npm.cmd run demo:mcp` also runs the same flow without spending Bob credits.

## Architecture

```mermaid
flowchart LR
  Dev["Developer in IBM Bob"] --> Bob["IBM Bob IDE"]
  Bob -->|"MCP: fetch_context"| Bridge["Ephemeros local bridge"]
  Bridge --> Filter["Allowlist/filter"]
  Filter --> Context[".bob_restricted_context/*.md"]
  Bob --> Context
  Bob -->|"MCP: cleanup_context"| Bridge

  Target["Synthetic HTTP target"] --> Bridge
  Enclave["Mock secure enclave file"] --> Filter
  Lambda["AWS Lambda skeleton"] -. "future private-network connector" .-> Bridge
```

## Implemented

- MCP server with `fetch_context` and `cleanup_context`.
- Express fallback API with `/health`, `/fetch-context`, and `/cleanup`.
- Zod request validation.
- Safe context file writing with path-safe context IDs.
- Payload byte caps.
- Synthetic restricted dataset.
- Local deterministic filter.
- Optional watsonx.ai filter using Granite.
- AWS Lambda skeleton for a future private-network connector.
- Tailscale/local target demo.
- Vitest tests, ESLint, dependency check, secret scan, and compliance scan.

## Important Files

```text
src/mcpServer.js                 Bob MCP integration
src/server.js                    Express fallback API
src/bridgeService.js             Shared fetch/write/cleanup flow
src/mockRestrictedContext.js     Synthetic connector dispatcher
scripts/demo-mcp-flow.js         Local Bob-like MCP demo
scripts/demo-tailscale-output-files.js
                                  Tailscale/local proof output generator
vpn-target/ephemeros-vpn-health.txt
                                  Synthetic target body
data/synthetic-restricted-context.json
                                  Bring-your-own synthetic schema
mock-secure-enclave/proprietary_data.txt
                                  Synthetic secure-enclave export
bob_sessions/                    Bob session reports and safe demo output
```

## Optional watsonx.ai Demo

Only use this if credentials are available:

```powershell
Copy-Item .env.example .env
# Fill IBM_API_KEY and WATSONX_PROJECT_ID in .env
npm.cmd run demo:watsonx
```

The local guard still checks the model output before Bob sees it.

## NUS VPN Note

NUS FortiClient support was tried, but SSO and internal page access were too brittle for a clean recorded demo T_T. rest in peace my granny she got hit by a bazooka

## Verification

Current verification target:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run demo:mcp
npm.cmd run demo:secure
npm.cmd run demo:tailscale-files
npm.cmd run check:deps
npm.cmd run check:secrets
npm.cmd run check:compliance
npm.cmd audit --audit-level moderate
```
