import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { authenticateByChallenge, authenticateUser } from "./modules/auth/service";
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
        code: { label: "Code reçu par e-mail" },
        jeton: { label: "Jeton du lien de validation" },
        ip: { label: "Adresse du poste" },
      },
      /**
       * Deux chemins pour le second facteur (PLAN.md §23) : le **code** saisi
       * dans la fenêtre où la connexion a commencé, ou le **jeton** du lien reçu
       * par e-mail. Le jeton se suffit à lui-même : il n'existe que parce qu'un
       * mot de passe correct l'a fait créer.
       */
      authorize: async (credentials) => {
        const texte = (valeur: unknown) =>
          typeof valeur === "string" && valeur.length > 0 ? valeur : undefined;

        const jeton = texte(credentials?.jeton);
        if (jeton) {
          const parLien = await authenticateByChallenge(jeton);
          if (parLien.status !== "OK") throw new AuthStatusError(parLien.status);
          return parLien.user;
        }

        const email = texte(credentials?.email);
        const password = texte(credentials?.password);
        if (!email || !password) {
          throw new AuthStatusError("INVALID_CREDENTIALS");
        }

        const result = await authenticateUser(
          email,
          password,
          texte(credentials?.code),
          texte(credentials?.ip),
        );
        if (result.status !== "OK") {
          throw new AuthStatusError(result.status);
        }

        return result.user;
      },
    }),
  ],
});
