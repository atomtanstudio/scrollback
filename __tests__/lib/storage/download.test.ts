import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

const mockSafeFetch = vi.fn();

vi.mock("@/lib/security/safe-fetch", () => ({
  safeFetch: (...args: unknown[]) => mockSafeFetch(...args),
}));

// Mock r2 module
vi.mock("@/lib/storage/r2", () => ({
  isR2Configured: vi.fn(() => true),
  uploadMedia: vi.fn(async (key: string) => key),
  uploadMediaStream: vi.fn(async (key: string) => key),
}));

describe("downloadAndStoreMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads image and uploads to R2, returns public URL", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg", "content-length": "100" }),
      arrayBuffer: async () => imageBuffer.buffer,
    });

    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    const result = await downloadAndStoreMedia("media-123", "item-456", "https://pbs.twimg.com/media/photo.jpg");

    expect(result).toBe("media/item-456/media-123.jpg");
    expect(mockSafeFetch).toHaveBeenCalledWith("https://pbs.twimg.com/media/photo.jpg", expect.any(Object));
  });

  it("returns null on fetch failure", async () => {
    mockSafeFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    const result = await downloadAndStoreMedia("media-123", "item-456", "https://example.com/gone.jpg");

    expect(result).toBeNull();
  });

  it("returns null when file exceeds the maximum media size", async () => {
    mockSafeFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg", "content-length": String(1024 * 1024 * 1024 + 1) }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    const result = await downloadAndStoreMedia("media-123", "item-456", "https://example.com/huge.jpg");

    expect(result).toBeNull();
  });

  it("enforces a byte limit for streams without trusting content-length", async () => {
    const { limitReadableStreamBytes } = await import("@/lib/storage/download");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
        controller.enqueue(new Uint8Array(4));
        controller.close();
      },
    });
    const reader = limitReadableStreamBytes(stream, 6).getReader();

    await expect(reader.read()).resolves.toMatchObject({ done: false });
    await expect(reader.read()).rejects.toThrow(/exceeds maximum size/);
  });

  it("extracts extension from content-type when URL has no extension", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    mockSafeFetch.mockResolvedValueOnce({
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
