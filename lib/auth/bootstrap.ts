import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getClient } from "@/lib/db/client";

export async function hasAdminUsers(): Promise<boolean> {
  const db = await getClient();
  const count = await db.user.count();
  return count > 0;
}

export async function createInitialAdmin(email: string, password: string) {
  const db = await getClient();
  const existingCount = await db.user.count();

  if (existingCount > 0) {
    throw new Error("Admin account already exists");
  }

  const password_hash = await bcrypt.hash(password, 12);

  return db.user.create({
    data: { email, password_hash, role: "admin", capture_token: randomUUID() },
  });
}
