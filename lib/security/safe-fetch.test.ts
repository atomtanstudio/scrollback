import { describe, expect, it, vi } from "vitest";
import { assertSafeHttpUrl, safeFetch } from "@/lib/security/safe-fetch";

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

describe("safeFetch", () => {
  it("uses the validated DNS result for the outbound request", async () => {
    const request = vi.fn(async (safeUrl) => {
      expect(safeUrl.url.href).toBe("https://example.com/feed.xml");
      expect(safeUrl.addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
      return new Response("ok", { status: 200 });
    });

    const response = await safeFetch("https://example.com/feed.xml", {}, {
      lookup: async () => [{ address: "93.184.216.34", family: 4 as const }],
      request,
    });

    await expect(response.text()).resolves.toBe("ok");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("revalidates redirects before following them", async () => {
    const request = vi.fn(async () => (
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1:3000/admin" },
      })
    ));

    await expect(
      safeFetch("https://example.com/feed.xml", {}, {
        lookup: async () => [{ address: "93.184.216.34", family: 4 as const }],
        request,
      })
    ).rejects.toThrow(/private or reserved/);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
