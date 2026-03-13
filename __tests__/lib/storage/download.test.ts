import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock r2 module
vi.mock("@/lib/storage/r2", () => ({
  isR2Configured: vi.fn(() => true),
  uploadMedia: vi.fn(async (key: string) => key),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("downloadAndStoreMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads image and uploads to R2, returns public URL", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg", "content-length": "100" }),
      arrayBuffer: async () => imageBuffer.buffer,
    });

    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    const result = await downloadAndStoreMedia("media-123", "item-456", "https://pbs.twimg.com/media/photo.jpg");

    expect(result).toBe("media/item-456/media-123.jpg");
    expect(mockFetch).toHaveBeenCalledWith("https://pbs.twimg.com/media/photo.jpg", expect.any(Object));
  });

  it("returns null on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    const result = await downloadAndStoreMedia("media-123", "item-456", "https://example.com/gone.jpg");

    expect(result).toBeNull();
  });

  it("returns null when file exceeds 50MB", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg", "content-length": String(51 * 1024 * 1024) }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    const result = await downloadAndStoreMedia("media-123", "item-456", "https://example.com/huge.jpg");

    expect(result).toBeNull();
  });

  it("extracts extension from content-type when URL has no extension", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/png", "content-length": "100" }),
      arrayBuffer: async () => imageBuffer.buffer,
    });

    const { uploadMedia } = await import("@/lib/storage/r2");
    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    await downloadAndStoreMedia("media-123", "item-456", "https://example.com/image");

    expect(uploadMedia).toHaveBeenCalledWith(
      "media/item-456/media-123.png",
      expect.any(Buffer),
      "image/png"
    );
  });
});
