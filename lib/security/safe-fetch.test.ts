import { describe, expect, it, vi } from "vitest";
import { assertSafeHttpUrl } from "@/lib/security/safe-fetch";

const publicLookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }]);

describe("assertSafeHttpUrl", () => {
  it("allows public http and https URLs", async () => {
    await expect(
      assertSafeHttpUrl("https://example.com/image.jpg", { lookup: publicLookup })
    ).resolves.toMatchObject({ hostname: "example.com" });
  });

  it("rejects non-http protocols", async () => {
    await expect(
      assertSafeHttpUrl("file:///etc/passwd", { lookup: publicLookup })
    ).rejects.toThrow(/Only HTTP URLs are allowed/);
  });

  it("rejects loopback hostnames and addresses", async () => {
    await expect(
      assertSafeHttpUrl("http://localhost:3000/admin", { lookup: publicLookup })
    ).rejects.toThrow(/not allowed/);

    await expect(
      assertSafeHttpUrl("http://127.0.0.1:3000/admin", { lookup: publicLookup })
    ).rejects.toThrow(/private or reserved/);
  });

  it("rejects private DNS resolutions", async () => {
    await expect(
      assertSafeHttpUrl("https://example.com/private", {
        lookup: async () => [{ address: "10.0.0.5", family: 4 as const }],
      })
    ).rejects.toThrow(/private or reserved/);
  });
});
