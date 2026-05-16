import { describe, expect, it, vi } from "vitest";
import { fetchVpnPage, invokeVpnPageContext } from "../src/vpnPageConnector.js";

describe("VPN page connector", () => {
  it("sanitizes one permitted HTML page without storing raw body metadata", async () => {
    process.env.EPHEMEROS_VPN_ALLOWED_HOST_SUFFIXES = "nus.edu.sg";
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      text: async () =>
        "<html><body><h1>Demo Page</h1><script>secret()</script><p>Email demo@nus.edu.sg phone +65 6123 4567 A1234567B</p></body></html>"
    }));

    const page = await fetchVpnPage({
      url: "https://example.nus.edu.sg/demo",
      fetchImpl
    });

    expect(page.urlHost).toBe("example.nus.edu.sg");
    expect(page.sanitizedText).toContain("Demo Page");
    expect(page.sanitizedText).toContain("[REDACTED_EMAIL]");
    expect(page.sanitizedText).toContain("[REDACTED_PHONE]");
    expect(page.sanitizedText).toContain("[REDACTED_NUS_ID]");
    expect(page.sanitizedText).not.toContain("secret()");
  });

  it("rejects hosts outside configured suffixes", async () => {
    process.env.EPHEMEROS_VPN_ALLOWED_HOST_SUFFIXES = "nus.edu.sg";
    await expect(
      fetchVpnPage({
        url: "https://example.com/demo",
        fetchImpl: vi.fn()
      })
    ).rejects.toThrow("not in EPHEMEROS_VPN_ALLOWED_HOST_SUFFIXES");
  });

  it("returns sanitized context metadata", async () => {
    process.env.EPHEMEROS_VPN_ALLOWED_HOST_SUFFIXES = "nus.edu.sg";
    process.env.EPHEMEROS_VPN_PAGE_URL = "https://example.nus.edu.sg/demo";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/plain"]]),
      text: async () => "Allowed synthetic page text with owner test@nus.edu.sg"
    }));

    try {
      const context = await invokeVpnPageContext({ requestId: "vpn-page-test" });
      expect(context.metadata.connector).toBe("vpn-page");
      expect(context.metadata.remoteContentStored).toBe(false);
      expect(context.content).toContain("[REDACTED_EMAIL]");
      expect(context.content).not.toContain("test@nus.edu.sg");
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.EPHEMEROS_VPN_PAGE_URL;
    }
  });
});
