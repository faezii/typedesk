import type { NextAuthConfig } from "next-auth";
import { canAccessPath } from "@/lib/auth/permissions";

const PUBLIC_PATHS = ["/login"];

/**
 * Edge/proxy-safe Auth.js config — no database or bcrypt imports here.
 * Providers that need Node APIs are added in auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // one working day
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      // The login page itself redirects valid users home; letting it through here avoids a
      // redirect loop when a still-valid JWT belongs to a user who was since deactivated.
      if (PUBLIC_PATHS.includes(pathname)) return true;
      if (!user) return false; // → /login?callbackUrl=…
      if (pathname !== "/forbidden" && !canAccessPath(user.role, pathname)) {
        return Response.redirect(new URL("/forbidden", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.department = user.department;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.department = token.department;
      return session;
    },
  },
} satisfies NextAuthConfig;
