#!/usr/bin/env node

import os from "node:os";
import path from "node:path";

process.env.SCROLLBACK_MEMORY_GATEWAY_ENV ||= process.env.FEEDSILO_MEMORY_GATEWAY_ENV || path.join(
  os.homedir(),
  ".codex",
  "secrets",
  "scrollback-memory-gateway.env"
);

await import("../services/scrollback-memory-gateway/openclaw/scrollback_memory_search.mjs");
