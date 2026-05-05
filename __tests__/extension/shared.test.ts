import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, it, expect, vi } from "vitest";

type ChromeMock = {
  runtime: { lastError: null | { message: string } };
  tabs: { sendMessage: ReturnType<typeof vi.fn> };
  scripting: {
    executeScript: ReturnType<typeof vi.fn>;
    insertCSS: ReturnType<typeof vi.fn>;
  };
};

function loadSharedScript(chrome: ChromeMock) {
  const scriptPath = path.resolve(process.cwd(), "extension/shared.js");
  const source = fs.readFileSync(scriptPath, "utf8");
  const context = {
    chrome,
    console,
    globalThis: {} as Record<string, unknown>,
    setTimeout: (callback: () => void) => {
      callback();
      return 1;
    },
    clearTimeout: () => {},
  };

  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: scriptPath });
  return context.globalThis.FeedSiloExtension as {
    ensureTwitterTabReady: (tabId: number) => Promise<{
      ready: boolean;
      injected: boolean;
    }>;
    shouldHydrateCaptureData: (input: {
      hasCachedEntry: boolean;
      lateBootstrap: boolean;
      data: Record<string, unknown>;
    }) => boolean;
  };
}

describe("Scrollback extension tab bootstrap", () => {
  it("reuses an already-live content script without reinjecting", async () => {
    const chrome = {
      runtime: { lastError: null },
      tabs: {
        sendMessage: vi.fn((_tabId: number, _message: unknown, callback: (response?: unknown) => void) => {
          chrome.runtime.lastError = null;
          callback({ ready: true });
        }),
      },
      scripting: {
        executeScript: vi.fn(),
        insertCSS: vi.fn(),
      },
    };

    const shared = loadSharedScript(chrome);
    const result = await shared.ensureTwitterTabReady(42);

    expect(result).toEqual({ ready: true, injected: false });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    expect(chrome.scripting.insertCSS).not.toHaveBeenCalled();
  });

  it("injects capture assets when the receiver is missing, then retries", async () => {
    let probeCount = 0;
    const chrome = {
      runtime: { lastError: null as null | { message: string } },
      tabs: {
        sendMessage: vi.fn((_tabId: number, _message: unknown, callback: (response?: unknown) => void) => {
          probeCount += 1;
          if (probeCount === 1) {
            chrome.runtime.lastError = { message: "Could not establish connection. Receiving end does not exist." };
            callback(undefined);
            return;
          }
          chrome.runtime.lastError = null;
          callback({ ready: true });
        }),
      },
      scripting: {
        executeScript: vi.fn(async () => undefined),
        insertCSS: vi.fn(async () => undefined),
      },
    };

    const shared = loadSharedScript(chrome);
    const result = await shared.ensureTwitterTabReady(7);

    expect(result).toEqual({ ready: true, injected: true });
    expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(1, {
      target: { tabId: 7 },
      files: ["interceptor.js"],
      world: "MAIN",
    });
    expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(2, {
      target: { tabId: 7 },
      files: ["shared.js"],
    });
    expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(3, {
      target: { tabId: 7 },
      files: ["content.js"],
    });
    expect(chrome.scripting.insertCSS).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ["content.css"],
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("marks uncached late-boot tweet data for hydration", async () => {
    const chrome = {
      runtime: { lastError: null },
      tabs: {
        sendMessage: vi.fn(),
      },
      scripting: {
        executeScript: vi.fn(),
        insertCSS: vi.fn(),
      },
    };

    const shared = loadSharedScript(chrome);
    const needsHydration = shared.shouldHydrateCaptureData({
      hasCachedEntry: false,
      lateBootstrap: true,
      data: {
        external_id: "123",
        source_type: "tweet",
        conversation_id: null,
        posted_at: null,
        body_text: "hello world",
      },
    });

    expect(needsHydration).toBe(true);
  });

  it("skips hydration when the cache already has the tweet", async () => {
    const chrome = {
      runtime: { lastError: null },
      tabs: {
        sendMessage: vi.fn(),
      },
      scripting: {
        executeScript: vi.fn(),
        insertCSS: vi.fn(),
      },
    };

    const shared = loadSharedScript(chrome);
    const needsHydration = shared.shouldHydrateCaptureData({
      hasCachedEntry: true,
      lateBootstrap: true,
      data: {
        external_id: "123",
        source_type: "tweet",
        conversation_id: "123",
        posted_at: "2026-03-21T00:00:00.000Z",
        body_text: "hello world",
      },
    });

    expect(needsHydration).toBe(false);
  });
});
