import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Auth.js options. Credentials provider backed by Postgres users table.
 * The NextAuth app route lives in src/app/api/auth/[...nextauth]/route.ts.
 *
 * Note: NextAuth's default JWT strategy works without a database adapter,
 * which keeps things simple for local dev. We store only userId + email in
 * the session token.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds.password) return null;
        const email = creds.email.toLowerCase().trim();
        let user = await prisma.user.findUnique({ where: { email } });
        // Auto-create on first sign-in attempt for frictionless local dev.
        // (Lock this down before production.)
        if (!user) {
          const hashedPassword = await bcrypt.hash(creds.password, 10);
          user = await prisma.user.create({
            data: { email, hashedPassword, name: email.split("@")[0] },
          });
          return { id: user.id, email: user.email, name: user.name };
        }
        if (!user.hashedPassword) {
          throw new Error("Account exists but has no password — sign in with the linked provider.");
        }
        const ok = await bcrypt.compare(creds.password, user.hashedPassword);
        return ok ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
  },
};