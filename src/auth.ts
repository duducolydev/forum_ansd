import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { authenticateUser } from "./modules/auth/service";
import { AuthStatusError } from "./lib/auth-errors";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          roleId: result.user.roleId,
          roleName: result.user.roleName,
          permissions: result.user.permissions,
          totpEnabled: result.user.totpEnabled,
          requiresTotpEnrollment: result.user.requiresTotpEnrollment,
        };
      },
    }),
  ],
});
