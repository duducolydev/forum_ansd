import type { DefaultSession } from "next-auth";

/**
 * `@auth/core` déclare `Session`/`User`/`JWT` en interne ; `next-auth` ne fait
 * que les ré-exporter (`export type { Session } from "@auth/core/types"`).
 * L'augmentation de déclaration ne fusionne qu'avec le module où l'interface
 * est **déclarée** : il faut donc augmenter `@auth/core/types` et
 * `@auth/core/jwt` directement, pas seulement `next-auth`/`next-auth/jwt`
 * (gardés ci-dessous pour les consommateurs qui importent depuis ces
 * spécificateurs, ex. `next-auth/react`).
 * Les interfaces ci-dessous n'ajoutent volontairement aucun membre propre :
 * `extends` suffit à faire fusionner `CustomUserFields` par déclaration.
 */
interface CustomUserFields {
  roleId: string;
  roleName: string;
  permissions: string[];
  totpEnabled: boolean;
  requiresTotpEnrollment: boolean;
  /** Version de session du compte à l'émission du jeton (PLAN.md §18). */
  sessionVersion: number;
}

declare module "@auth/core/types" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends CustomUserFields {}

  interface Session {
    user: { id: string } & CustomUserFields & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface JWT extends Partial<CustomUserFields> {}
}

declare module "next-auth" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends CustomUserFields {}

  interface Session {
    user: { id: string } & CustomUserFields & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface JWT extends Partial<CustomUserFields> {}
}
