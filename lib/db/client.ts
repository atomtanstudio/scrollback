import { getConfig, type DatabaseType } from "@/lib/config";

type PrismaClientAny = any; // Both PG and SQLite clients satisfy this

const globalForClient = globalThis as unknown as {
  feedsiloClient: PrismaClientAny | undefined;
  feedsiloDbType: DatabaseType | undefined;
};

/**
 * Get the Prisma client for the configured database backend.
 * Caches client in globalThis (survives Next.js HMR in dev).
 * Throws if no database is configured.
 */
export async function getClient(): Promise<PrismaClientAny> {
  const config = getConfig();
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
    client = new PrismaClient({
      datasourceUrl: config.database.url,
      log: process.env.NODE_ENV === "development" ? ["query"] : [],
    });
  } else {
    // postgresql or supabase — both use PG client
    const { PrismaClient } = await import("@/lib/generated/prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: config.database.url });
    client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query"] : [],
    });
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
  if (globalForClient.feedsiloClient) {
    await globalForClient.feedsiloClient.$disconnect();
    globalForClient.feedsiloClient = undefined;
    globalForClient.feedsiloDbType = undefined;
  }
}
