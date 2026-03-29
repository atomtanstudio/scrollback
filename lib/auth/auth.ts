import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getClient } from "@/lib/db/client";
import { sanitizeErrorMessage } from "@/lib/security/redact";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const db = await getClient();
          const user = await db.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user) return null;

          const valid = await bcrypt.compare(
            credentials.password as string,
            user.password_hash
          );

          if (!valid) return null;

          return {
            id: user.id,
            email: user.email,
            role: (user as Record<string, unknown>).role as string ?? "admin",
          };
        } catch (err) {
          console.error("Auth error:", sanitizeErrorMessage(err, "Unknown error"));
          return null;
        }
      },
    }),
  ],
});
