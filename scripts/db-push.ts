/**
 * Schema-aware Prisma db push.
 *
 * Fresh installs may not have a database configured yet; in that case the app
 * should still boot so onboarding can create the config and run the first push.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { spawnSync } from "child_process";
import { createRequire } from "module";
import { readConfig, resolveConfig } from "../lib/config";

const appConfig = resolveConfig(readConfig());

if (!appConfig) {
  console.log("[db:push] No database configured, skipping.");
  process.exit(0);
}

const schemaPath =
  appConfig.database.type === "sqlite"
    ? "prisma/schema-sqlite.prisma"
    : "prisma/schema.prisma";

console.log(`[db:push] Applying ${appConfig.database.type} schema.`);

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const result = spawnSync(
  process.execPath,
  [prismaCli, "db", "push", `--schema=${schemaPath}`, "--accept-data-loss"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: appConfig.database.url,
      DATABASE_TYPE: appConfig.database.type,
    },
  }
);

if (result.error) {
  console.error("[db:push] Failed to run Prisma:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
