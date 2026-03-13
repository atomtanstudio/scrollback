/**
 * @deprecated Use getClient() from '@/lib/db/client' instead.
 * This file is kept temporarily for backward compatibility during migration.
 * It will be removed once all consumers use getClient().
 */

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://REDACTED:REDACTED@localhost:5432/REDACTED";

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
