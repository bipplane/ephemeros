import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/app.js";
import { invokeMockRestrictedContext } from "../src/mockRestrictedContext.js";

const contextDir = path.resolve(".bob_restricted_context");
const app = createApp({
  config: {
    contextDir,
    maxContextBytes: 262144,
    requireAuth: false
  },
  invokeLambda: invokeMockRestrictedContext
});

const fetchResponse = await request(app)
  .post("/fetch-context")
  .send({
    requestId: "bob-demo-bond-yields",
    resourceType: "schema",
    resourceId: "quant/rates/bond_yields",
    purpose: "IBM Bob needs schema context to write Python query code for historical bond yields"
  });

if (fetchResponse.status !== 200) {
  console.error(fetchResponse.body);
  process.exitCode = 1;
} else {
  const context = await fs.readFile(fetchResponse.body.path, "utf8");
  console.log("IBM Bob prompt:");
  console.log("Write a Python script to query historical bond yields using context file below.");
  console.log("");
  console.log(`Context path: ${fetchResponse.body.path}`);
  console.log("");
  console.log(context);

  const cleanupResponse = await request(app)
    .post("/cleanup")
    .send({ contextId: fetchResponse.body.contextId });

  console.log("");
  console.log(`Cleanup success: ${cleanupResponse.body.success}`);
}
