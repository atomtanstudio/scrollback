#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENV_PATH = path.resolve(
  __dirname,
  "../.secrets/feedsilo-memory-gateway.env"
);

const env = {
  ...readEnvFile(process.env.FEEDSILO_MEMORY_GATEWAY_ENV || DEFAULT_ENV_PATH),
  ...process.env,
};

const BASE_URL =
  env.FEEDSILO_MEMORY_GATEWAY_URL || env.MEMORY_GATEWAY_URL || "http://172.17.0.1:8788";
const TOKEN = env.MEMORY_GATEWAY_TOKEN;

if (!TOKEN) {
  fail(
    `Missing MEMORY_GATEWAY_TOKEN. Expected it in ${process.env.FEEDSILO_MEMORY_GATEWAY_ENV || DEFAULT_ENV_PATH}`
  );
}

const [command, ...args] = process.argv.slice(2);

if (!command || command === "--help" || command === "-h") {
  usage();
  process.exit(command ? 0 : 1);
}

if (command === "health") {
  print(await request("GET", "/healthz"));
} else if (command === "manifest") {
  print(await request("GET", "/manifest"));
} else if (command === "search") {
  const options = parseSearchArgs(args);
  print(await request("POST", "/search", options));
} else if (command === "search-full" || command === "check") {
  const options = parseSearchArgs(args);
  options.include_items = true;
  if (!args.includes("--limit") && !args.includes("-n")) options.limit = 3;
  print(await request("POST", "/search", options));
} else if (command === "item") {
  const id = args[0];
  if (!id) fail("item requires a content_item_id");
  print(await request("POST", "/item", { content_item_id: id }));
} else if (command === "recent") {
  const options = parseRecentArgs(args);
  print(await request("POST", "/recent", options));
} else {
  fail(`Unknown command: ${command}`);
}

function usage() {
  console.log(`Usage:
  node tools/feedsilo_memory_search.mjs search "agent memory search" [--limit 5]
  node tools/feedsilo_memory_search.mjs check "agent memory search" [--limit 3]
  node tools/feedsilo_memory_search.mjs item CONTENT_ITEM_UUID
  node tools/feedsilo_memory_search.mjs recent [--limit 10]
  node tools/feedsilo_memory_search.mjs health

Defaults:
  search mode: hybrid
  dimensions: 1536
  endpoint: ${BASE_URL}
`);
}

function parseSearchArgs(args) {
  const options = {
    query: "",
    mode: "hybrid",
    dimensions: 1536,
    limit: 10,
  };
  const queryParts = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--query" || arg === "-q") {
      options.query = next || "";
      i += 1;
    } else if (arg === "--limit" || arg === "-n") {
      options.limit = Number.parseInt(next || "10", 10);
      i += 1;
    } else if (arg === "--mode") {
      options.mode = next || "hybrid";
      i += 1;
    } else if (arg === "--dimensions") {
      options.dimensions = Number.parseInt(next || "1536", 10);
      i += 1;
    } else if (arg === "--no-dedupe") {
      options.dedupe = false;
    } else if (arg === "--include-items" || arg === "--include-item") {
      options.include_items = true;
    } else {
      queryParts.push(arg);
    }
  }

  if (!options.query) options.query = queryParts.join(" ").trim();
  if (!options.query) fail("search requires a query");
  return options;
}

function parseRecentArgs(args) {
  const options = { limit: 10 };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--limit" || args[i] === "-n") {
      options.limit = Number.parseInt(args[i + 1] || "10", 10);
      i += 1;
    }
  }
  return options;
}

async function request(method, route, body) {
  const response = await fetch(`${BASE_URL.replace(/\/+$/, "")}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    fail(JSON.stringify(payload, null, 2));
  }
  return payload;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const parsed = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    parsed[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return parsed;
}

function print(value) {
  console.log(JSON.stringify(value, null, 2));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
