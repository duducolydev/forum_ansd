import { CredentialsSignin } from "next-auth";

/**
 * Porte le statut précis renvoyé par `authenticateUser` (PLAN.md 0.3) jusqu'à
 * la page de connexion, via le paramètre `code` qu'Auth.js ajoute à l'URL de
 * redirection pour toute sous-classe de `CredentialsSignin`.
 */
export class AuthStatusError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}
