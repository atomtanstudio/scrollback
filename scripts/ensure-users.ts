/**
 * Ensure required user accounts exist on startup.
 * - Demo user (if DEMO_EMAIL + DEMO_PASSWORD are set)
 * - Generates capture_token for any user missing one
 *
 * Safe to run every startup — all operations are idempotent.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import bcrypt from "bcryptjs";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL || !DATABASE_URL.startsWith("postgres")) {
  process.exit(0);
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Ensure all users have capture tokens
    const { rowCount: tokensFilled } = await client.query(
      `UPDATE users SET capture_token = gen_random_uuid()::text WHERE capture_token IS NULL`
    );
    if (tokensFilled && tokensFilled > 0) {
      console.log(`[ensure-users] Generated capture tokens for ${tokensFilled} user(s).`);
    }

    // Seed demo user if env vars are set
    const demoEmail = process.env.DEMO_EMAIL;
    const demoPassword = process.env.DEMO_PASSWORD;

    if (demoEmail && demoPassword) {
      const passwordHash = await bcrypt.hash(demoPassword, 12);

      const result = await client.query(
        `INSERT INTO users (id, email, password_hash, role, capture_token, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'demo', gen_random_uuid()::text, NOW())
         ON CONFLICT (email)
         DO UPDATE SET password_hash = $2, role = 'demo',
           capture_token = COALESCE(users.capture_token, gen_random_uuid()::text)
         RETURNING id, email, role`,
        [demoEmail, passwordHash]
      );

      const user = result.rows[0];
      console.log(`[ensure-users] Demo user ready: ${user.email} (${user.role})`);
    }
  } catch (error) {
    console.error("[ensure-users] Error:", error);
    // Non-fatal — don't block app startup
  } finally {
    await client.end();
  }
}

main();
