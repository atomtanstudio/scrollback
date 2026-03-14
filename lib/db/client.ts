import { getConfigAsync, getConfig, type DatabaseType } from "@/lib/config";
import pg from "pg";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientAny = any; // Both PG and SQLite clients satisfy this

const globalForClient = globalThis as unknown as {
  feedsiloClient: PrismaClientAny | undefined;
  feedsiloDbType: DatabaseType | undefined;
  feedsiloPool: pg.Pool | undefined;
};

/**
 * Get the Prisma client for the configured database backend.
 * Caches client in globalThis (survives Next.js HMR in dev).
 * Throws if no database is configured.
 */
export async function getClient(): Promise<PrismaClientAny> {
  const config = await getConfigAsync();
  if (!config) {
    throw new Error(
      "No database configured. Complete onboarding at /onboarding"
    );
  }

  const dbType = config.database.type;

  // Return cached client if same database type
  if (
    globalForClient.feedsiloClient &&
    globalForClient.feedsiloDbType === dbType
  ) {
    return globalForClient.feedsiloClient;
  }

  let client: PrismaClientAny;

  if (dbType === "sqlite") {
    const { PrismaClient } = await import(
      "@/lib/generated/prisma-sqlite/client"
    );
    const { PrismaBetterSqlite3 } = await import(
      "@prisma/adapter-better-sqlite3"
    );
    const filePath = config.database.url.replace(/^file:/, "");
    const adapter = new PrismaBetterSqlite3({ url: `file:${filePath}` });
    client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query"] : [],
    });
  } else {
    // postgresql or supabase — both use PG client with explicit pool config
    const { PrismaClient } = await import("@/lib/generated/prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");

    // Create our own pool with proper timeouts so queries fail fast
    // instead of hanging forever when the pool is exhausted or connections die.
    const pool = new pg.Pool({
      connectionString: config.database.url,
      max: 10,                      // max connections in pool
      idleTimeoutMillis: 30_000,    // close idle connections after 30s
      connectionTimeoutMillis: 5_000, // fail after 5s if no connection available
    });

    // Log pool errors so they don't crash the process silently
    pool.on("error", (err) => {
      console.error("[db pool] Idle client error:", err.message);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaPg(pool as any);
    client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query"] : [],
    });

    globalForClient.feedsiloPool = pool;
  }

  globalForClient.feedsiloClient = client;
  globalForClient.feedsiloDbType = dbType;

  return client;
}

/**
 * Get the configured database type without initializing a client.
 */
export function getDatabaseType(): DatabaseType | null {
  const config = getConfig();
  return config?.database.type ?? null;
}

/**
 * Disconnect and clear the cached client.
 * Call when switching databases.
 */
export async function disconnectClient(): Promise<void> {
  // Disconnect Prisma first (releases pool connections), then end the pool
  const client = globalForClient.feedsiloClient;
  const pool = globalForClient.feedsiloPool;
  globalForClient.feedsiloClient = undefined;
  globalForClient.feedsiloDbType = undefined;
  globalForClient.feedsiloPool = undefined;
  if (client) await client.$disconnect();
  if (pool) await pool.end();
}
