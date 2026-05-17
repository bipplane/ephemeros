import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEphemerosMcpServer } from "../src/mcpServer.js";
import { invokeMockRestrictedContext } from "../src/mockRestrictedContext.js";

let tempDir;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ephemeros-mcp-test-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("Ephemeros MCP server", () => {
  it("fetches and removes context through MCP", async () => {
    const server = createEphemerosMcpServer({
      config: {
        contextDir: tempDir,
        maxContextBytes: 262144
      },
      invokeLambda: invokeMockRestrictedContext
    });
    const client = new Client({ name: "test-client", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(["fetch_context", "cleanup_context"]));

      const fetchResult = await client.callTool({
        name: "fetch_context",
        arguments: {
          requestId: "mcp-test-bond-yields",
          resourceType: "schema",
          resourceId: "quant/rates/bond_yields",
          purpose: "Schema context is needed to write historical bond-yield query code"
        }
      });
      const metadata = JSON.parse(fetchResult.content[0].text);
      expect(metadata.success).toBe(true);
      await expect(fs.readFile(metadata.path, "utf8")).resolves.toContain("internal_quant.bond_yields");

      const cleanupResult = await client.callTool({
        name: "cleanup_context",
        arguments: { contextId: metadata.contextId }
      });
      expect(JSON.parse(cleanupResult.content[0].text).removed).toBe(true);
      await expect(fs.access(metadata.path)).rejects.toThrow();
    } finally {
      await client.close();
      await server.close();
    }
  });
});
