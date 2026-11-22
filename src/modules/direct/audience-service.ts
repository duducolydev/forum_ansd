import { prisma } from "@/lib/db";
import { completerCourbe, creneau, jourDe, PRESENCE_MS, type AudienceDuJour } from "./audience";

/**
 * Écriture et lecture de l'affluence du direct.
 *
 * Les règles pures — cadence, fenêtre de présence, découpage en créneaux —
 * sont dans `audience.ts`, où elles se testent sans base.
 */

/*
 * Dernier créneau relevé par ce processus.
 *
 * Le relevé coûte un `count` ; le faire à chaque battement reviendrait à
 * compter mille fois par minute ce qui ne change qu'aux cinq minutes. Ce
 * garde-fou en mémoire suffit à n'en garder qu'un par processus et par
 * créneau ; entre plusieurs instances, c'est l'unicité en base qui tranche —
 * la seconde écriture est simplement ignorée.
 */
let dernierCreneauReleve = 0;

/**
 * Enregistre un battement, et relève le créneau si personne ne l'a fait.
 *
 * Le jeton est la clé primaire : un battement **met à jour** la ligne plutôt
 * que d'en ajouter une, ce qui borne la table au nombre de spectateurs
 * distincts. `day` et `startedAt` ne sont posés qu'à la création — un onglet
 * ouvert avant minuit reste rattaché à sa journée.
 */
export async function enregistrerBattement(
  editionId: string,
  jeton: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const jour = jourDe(maintenant);

  await prisma.liveViewer.upsert({
    where: { id: jeton },
    create: { id: jeton, editionId, day: jour, startedAt: maintenant, lastSeenAt: maintenant },
    update: { lastSeenAt: maintenant },
  });

  await releverSiNecessaire(editionId, maintenant);
}

async function releverSiNecessaire(editionId: string, maintenant: Date): Promise<void> {
  const courant = creneau(maintenant);
  if (courant.getTime() === dernierCreneauReleve) return;

  /*
   * Le créneau est marqué **avant** le comptage, pour que deux battements
   * simultanés n'en lancent pas deux. En cas d'échec on revient en arrière :
   * sans cela, une base indisponible une seconde coûterait tout le créneau,
   * et la courbe montrerait un creux qui n'a pas eu lieu.
   */
  const precedent = dernierCreneauReleve;
  dernierCreneauReleve = courant.getTime();

  try {
    const viewers = await prisma.liveViewer.count({
      where: { editionId, lastSeenAt: { gte: new Date(maintenant.getTime() - PRESENCE_MS) } },
    });
    await prisma.liveAudienceSample.create({
      data: { editionId, day: jourDe(maintenant), at: courant, viewers },
    });
  } catch (erreur) {
    /*
     * Deux cas se présentent ici, et un seul mérite un retour en arrière :
     * une autre instance a déjà relevé ce créneau — l'unicité
     * (editionId, at) a joué son rôle, il n'y a rien à refaire —, ou la base
     * a flanché. Faute de pouvoir les distinguer sans coupler ce module au
     * code d'erreur de Prisma, on ne réessaie que si le créneau n'existe pas.
     */
    const existe = await prisma.liveAudienceSample
      .findUnique({ where: { editionId_at: { editionId, at: courant } }, select: { id: true } })
      .catch(() => null);
    if (!existe) dernierCreneauReleve = precedent;
    if (!existe) console.error("Relevé d'affluence du direct manqué.", erreur);
  }
}

/**
 * Journées où au moins un lecteur a été lancé, de la plus récente à la plus
 * ancienne.
 *
 * L'écran des présences s'en sert pour choisir sa journée par défaut : une
 * diffusion peut avoir lieu un jour sans aucun scan à l'entrée — un dimanche
 * de répétition, une séance en ligne —, et ses spectateurs ne doivent pas
 * rester invisibles derrière la dernière journée scannée.
 */
export async function joursAvecAudience(editionId: string): Promise<Date[]> {
  const lignes = await prisma.liveViewer.findMany({
    where: { editionId },
    distinct: ["day"],
    orderBy: { day: "desc" },
    select: { day: true },
  });
  return lignes.map((ligne) => ligne.day);
}

/** Affluence d'une journée, pour l'écran de suivi. */
export async function audienceDuJour(
  editionId: string,
  jour: Date,
  maintenant: Date = new Date(),
): Promise<AudienceDuJour> {
  const day = jourDe(jour);

  const [uniques, releves] = await Promise.all([
    prisma.liveViewer.count({ where: { editionId, day } }),
    prisma.liveAudienceSample.findMany({
      where: { editionId, day },
      orderBy: { at: "asc" },
      select: { at: true, viewers: true },
    }),
  ]);

  /*
   * « En ce moment » n'a de sens que le jour même. Affiché sur une journée
   * passée, il montrerait l'affluence d'aujourd'hui sous le titre d'hier.
   */
  const estAujourdhui = day.getTime() === jourDe(maintenant).getTime();
  const maintenantCompte = estAujourdhui
    ? await prisma.liveViewer.count({
        where: { editionId, lastSeenAt: { gte: new Date(maintenant.getTime() - PRESENCE_MS) } },
      })
    : null;

  const pointCulminant = releves.reduce<{ at: Date; viewers: number } | null>(
    (meilleur, releve) => (!meilleur || releve.viewers > meilleur.viewers ? releve : meilleur),
    null,
  );

  return {
    uniques,
    pic: pointCulminant?.viewers ?? 0,
    picA: pointCulminant?.at.toISOString() ?? null,
    maintenant: maintenantCompte,
    courbe: completerCourbe(releves),
  };
}
