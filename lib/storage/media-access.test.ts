import { beforeEach, describe, expect, it, vi } from "vitest";
import { canAccessMediaStorageKey, parseMediaStorageKey } from "@/lib/storage/media-access";

const mockFindFirst = vi.fn();

vi.mock("@/lib/db/client", () => ({
  getClient: vi.fn(async () => ({
    media: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  })),
}));

describe("media storage access", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
  });

  it("parses generated media keys", () => {
    expect(parseMediaStorageKey("media/item-123/media-456.jpg")).toEqual({
      contentItemId: "item-123",
      mediaId: "media-456",
    });
    expect(parseMediaStorageKey("../media/item/media.jpg")).toBeNull();
  });

  it("checks media ownership for non-admin users", async () => {
    mockFindFirst.mockResolvedValue({ id: "media-456" });

    await expect(
      canAccessMediaStorageKey("media/item-123/media-456.jpg", "user-1", "viewer")
    ).resolves.toBe(true);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        id: "media-456",
        content_item_id: "item-123",
        content_item: { user_id: "user-1" },
      },
      select: { id: true },
    });
  });

  it("lets admins access existing media without a user filter", async () => {
    mockFindFirst.mockResolvedValue({ id: "media-456" });

    await canAccessMediaStorageKey("media/item-123/media-456.jpg", "admin-1", "admin");

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        id: "media-456",
        content_item_id: "item-123",
      },
      select: { id: true },
    });
  });
});
