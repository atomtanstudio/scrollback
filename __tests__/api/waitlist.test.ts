import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db client
const mockCreate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/db/client", () => ({
  getClient: vi.fn().mockResolvedValue({
    waitlistEntry: {
      create: mockCreate,
      findUnique: mockFindUnique,
    },
  }),
}));

let POST: (req: Request) => Promise<Response>;

function createRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/waitlist", () => {
  beforeEach(async () => {
    mockCreate.mockReset();
    mockFindUnique.mockReset();
    const mod = await import("@/app/api/waitlist/route");
    POST = mod.POST;
  });

  it("creates a new waitlist entry for valid email", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "1", email: "test@example.com" });

    const res = await POST(createRequest({ email: "test@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.alreadyRegistered).toBe(false);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { email: "test@example.com" },
    });
  });

  it("returns alreadyRegistered for duplicate email", async () => {
    mockFindUnique.mockResolvedValue({ id: "1", email: "test@example.com" });

    const res = await POST(createRequest({ email: "test@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.alreadyRegistered).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for missing email", async () => {
    const res = await POST(createRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await POST(createRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("normalizes email to lowercase", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "1", email: "test@example.com" });

    await POST(createRequest({ email: "Test@Example.COM" }));

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
  });
});
