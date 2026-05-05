import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetConfig = vi.fn();
const mockIsConfigured = vi.fn();
const mockUserCount = vi.fn();
const mockAuth = vi.fn();
const originalToken = process.env.SCROLLBACK_SETUP_TOKEN;
const originalLegacyToken = process.env.SETUP_TOKEN;

vi.mock("@/lib/config", () => ({
  getConfig: () => mockGetConfig(),
  isConfigured: (...args: unknown[]) => mockIsConfigured(...args),
}));

vi.mock("@/lib/db/client", () => ({
  getClient: async () => ({
    user: {
      count: () => mockUserCount(),
    },
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: () => mockAuth(),
}));

describe("requireSetupUnlocked", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SCROLLBACK_SETUP_TOKEN = "a-secure-setup-token";
    delete process.env.SETUP_TOKEN;
    mockGetConfig.mockReturnValue(null);
    mockIsConfigured.mockReturnValue(false);
    mockUserCount.mockResolvedValue(0);
    mockAuth.mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.SCROLLBACK_SETUP_TOKEN;
    } else {
      process.env.SCROLLBACK_SETUP_TOKEN = originalToken;
    }

    if (originalLegacyToken === undefined) {
      delete process.env.SETUP_TOKEN;
    } else {
      process.env.SETUP_TOKEN = originalLegacyToken;
    }
  });

  it("rejects first-run setup without a setup token", async () => {
    const { requireSetupUnlocked } = await import("@/lib/setup/guard");

    const response = await requireSetupUnlocked(new Request("http://localhost/api/setup/migrate"));

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: expect.stringContaining("Setup token required"),
    });
  });

  it("allows first-run setup with a valid setup token", async () => {
    const { requireSetupUnlocked } = await import("@/lib/setup/guard");

    const response = await requireSetupUnlocked(
      new Request("http://localhost/api/setup/migrate", {
        headers: { "x-scrollback-setup-token": "a-secure-setup-token" },
      })
    );

    expect(response).toBeNull();
  });

  it("requires a setup token when a configured instance has no users", async () => {
    mockGetConfig.mockReturnValue({ database: { type: "sqlite", url: "file:./scrollback.db" } });
    mockIsConfigured.mockReturnValue(true);
    mockUserCount.mockResolvedValue(0);
    const { requireSetupUnlocked } = await import("@/lib/setup/guard");

    const response = await requireSetupUnlocked(new Request("http://localhost/api/admin/setup"));

    expect(response?.status).toBe(403);
  });

  it("allows existing admins when allowAdmin is enabled", async () => {
    mockGetConfig.mockReturnValue({ database: { type: "sqlite", url: "file:./scrollback.db" } });
    mockIsConfigured.mockReturnValue(true);
    mockUserCount.mockResolvedValue(1);
    mockAuth.mockResolvedValue({ user: { role: "admin" } });
    const { requireSetupUnlocked } = await import("@/lib/setup/guard");

    const response = await requireSetupUnlocked(
      new Request("http://localhost/api/setup/test-connection"),
      { allowAdmin: true }
    );

    expect(response).toBeNull();
  });
});
