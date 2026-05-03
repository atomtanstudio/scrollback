#!/usr/bin/env node

import os from "node:os";
import path from "node:path";

process.env.FEEDSILO_MEMORY_GATEWAY_ENV ||= path.join(
  os.homedir(),
  ".codex",
  "secrets",
  "feedsilo-memory-gateway.env"
);

await import("../services/feedsilo-memory-gateway/openclaw/feedsilo_memory_search.mjs");
