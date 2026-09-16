import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { authenticateUser } from "./modules/auth/service";
import { revaliderJeton } from "./modules/auth/revalidation";
import { AuthStatusError } from "./lib/auth-errors";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /*
     * Configuration du runtime Node, donc avec accès à la base : chaque lecture
     * de session y est revalidée (compte actif, version de session, droits
     * relus). À la connexion, le jeton vient d'être construit depuis la base et
     * n'a pas à être relu. Le middleware garde la configuration Edge, sans base.
     */
    async jwt(parametres) {
      const jeton = authConfig.callbacks.jwt(parametres);
      if (parametres.user) return jeton;
      return revaliderJeton(jeton);
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Mot de passe", type: "password" },
        code: { label: "Code TOTP" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password =
          typeof credentials?.password === "string" ? credentials.password : undefined;
        const code =
          typeof credentials?.code === "string" && credentials.code.length > 0
            ? credentials.code
            : undefined;

        if (!email || !password) {
          throw new AuthStatusError("INVALID_CREDENTIALS");
        }

        const result = await authenticateUser(email, password, code);
        if (result.status !== "OK") {
          throw new AuthStatusError(result.status);
        }

        return result.user;
      },
    }),
  ],
});
