import crypto from "node:crypto";
import http from "node:http";
import { URL } from "node:url";
import pg from "pg";

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const DATABASE_URL = process.env.DATABASE_URL;
const DEFAULT_USER_ID = process.env.FEEDSILO_USER_ID || process.env.DEFAULT_USER_ID;
const GATEWAY_TOKEN = process.env.MEMORY_GATEWAY_TOKEN;
const ALLOW_ANONYMOUS = process.env.MEMORY_GATEWAY_ALLOW_ANONYMOUS === "true";
const ALLOW_USER_OVERRIDE = process.env.MEMORY_GATEWAY_ALLOW_USER_OVERRIDE === "true";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "http://127.0.0.1:8001/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "local";
const OPENAI_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "Qwen/Qwen3-Embedding-4B";
const DEFAULT_DIMENSIONS = parseDimensions(process.env.DEFAULT_DIMENSIONS, 1536);
const DEFAULT_LIMIT = clampInteger(process.env.DEFAULT_LIMIT, 20, 1, 200);
const EMBEDDING_TIMEOUT_MS = clampInteger(
  process.env.EMBEDDING_TIMEOUT_MS,
  120_000,
  1_000,
  600_000
);

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
if (!DEFAULT_USER_ID) {
  throw new Error("FEEDSILO_USER_ID or DEFAULT_USER_ID is required");
}
if (!GATEWAY_TOKEN && !ALLOW_ANONYMOUS) {
  throw new Error("MEMORY_GATEWAY_TOKEN is required unless anonymous mode is enabled");
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: clampInteger(process.env.PG_POOL_MAX, 4, 1, 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

const server = http.createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    if (statusCode >= 500) console.error("[memory-gateway]", error);
    sendJson(response, statusCode, {
      error: statusCode >= 500 ? "Internal gateway error" : error.message,
      ...(statusCode >= 500
        ? { message: error instanceof Error ? error.message : String(error) }
        : {}),
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[memory-gateway] listening on 0.0.0.0:${PORT}`);
});

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function shutdown() {
  console.log("[memory-gateway] shutting down");
  server.close();
  await pool.end();
  process.exit(0);
}

async function route(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    return sendEmpty(response, 204);
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/manifest")) {
    return sendJson(response, 200, manifest());
  }

  if (request.method === "GET" && url.pathname === "/healthz") {
    return healthz(response);
  }

  const auth = authenticate(request);
  if (!auth.ok) {
    return sendJson(response, auth.status, { error: auth.error }, auth.headers);
  }

  if (request.method === "POST" && url.pathname === "/search") {
    return search(request, response);
  }

  if (request.method === "GET" && url.pathname === "/search") {
    return searchFromQuery(url, response);
  }

  if (request.method === "POST" && url.pathname === "/item") {
    return item(request, response);
  }

  if (request.method === "POST" && url.pathname === "/recent") {
    return recent(request, response);
  }

  return sendJson(response, 404, { error: "Not found" });
}

function manifest() {
  return {
    name: "FeedSilo Memory Gateway",
    description:
      "Read-only agent search over saved FeedSilo captures. Search first, then fetch full items when needed.",
    auth: {
      type: "bearer",
      header: "Authorization: Bearer <token>",
    },
    defaults: {
      mode: "hybrid",
      dimensions: DEFAULT_DIMENSIONS,
      limit: DEFAULT_LIMIT,
      dedupe: true,
      include_items: false,
    },
    endpoints: {
      health: "GET /healthz",
      search: "POST /search",
      search_get: "GET /search?q=agent%20memory&limit=5",
      item: "POST /item",
      recent: "POST /recent",
    },
  };
}

async function healthz(response) {
  const startedAt = Date.now();
  const checks = {
    db: false,
    embedding_endpoint: OPENAI_BASE_URL.replace(/\/+$/, ""),
  };

  try {
    await pool.query("SELECT 1");
    checks.db = true;
  } catch (error) {
    checks.db_error = error instanceof Error ? error.message : String(error);
  }

  sendJson(response, checks.db ? 200 : 503, {
    ok: checks.db,
    service: "feedsilo-memory-gateway",
    defaults: {
      dimensions: DEFAULT_DIMENSIONS,
      limit: DEFAULT_LIMIT,
      model: OPENAI_EMBEDDING_MODEL,
    },
    checks,
    latency_ms: Date.now() - startedAt,
  });
}

async function search(request, response) {
  const body = await readJson(request);
  const payload = normalizeSearchPayload(body);
  const results = await runSearch(payload);
  sendJson(response, 200, results);
}

async function searchFromQuery(url, response) {
  const payload = normalizeSearchPayload({
    query: url.searchParams.get("q") || url.searchParams.get("query"),
    mode: url.searchParams.get("mode") || undefined,
    dimensions: url.searchParams.get("dimensions") || undefined,
    limit: url.searchParams.get("limit") || undefined,
    dedupe: url.searchParams.get("dedupe") === "false" ? false : undefined,
    include_items:
      url.searchParams.get("include_items") === "true" ||
      url.searchParams.get("includeItems") === "true",
  });
  const results = await runSearch(payload);
  sendJson(response, 200, results);
}

function normalizeSearchPayload(body) {
  if (!body || typeof body !== "object") {
    throw httpError(400, "Request body must be a JSON object");
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) throw httpError(400, "query is required");
  if (query.length > 1000) throw httpError(400, "query must be 1000 characters or fewer");

  const mode = body.mode || "hybrid";
  if (!["keyword", "vector", "hybrid"].includes(mode)) {
    throw httpError(400, "mode must be keyword, vector, or hybrid");
  }

  const dimensions = parseDimensions(body.dimensions, DEFAULT_DIMENSIONS);
  const limit = clampInteger(body.limit, DEFAULT_LIMIT, 1, 200);
  const dedupe = body.dedupe !== false;
  const includeItems = body.include_items === true || body.includeItems === true;
  if (includeItems && limit > 20) {
    throw httpError(400, "include_items is limited to 20 results per request");
  }
  const userId = resolveUserId(body.user_id || body.userId);

  return {
    query,
    mode,
    dimensions,
    limit,
    dedupe,
    includeItems,
    userId,
    keywordWeight: optionalWeight(body.keywordWeight ?? body.keyword_weight, 0.45),
    vectorWeight: optionalWeight(body.vectorWeight ?? body.vector_weight, 0.55),
  };
}

async function runSearch(payload) {
  const startedAt = Date.now();
  const embedding =
    payload.mode === "keyword"
      ? null
      : await createEmbedding(payload.query, payload.dimensions, "query");
  const dbLimit = payload.dedupe ? Math.min(payload.limit * 4, 200) : payload.limit;
  let rows;

  if (payload.mode === "keyword") {
    rows = (
      await pool.query(
        "SELECT * FROM agent_memory_keyword_search($1::uuid, $2::text, $3::integer)",
        [payload.userId, payload.query, dbLimit]
      )
    ).rows;
  } else if (payload.mode === "vector") {
    const fn =
      payload.dimensions === 1536
        ? "agent_memory_vector_search_1536"
        : "agent_memory_vector_search_768";
    rows = (
      await pool.query(`SELECT * FROM ${fn}($1::uuid, $2::vector, $3::integer)`, [
        payload.userId,
        vectorLiteral(embedding),
        dbLimit,
      ])
    ).rows;
  } else {
    const fn =
      payload.dimensions === 1536
        ? "agent_memory_hybrid_search_1536"
        : "agent_memory_hybrid_search_768";
    rows = (
      await pool.query(
        `SELECT * FROM ${fn}($1::uuid, $2::text, $3::vector, $4::integer, $5::double precision, $6::double precision)`,
        [
          payload.userId,
          payload.query,
          vectorLiteral(embedding),
          dbLimit,
          payload.keywordWeight,
          payload.vectorWeight,
        ]
      )
    ).rows;
  }

  const normalized = normalizeRows(rows);
  const candidates = payload.dedupe
    ? dedupeByContentItem(normalized).slice(0, payload.limit)
    : normalized.slice(0, payload.limit);
  let results = candidates.map((result, index) => ({ ...result, rank: index + 1 }));
  if (payload.includeItems) {
    results = await attachFullItems(payload.userId, results);
  }

  return {
    query: payload.query,
    mode: payload.mode,
    dimensions: payload.dimensions,
    limit: payload.limit,
    dedupe: payload.dedupe,
    include_items: payload.includeItems,
    count: results.length,
    embedding_model: payload.mode === "keyword" ? null : OPENAI_EMBEDDING_MODEL,
    latency_ms: Date.now() - startedAt,
    results,
  };
}

async function attachFullItems(userId, results) {
  const fullItems = new Map();
  for (const result of results) {
    if (fullItems.has(result.content_item_id)) continue;
    const response = await pool.query(
      "SELECT agent_memory_get_item($1::uuid, $2::uuid) AS item",
      [userId, result.content_item_id]
    );
    fullItems.set(result.content_item_id, response.rows[0]?.item || null);
  }

  return results.map((result) => ({
    ...result,
    item: fullItems.get(result.content_item_id),
  }));
}

async function item(request, response) {
  const body = await readJson(request);
  const contentItemId = body?.content_item_id || body?.contentItemId || body?.id;
  if (!isUuid(contentItemId)) throw httpError(400, "content_item_id must be a UUID");
  const userId = resolveUserId(body?.user_id || body?.userId);

  const result = await pool.query(
    "SELECT agent_memory_get_item($1::uuid, $2::uuid) AS item",
    [userId, contentItemId]
  );
  const found = result.rows[0]?.item;
  if (!found) throw httpError(404, "Item not found");

  sendJson(response, 200, { item: found });
}

async function recent(request, response) {
  const body = await readJson(request);
  const limit = clampInteger(body?.limit, DEFAULT_LIMIT, 1, 200);
  const userId = resolveUserId(body?.user_id || body?.userId);
  const result = await pool.query(
    "SELECT * FROM agent_memory_recent($1::uuid, $2::integer)",
    [userId, limit]
  );
  sendJson(response, 200, {
    count: result.rows.length,
    results: normalizeRows(result.rows),
  });
}

async function createEmbedding(input, dimensions, inputType) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    const response = await fetch(embeddingsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDING_MODEL,
        input,
        dimensions,
        input_type: inputType,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw httpError(
        502,
        `Embedding service returned ${response.status}: ${text.slice(0, 500)}`
      );
    }

    const payload = await response.json();
    const embedding = payload?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw httpError(502, "Embedding service response did not include data[0].embedding");
    }
    if (embedding.length !== dimensions) {
      throw httpError(
        502,
        `Embedding service returned ${embedding.length} dimensions, expected ${dimensions}`
      );
    }
    return embedding;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw httpError(504, "Embedding service timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeRows(rows) {
  return rows.map((row, index) => ({
    rank: index + 1,
    chunk_id: row.chunk_id,
    content_item_id: row.content_item_id,
    title: row.title,
    snippet: snippet(row.chunk_text),
    chunk_text: row.chunk_text,
    source_url: row.source_url,
    citation_url: row.source_url,
    author: {
      handle: row.author_handle,
      display_name: row.author_display_name,
    },
    source_type: row.source_type,
    posted_at: toIso(row.posted_at),
    score: toNumber(row.score),
    keyword_score: row.keyword_score == null ? undefined : toNumber(row.keyword_score),
    vector_score: row.vector_score == null ? undefined : toNumber(row.vector_score),
  }));
}

function dedupeByContentItem(results) {
  const seen = new Set();
  const deduped = [];
  for (const result of results) {
    if (seen.has(result.content_item_id)) continue;
    seen.add(result.content_item_id);
    deduped.push(result);
  }
  return deduped;
}

function snippet(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 700);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function vectorLiteral(embedding) {
  return `[${embedding.join(",")}]`;
}

function embeddingsUrl() {
  const clean = OPENAI_BASE_URL.replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/embeddings` : `${clean}/v1/embeddings`;
}

function resolveUserId(candidate) {
  if (candidate && ALLOW_USER_OVERRIDE) {
    if (!isUuid(candidate)) throw httpError(400, "user_id must be a UUID");
    return candidate;
  }
  return DEFAULT_USER_ID;
}

function parseDimensions(value, fallback) {
  const parsed = value == null ? fallback : Number.parseInt(String(value), 10);
  if (parsed !== 768 && parsed !== 1536) {
    throw httpError(400, "dimensions must be 768 or 1536");
  }
  return parsed;
}

function optionalWeight(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw httpError(400, "weights must be numbers between 0 and 1");
  }
  return parsed;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function authenticate(request) {
  if (ALLOW_ANONYMOUS) return { ok: true };

  const header = request.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const apiKey = request.headers["x-api-key"] || "";
  const token = bearer || apiKey;

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Missing bearer token",
      headers: { "WWW-Authenticate": "Bearer" },
    };
  }
  if (!safeEqual(token, GATEWAY_TOKEN)) {
    return {
      ok: false,
      status: 403,
      error: "Invalid bearer token",
    };
  }
  return { ok: true };
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw httpError(413, "Request body is too large");
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, "Request body must be valid JSON");
  }
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, X-API-Key, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...extraHeaders,
  });
  response.end(body);
}

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, X-API-Key, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
