import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * MySQL 8.4 authentifie par `caching_sha2_password`, et le serveur ne garde en
 * cache que les utilisateurs déjà authentifiés **depuis son dernier démarrage**.
 * Cache vide, le client doit récupérer la clé publique RSA du serveur pour
 * chiffrer le mot de passe ; le connecteur MariaDB refuse cet échange sur une
 * connexion non chiffrée tant qu'on ne l'y autorise pas explicitement.
 *
 * Sans ce paramètre, l'application repart en erreur après **tout redémarrage de
 * la base** — sauvegarde, mise à jour, coupure de courant — avec pour seul
 * message un « pool timeout » qui ne désigne rien. Le défaut a été reproduit :
 * `FLUSH PRIVILEGES` puis redémarrage suffit à mettre le portail à terre.
 *
 * Le compromis est assumé parce que le lien application ↔ base ne quitte pas le
 * réseau privé de l'hébergeur. Sur un lien exposé, la bonne réponse est le TLS
 * vers MySQL, à mettre en place au déploiement (cf. PLAN.md T39/T1). Une URL qui
 * fixe déjà le paramètre garde la main.
 */
function connectionUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL manquant : impossible de joindre la base.");
  }
  if (url.includes("allowPublicKeyRetrieval")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}allowPublicKeyRetrieval=true`;
}

function createPrismaClient() {
  const adapter = new PrismaMariaDb(connectionUrl());
  return new PrismaClient({ adapter });
}

/** Instance unique de PrismaClient, réutilisée entre rechargements en dev (Next.js). */
export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
