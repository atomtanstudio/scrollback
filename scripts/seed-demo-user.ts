/**
 * Create or update the demo user account.
 *
 * Usage: npx tsx scripts/seed-demo-user.ts
 *
 * Requires DEMO_EMAIL and DEMO_PASSWORD environment variables.
 * Reads from .env.local and .env (same as the app).
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import bcrypt from "bcryptjs";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL!;
const DEMO_EMAIL = process.env.DEMO_EMAIL;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

if (!DEMO_EMAIL || !DEMO_PASSWORD) {
  console.error("DEMO_EMAIL and DEMO_PASSWORD are required");
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD!, 12);

  // Upsert: create if not exists, update password and role if exists
  const result = await client.query(
    `INSERT INTO users (id, email, password_hash, role, created_at)
     VALUES (gen_random_uuid(), $1, $2, 'demo', NOW())
     ON CONFLICT (email)
     DO UPDATE SET password_hash = $2, role = 'demo'
     RETURNING id, email, role`,
    [DEMO_EMAIL, passwordHash]
  );

  const user = result.rows[0];
  console.log(`Demo user ready: ${user.email} (id: ${user.id}, role: ${user.role})`);

  await client.end();
}

main().catch((err) => {
  console.error("Failed to seed demo user:", err);
  process.exit(1);
});
