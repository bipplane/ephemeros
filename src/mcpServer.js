import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { cleanupContext, fetchContext } from "./bridgeService.js";
import { loadConfig } from "./config.js";
import { loadDotEnv } from "./envFile.js";
import { createAwsLambdaInvoker } from "./lambdaClient.js";
import { invokeMockRestrictedContext } from "./mockRestrictedContext.js";

export function createEphemerosMcpServer({ config, invokeLambda }) {
  const server = new McpServer({
    name: "ephemeros",
    version: "0.1.0"
  });

  server.registerTool(
    "fetch_context",
    {
      title: "Fetch restricted enterprise context",
      description:
        "Fetch narrow schema, documentation, or code context from simulated or private enterprise systems and write it to a temporary Bob-readable local file.",
      inputSchema: {
        requestId: z.string().regex(/^[A-Za-z0-9._-]{3,80}$/).optional(),
        resourceType: z.enum(["schema", "docs", "code"]),
        resourceId: z.string().min(3).max(200),
        purpose: z.string().min(10).max(500),
        maxBytes: z.number().int().positive().max(262144).optional()
      }
    },
    async (request) => {
      const result = await fetchContext({ requestBody: request, config, invokeLambda });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: result.success,
                contextId: result.contextId,
                path: result.path,
                bytes: result.bytes,
                expiresAt: result.expiresAt,
                note: "Read returned path for local context. Call cleanup_context when done."
              },
              null,
              2
            )
          },
          {
            type: "text",
            text: result.content
          }
        ]
      };
    }
  );

  server.registerTool(
    "cleanup_context",
    {
      title: "Clean up restricted context",
      description: "Delete one Ephemeros context file by contextId, or delete all context files when contextId is omitted.",
      inputSchema: {
        contextId: z.string().regex(/^[A-Za-z0-9._-]{3,120}$/).optional()
      }
    },
    async (request) => {
      const result = await cleanupContext({ requestBody: request, config });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );

  return server;
}

export async function runMcpServer() {
  loadDotEnv();
  const config = loadConfig();
  const invokeLambda =
    process.env.EPHEMEROS_MCP_MOCK === "true"
      ? invokeMockRestrictedContext
      : createAwsLambdaInvoker({
          region: config.awsRegion,
          functionName: config.lambdaFunctionName
        });
  const server = createEphemerosMcpServer({ config, invokeLambda });
  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMcpServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
