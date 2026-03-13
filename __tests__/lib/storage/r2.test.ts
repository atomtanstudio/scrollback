import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("R2 client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isR2Configured", () => {
    it("returns false when no env vars are set", async () => {
      delete process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      delete process.env.R2_PUBLIC_URL;

      const { isR2Configured } = await import("@/lib/storage/r2");
      expect(isR2Configured()).toBe(false);
    });

    it("returns false when only some env vars are set", async () => {
      process.env.R2_ACCOUNT_ID = "test-account";
      process.env.R2_ACCESS_KEY_ID = "test-key";
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      delete process.env.R2_PUBLIC_URL;

      const { isR2Configured } = await import("@/lib/storage/r2");
      expect(isR2Configured()).toBe(false);
    });

    it("returns true when all env vars are set", async () => {
      process.env.R2_ACCOUNT_ID = "test-account";
      process.env.R2_ACCESS_KEY_ID = "test-key";
      process.env.R2_SECRET_ACCESS_KEY = "test-secret";
      process.env.R2_BUCKET_NAME = "test-bucket";
      process.env.R2_PUBLIC_URL = "https://media.example.com";

      const { isR2Configured } = await import("@/lib/storage/r2");
      expect(isR2Configured()).toBe(true);
    });
  });

  describe("getPublicUrl", () => {
    it("constructs public URL from key", async () => {
      process.env.R2_PUBLIC_URL = "https://media.example.com";
      const { getPublicUrl } = await import("@/lib/storage/r2");
      expect(getPublicUrl("media/abc/def.jpg")).toBe("https://media.example.com/media/abc/def.jpg");
    });

    it("handles trailing slash in R2_PUBLIC_URL", async () => {
      process.env.R2_PUBLIC_URL = "https://media.example.com/";
      const { getPublicUrl } = await import("@/lib/storage/r2");
      expect(getPublicUrl("media/abc/def.jpg")).toBe("https://media.example.com/media/abc/def.jpg");
    });
  });
});
