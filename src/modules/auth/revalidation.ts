import type { JWT } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { droitsDuCompte } from "./service";

/**
 * Revalide une session du BackOffice contre la base, à chaque lecture côté
 * serveur (PLAN.md §18).
 *
 * ## Le défaut que cela ferme
 *
 * La session est un jeton signé qui portait, figés au moment de la connexion,
 * le rôle et les permissions du compte. Rien ne le relisait ensuite. Mesuré sur
 * un compte jetable : **désactivé, il continuait d'ouvrir le BackOffice**, seule
 * une nouvelle connexion étant refusée. Le jeton vit 30 jours après la dernière
 * visite et chaque visite le prolonge : un agent parti ou un compte volé gardait
 * l'accès tant qu'il s'en servait. De même, un mot de passe ou un second facteur
 * réinitialisé laissait ouvertes les sessions existantes, et un rôle modifié ne
 * prenait effet qu'à la reconnexion.
 *
 * ## Ce qui est vérifié
 *
 * - le compte existe et il est **actif** ;
 * - sa **version de session** est celle du jeton — elle est incrémentée quand
 *   le mot de passe ou le second facteur est réinitialisé, quand le second
 *   facteur est activé, et quand le compte est désactivé (sans quoi le
 *   réactiver rouvrirait les sessions d'avant) ;
 * - le rôle et les permissions sont **relus** : un changement de droits
 *   s'applique à la requête suivante.
 *
 * Un jeton émis avant cette vérification ne porte pas de version : il est refusé,
 * ce qui demande une reconnexion unique à chacun.
 *
 * Renvoyer `null` invalide la session (Auth.js efface le cookie quand il le
 * peut). Le middleware, qui tourne sans accès à la base, ne passe pas par ici :
 * il continue de voir un jeton signé, mais chaque page, action et route du
 * BackOffice lit la session par `auth()`, donc par cette fonction.
 *
 * Coût : une lecture par clé primaire, avec le rôle, à chaque `auth()`.
 */
export async function revaliderJeton(jeton: JWT): Promise<JWT | null> {
  if (!jeton.sub || typeof jeton.sessionVersion !== "number") return null;

  const compte = await prisma.user.findUnique({
    where: { id: jeton.sub },
    select: {
      isActive: true,
      roleId: true,
      sessionVersion: true,
      role: { select: { name: true, permissions: true } },
    },
  });

  if (!compte || !compte.isActive || compte.sessionVersion !== jeton.sessionVersion) {
    return null;
  }

  return { ...jeton, ...droitsDuCompte(compte) };
}
