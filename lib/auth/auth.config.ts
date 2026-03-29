import type { NextAuthConfig } from "next-auth";

/**
 * Shared auth configuration used by both the full auth setup and middleware.
 * This file must NOT import any database or Node.js-only modules,
 * because it runs in Next.js middleware (edge runtime).
 */

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role ?? "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.role = (token.role as string) ?? "admin";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [], // Providers added in auth.ts (requires DB access)
};
