import { describe, expect, it, vi } from "vitest";
import { checkVpnReachability, invokeVpnCheckContext, loadVpnSyntheticContext } from "../src/vpnConnector.js";

describe("VPN reachability connector", () => {
  it("records reachability metadata", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      statusText: "OK",
      redirected: false
    }));

    const result = await checkVpnReachability({
      url: "https://vpn.example.test/internal/status",
      fetchImpl
    });

    expect(result).toMatchObject({
      urlHost: "vpn.example.test",
      reachable: true,
      status: 200
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://vpn.example.test/internal/status",
      expect.objectContaining({ method: "GET", redirect: "manual" })
    );
  });

  it("throws a clear unreachable error without remote body", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network unreachable");
    });

    await expect(
      checkVpnReachability({
        url: "https://vpn.example.test/internal/status",
        fetchImpl
      })
    ).rejects.toThrow("VPN target unreachable");
  });

  it("uses local schema after reachability succeeds", async () => {
    process.env.EPHEMEROS_VPN_TEST_URL = "https://example.com/status";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      status: 204,
      statusText: "No Content",
      redirected: false
    }));

    try {
      const result = await invokeVpnCheckContext({
        requestId: "vpn-test",
        resourceType: "schema",
        resourceId: "quant/rates/bond_yields"
      });

      expect(result.metadata.remoteContentStored).toBe(false);
      expect(result.metadata.remoteContentSentToBob).toBe(false);
      expect(result.content).toContain("internal_quant.bond_yields");
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.EPHEMEROS_VPN_TEST_URL;
    }
  });

  it("loads bundled VPN synthetic schema", async () => {
    await expect(loadVpnSyntheticContext()).resolves.toContain("internal_quant.bond_yields");
  });
});
