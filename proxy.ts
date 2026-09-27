import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Route protection + role gating runs in `authConfig.callbacks.authorized`.
const { auth } = NextAuth(authConfig);

export { auth as proxy };

export const config = {
  // Everything except Auth.js endpoints, Next internals and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
