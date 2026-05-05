import { afterEach, describe, expect, it, vi } from "vitest";

const originalToken = process.env.SCROLLBACK_SETUP_TOKEN;
const originalLegacyToken = process.env.SETUP_TOKEN;

async function importTokenModule() {
  vi.resetModules();
  return import("@/lib/setup/token");
}

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

describe("setup token validation", () => {
  it("accepts the configured setup token", async () => {
    process.env.SCROLLBACK_SETUP_TOKEN = "a-secure-setup-token";
    delete process.env.SETUP_TOKEN;
    const { isValidSetupToken } = await importTokenModule();

    expect(isValidSetupToken("a-secure-setup-token")).toBe(true);
    expect(isValidSetupToken("wrong-secure-setup-token")).toBe(false);
  });

  it("extracts setup tokens from headers and bearer auth", async () => {
    process.env.SCROLLBACK_SETUP_TOKEN = "another-secure-setup-token";
    const { getProvidedSetupToken, isValidSetupToken } = await importTokenModule();

    const headerRequest = new Request("http://localhost/setup", {
      headers: { "x-scrollback-setup-token": "another-secure-setup-token" },
    });
    const bearerRequest = new Request("http://localhost/setup", {
      headers: { authorization: "Bearer another-secure-setup-token" },
    });

    expect(isValidSetupToken(getProvidedSetupToken(headerRequest))).toBe(true);
    expect(isValidSetupToken(getProvidedSetupToken(bearerRequest))).toBe(true);
  });
});
