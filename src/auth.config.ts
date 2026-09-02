import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

/**
 * Config compatible Edge (sans Credentials/argon2/Prisma) : c'est celle-ci
 * que le middleware importe. La config complète (`src/auth.ts`) l'étend avec
 * le provider Credentials, qui a besoin du runtime Node.
 */
export const authConfig = {
  pages: {
    signIn: "/connexion",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isProtected = nextUrl.pathname.startsWith("/admin");
      if (!isProtected) return true;
      if (!isLoggedIn) return false;

      // 2FA obligatoire pour SUPER_ADMIN/ADMIN_FORUM (brief §7) : tant qu'il
      // n'est pas activé, seule la page d'enrôlement est accessible.
      const isEnrollPage = nextUrl.pathname === "/admin/2fa/enroll";
      if (auth!.user.requiresTotpEnrollment && !isEnrollPage) {
        return NextResponse.redirect(new URL("/admin/2fa/enroll", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.permissions = user.permissions;
        token.totpEnabled = user.totpEnabled;
        token.requiresTotpEnrollment = user.requiresTotpEnrollment;
      }
      return token;
    },
    session({ session, token }) {
      // `Object.assign` plutôt que des affectations champ à champ : la
      // signature de `session` mêle les variantes JWT/`database` d'Auth.js
      // en une intersection que TypeScript peine à résoudre correctement ici.
      Object.assign(session.user, {
        id: token.sub,
        roleId: token.roleId,
        roleName: token.roleName,
        permissions: token.permissions,
        totpEnabled: token.totpEnabled,
        requiresTotpEnrollment: token.requiresTotpEnrollment,
      });
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
