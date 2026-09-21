import type { NextAuthConfig } from "next-auth";

/**
 * Config compatible Edge (sans Credentials/argon2/Prisma) : c'est celle-ci
 * que le middleware importe. La config complète (`src/auth.ts`) l'étend avec
 * le provider Credentials, qui a besoin du runtime Node.
 *
 * Pas de callback `authorized` ici : le middleware enveloppe `auth()` dans un
 * gestionnaire pour poser les en-têtes de sécurité, ce qui neutralise ce
 * callback. Le contrôle d'accès à `/admin` est donc appliqué dans
 * `src/middleware.ts`, seul endroit où il s'exécute réellement.
 */
export const authConfig = {
  pages: {
    signIn: "/connexion",
  },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.permissions = user.permissions;
        token.sessionVersion = user.sessionVersion;
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
      });
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
