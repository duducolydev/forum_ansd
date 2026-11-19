import { prisma } from "@/lib/db";
import { traduire } from "@/lib/langue";
import type { CreneauDirect } from "@/modules/settings/regles";

/**
 * Créneaux de diffusion : les sessions publiées de l'édition, réduites à un
 * titre et deux bornes.
 *
 * Lecture volontairement maigre, et non `sessions.listSessions` : celle-ci
 * ramène les intervenants, les salles et le compte des inscriptions, dont la
 * page du direct n'a aucun usage. L'écran est rafraîchi par tous les
 * téléspectateurs à la fois pendant trois jours — c'est la page du portail la
 * plus sollicitée de l'année, et elle ne doit coûter qu'une requête courte.
 *
 * `startTime` et `endTime` sont déjà des instants complets (`jour` + heure
 * assemblés en UTC à l'enregistrement, `sessions/service.ts`), et le Sénégal
 * est à UTC+0 toute l'année : l'horodatage ISO est directement comparable à
 * l'horloge du visiteur, où qu'il se trouve.
 *
 * Toutes les journées sont renvoyées, pas seulement celle du jour : le
 * décompte doit pouvoir annoncer l'ouverture de demain matin au public qui
 * reste sur la page après la dernière session de la veille.
 */
export async function creneauxDiffusion(
  editionId: string,
  langue: string,
): Promise<CreneauDirect[]> {
  const sessions = await prisma.session.findMany({
    where: { editionId, deletedAt: null, isPublished: true },
    orderBy: [{ startTime: "asc" }],
    select: {
      titleFr: true,
      titleEn: true,
      titlePt: true,
      startTime: true,
      endTime: true,
    },
  });

  return sessions.map((session) => ({
    titre: traduire(langue, {
      fr: session.titleFr,
      en: session.titleEn,
      pt: session.titlePt,
    }),
    debut: session.startTime.toISOString(),
    fin: session.endTime.toISOString(),
  }));
}
