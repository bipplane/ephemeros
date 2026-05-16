import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

let tempDir;

function appWithMock(mock, overrides = {}) {
  return createApp({
    config: {
      contextDir: tempDir,
      maxContextBytes: 262144,
      requireAuth: false,
      ...overrides
    },
    invokeLambda: mock
  });
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ephemeros-test-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("Ephemeros bridge", () => {
  it("fetches context, writes markdown file, and returns Bob-readable path", async () => {
    const invokeLambda = vi.fn(async () => ({
      contextId: "ctx-demo",
      content: "table trades(id int, cusip text, yield decimal)",
      expiresAt: "2026-05-13T15:30:00.000Z",
      metadata: { source: "mock-rds" }
    }));

    const response = await request(appWithMock(invokeLambda))
      .post("/fetch-context")
      .send({
        requestId: "bob-001",
        resourceType: "schema",
        resourceId: "quant/rates/bond_yields",
        purpose: "Generate query code for historical bond yields"
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.contextId).toBe("ctx-demo");
    const file = await fs.readFile(response.body.path, "utf8");
    expect(file).toContain("# Ephemeros Restricted Context");
    expect(file).toContain("table trades");
    expect(invokeLambda).toHaveBeenCalledOnce();
  });

  it("rejects invalid resource identifiers before invoking Lambda", async () => {
    const invokeLambda = vi.fn();

    await request(appWithMock(invokeLambda))
      .post("/fetch-context")
      .send({
        resourceType: "schema",
        resourceId: "../../secrets",
        purpose: "Attempt path traversal against context fetch"
      })
      .expect(400);

    expect(invokeLambda).not.toHaveBeenCalled();
  });

  it("requires bearer auth when configured", async () => {
    const invokeLambda = vi.fn();
    const app = appWithMock(invokeLambda, { requireAuth: true, authToken: "local-token" });

    await request(app)
      .post("/fetch-context")
      .send({
        resourceType: "schema",
        resourceId: "quant/rates/bond_yields",
        purpose: "Generate query code for historical bond yields"
      })
      .expect(401);
  });

  it("cleans specific context file", async () => {
    const invokeLambda = vi.fn(async () => ({
      contextId: "ctx-clean",
      content: "temporary schema"
    }));
    const app = appWithMock(invokeLambda);

    const created = await request(app)
      .post("/fetch-context")
      .send({
        resourceType: "schema",
        resourceId: "quant/rates/bond_yields",
        purpose: "Generate query code for historical bond yields"
      });

    await request(app).post("/cleanup").send({ contextId: "ctx-clean" }).expect(200);
    await expect(fs.access(created.body.path)).rejects.toThrow();
  });
});
