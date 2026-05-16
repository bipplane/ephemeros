import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { filterSecureEnclaveContext, filterWithWatsonx, localSchemaFilter } from "../src/watsonxFilter.js";

describe("secure enclave filtering", () => {
  it("extracts only bond yield schema with local deterministic filter", async () => {
    const text = await fs.readFile(path.resolve("mock-secure-enclave/proprietary_data.txt"), "utf8");
    const filtered = localSchemaFilter(text, "quant/rates/bond_yields");

    expect(filtered).toContain("internal_quant.bond_yields");
    expect(filtered).toContain("trade_date DATE NOT NULL");
    expect(filtered).not.toContain("synthetic_employee_directory");
    expect(filtered).not.toContain("synthetic_email");
  });

  it("uses watsonx.ai token and generation endpoints when configured", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "test-access-token" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ generated_text: "```sql\nCREATE TABLE internal_quant.bond_yields (...);\n```" }]
        })
      });

    const output = await filterWithWatsonx({
      text: "raw secure enclave text",
      resourceId: "quant/rates/bond_yields",
      apiKey: "test-api-key",
      projectId: "test-project-id",
      fetchImpl
    });

    expect(output).toContain("internal_quant.bond_yields");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://iam.cloud.ibm.com/identity/token");
    expect(fetchImpl.mock.calls[1][0]).toContain("https://us-south.ml.cloud.ibm.com/ml/v1/text/generation");
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({
      model_id: "ibm/granite-3-8b-instruct",
      project_id: "test-project-id"
    });
  });

  it("defaults to local filtering without credentials", async () => {
    const text = await fs.readFile(path.resolve("mock-secure-enclave/proprietary_data.txt"), "utf8");
    const output = await filterSecureEnclaveContext({
      text,
      resourceId: "quant/rates/bond_yields",
      env: {}
    });

    expect(output).toContain("internal_quant.bond_yields");
    expect(output).not.toContain("synthetic_employee_directory");
  });
});
