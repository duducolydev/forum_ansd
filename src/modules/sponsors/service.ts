import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { detecterImageDeposee } from "@/lib/image-deposee";
import { LOGO_MAX_BYTES } from "./constantes";
import type { NiveauInput, SponsorInput } from "./schema";

export class SponsorRuleError extends Error {}

export interface Acteur {
  userId: string;
}

export { LOGO_MAX_BYTES };

/** Vide → `null` en base : distingue « non renseigné » de « chaîne vide ». */
function ouNull(valeur: string | undefined): string | null {
  const propre = valeur?.trim();
  return propre ? propre : null;
}

export async function listerNiveaux(editionId: string) {
  return prisma.sponsorLevel.findMany({
    where: { editionId },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { sponsors: { where: { deletedAt: null } } } },
    },
  });
}

/**
 * Ordre d'affichage, commun au site et au BackOffice (§32).
 *
 * `sortOrder` d'abord, le nom ensuite : deux partenaires au même rang restent
 * classés de façon stable, ce qui évite qu'une page se réordonne d'un
 * chargement à l'autre sans que rien ait changé.
 */
const ORDRE_AFFICHAGE = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

export async function listerSponsors(editionId: string) {
  return prisma.sponsor.findMany({
    where: { editionId, deletedAt: null },
    orderBy: ORDRE_AFFICHAGE,
    include: { level: { select: { id: true, name: true, sortOrder: true } } },
  });
}

/** Partenaires visibles du public, dans l'ordre décidé par le comité. */
export async function listerSponsorsPublies(editionId: string) {
  return prisma.sponsor.findMany({
    where: { editionId, isPublished: true, deletedAt: null },
    orderBy: ORDRE_AFFICHAGE,
    // Projection explicite : `contactName` et `contactEmail` sont des données
    // internes (§5.9) et ne doivent jamais atteindre la page publique, même en
    // passant par le HTML rendu côté serveur.
    select: {
      id: true,
      name: true,
      logoPath: true,
      website: true,
      standNumber: true,
      descriptionFr: true,
      descriptionEn: true,
      sortOrder: true,
      level: { select: { id: true, name: true, sortOrder: true, logoMaxWidth: true } },
    },
  });
}

/**
 * Déplace un partenaire d'un rang vers le haut ou vers le bas.
 *
 * L'échange se fait avec le **voisin dans la liste affichée**, et non par un
 * calcul sur `sortOrder` : plusieurs partenaires partagent le même rang après
 * la reprise des données, et incrémenter un nombre les aurait fait sauter
 * par-dessus un groupe entier. Les rangs sont donc réécrits en entier, de 10 en
 * 10, ce qui rend l'ordre lisible en base et laisse de la place pour insérer.
 */
export async function deplacerSponsor(
  editionId: string,
  sponsorId: string,
  direction: "haut" | "bas",
  acteur: Acteur,
): Promise<void> {
  const sponsors = await prisma.sponsor.findMany({
    where: { editionId, deletedAt: null },
    orderBy: ORDRE_AFFICHAGE,
    select: { id: true, name: true },
  });

  const position = sponsors.findIndex((sponsor) => sponsor.id === sponsorId);
  if (position === -1) throw new SponsorRuleError("Partenaire introuvable.");

  const cible = direction === "haut" ? position - 1 : position + 1;
  // Aux extrémités, la demande est sans objet : on ne la traite pas comme une
  // erreur, le bouton correspondant étant déjà désactivé à l'écran.
  if (cible < 0 || cible >= sponsors.length) return;

  const reordonnes = [...sponsors];
  const [deplace] = reordonnes.splice(position, 1);
  reordonnes.splice(cible, 0, deplace!);

  await prisma.$transaction(
    reordonnes.map((sponsor, rang) =>
      prisma.sponsor.update({ where: { id: sponsor.id }, data: { sortOrder: (rang + 1) * 10 } }),
    ),
  );

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "sponsor.reordered",
    entity: "Sponsor",
    entityId: sponsorId,
    before: { position: position + 1 },
    after: { position: cible + 1, nom: deplace!.name },
  });
}

export async function trouverSponsor(sponsorId: string) {
  return prisma.sponsor.findFirst({
    where: { id: sponsorId, deletedAt: null },
    include: { level: { select: { id: true, name: true } } },
  });
}

async function niveauDeLEdition(editionId: string, levelId: string) {
  const niveau = await prisma.sponsorLevel.findFirst({ where: { id: levelId, editionId } });
  if (!niveau) {
    // Le niveau est lu en base et rattaché à l'édition : une valeur forgée dans
    // le formulaire ne peut pas rattacher un sponsor à une autre édition.
    throw new SponsorRuleError("Niveau de sponsor inconnu pour cette édition.");
  }
  return niveau;
}

function donnees(input: SponsorInput) {
  return {
    name: input.name,
    levelId: input.levelId,
    descriptionFr: ouNull(input.descriptionFr),
    descriptionEn: ouNull(input.descriptionEn),
    website: ouNull(input.website),
    videoUrl: ouNull(input.videoUrl),
    standNumber: ouNull(input.standNumber),
    contactName: ouNull(input.contactName),
    contactEmail: ouNull(input.contactEmail),
    isPublished: input.isPublished,
  };
}

export async function creerSponsor(editionId: string, input: SponsorInput, acteur: Acteur) {
  const niveau = await niveauDeLEdition(editionId, input.levelId);

  const sponsor = await prisma.sponsor.create({
    data: { editionId, ...donnees(input) },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "sponsor.created",
    entity: "Sponsor",
    entityId: sponsor.id,
    after: { name: sponsor.name, niveau: niveau.name, isPublished: sponsor.isPublished },
  });

  return sponsor;
}

export async function modifierSponsor(
  editionId: string,
  sponsorId: string,
  input: SponsorInput,
  acteur: Acteur,
) {
  const avant = await prisma.sponsor.findFirst({
    where: { id: sponsorId, editionId, deletedAt: null },
    include: { level: { select: { name: true } } },
  });
  if (!avant) throw new SponsorRuleError("Sponsor introuvable.");

  const niveau = await niveauDeLEdition(editionId, input.levelId);
  const apres = await prisma.sponsor.update({
    where: { id: sponsorId },
    data: donnees(input),
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "sponsor.updated",
    entity: "Sponsor",
    entityId: sponsorId,
    before: { name: avant.name, niveau: avant.level.name, isPublished: avant.isPublished },
    after: { name: apres.name, niveau: niveau.name, isPublished: apres.isPublished },
  });

  return apres;
}

/**
 * Retrait d'un sponsor : suppression logique (`deletedAt`, §4).
 *
 * Un partenariat qui s'arrête ne doit pas effacer la trace de ce qui a été
 * affiché pendant la préparation du Forum.
 */
export async function retirerSponsor(editionId: string, sponsorId: string, acteur: Acteur) {
  const sponsor = await prisma.sponsor.findFirst({
    where: { id: sponsorId, editionId, deletedAt: null },
  });
  if (!sponsor) throw new SponsorRuleError("Sponsor introuvable.");

  await prisma.sponsor.update({
    where: { id: sponsorId },
    data: { deletedAt: new Date(), isPublished: false },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "sponsor.deleted",
    entity: "Sponsor",
    entityId: sponsorId,
    before: { name: sponsor.name, isPublished: sponsor.isPublished },
  });
}

export async function enregistrerLogo(
  editionId: string,
  sponsorId: string,
  fichier: File,
  acteur: Acteur,
): Promise<void> {
  if (fichier.size === 0) throw new SponsorRuleError("Aucun fichier reçu.");
  if (fichier.size > LOGO_MAX_BYTES) {
    throw new SponsorRuleError(`Logo trop lourd (maximum ${LOGO_MAX_BYTES / 1024 / 1024} Mo).`);
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  // Type déduit des octets et jamais de l'extension (§7) : ce fichier finit
  // sur la page publique. Le SVG passe par une vérification supplémentaire,
  // décrite dans `logo.ts`.
  const { type: detecte, refus } = detecterImageDeposee(octets);
  if (!detecte) throw new SponsorRuleError(refus ?? "Format d'image non reconnu.");

  const sponsor = await prisma.sponsor.findFirst({
    where: { id: sponsorId, editionId, deletedAt: null },
    select: { logoPath: true },
  });
  if (!sponsor) throw new SponsorRuleError("Sponsor introuvable.");

  // Suffixe aléatoire plutôt qu'écrasement : un remplacement change l'URL, donc
  // aucun cache ne peut servir l'ancien logo.
  const chemin = `sponsors/${sponsorId}-${randomBytes(6).toString("hex")}.${detecte.extension}`;
  await fileStorage.put(chemin, octets, detecte.type);
  await prisma.sponsor.update({ where: { id: sponsorId }, data: { logoPath: chemin } });

  if (sponsor.logoPath && sponsor.logoPath !== chemin) {
    await fileStorage.delete(sponsor.logoPath).catch(() => undefined);
  }

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "sponsor.logo_updated",
    entity: "Sponsor",
    entityId: sponsorId,
    after: { bytes: octets.length, type: detecte.type },
  });
}

export async function enregistrerNiveau(
  editionId: string,
  niveauId: string | null,
  input: NiveauInput,
  acteur: Acteur,
) {
  const doublon = await prisma.sponsorLevel.findFirst({
    where: { editionId, code: input.code, ...(niveauId ? { id: { not: niveauId } } : {}) },
  });
  if (doublon) throw new SponsorRuleError(`Le code « ${input.code} » est déjà utilisé.`);

  const donneesNiveau = {
    code: input.code,
    name: input.name,
    sortOrder: input.sortOrder,
    logoMaxWidth: input.logoMaxWidth ?? null,
  };

  const niveau = niveauId
    ? await prisma.sponsorLevel.update({ where: { id: niveauId }, data: donneesNiveau })
    : await prisma.sponsorLevel.create({ data: { editionId, ...donneesNiveau } });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: niveauId ? "sponsor_level.updated" : "sponsor_level.created",
    entity: "SponsorLevel",
    entityId: niveau.id,
    after: donneesNiveau,
  });

  return niveau;
}

/**
 * Un niveau ne se supprime que s'il est vide.
 *
 * `Sponsor.levelId` est obligatoire : supprimer un niveau occupé laisserait des
 * sponsors sans rattachement, donc invisibles sur la page publique sans que
 * personne ne comprenne pourquoi.
 */
export async function supprimerNiveau(editionId: string, niveauId: string, acteur: Acteur) {
  const niveau = await prisma.sponsorLevel.findFirst({
    where: { id: niveauId, editionId },
    include: { _count: { select: { sponsors: { where: { deletedAt: null } } } } },
  });
  if (!niveau) throw new SponsorRuleError("Niveau introuvable.");
  if (niveau._count.sponsors > 0) {
    throw new SponsorRuleError(
      `Ce niveau porte encore ${niveau._count.sponsors} sponsor(s) : déplacez-les avant de le supprimer.`,
    );
  }

  await prisma.sponsorLevel.delete({ where: { id: niveauId } });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "sponsor_level.deleted",
    entity: "SponsorLevel",
    entityId: niveauId,
    before: { code: niveau.code, name: niveau.name },
  });
}
