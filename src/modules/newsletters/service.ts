import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { texteBrut, lireTexteRiche } from "@/lib/texte-riche";
import type { Actor } from "@/modules/participants/service";
import {
  FICHIER_NEWSLETTER_MAX_BYTES,
  lireImages,
  NewsletterRuleError,
  nomFichierPropre,
  slugDepuisTitre,
  type NewsletterInput,
} from "./schema";

/**
 * Newsletters : dépôt, publication, envoi (§34, refondu le 25 novembre 2026).
 *
 * Une newsletter est un titre, une description et un **fichier de synthèse**
 * en PDF, téléchargeable depuis le portail. Trois états :
 *
 * - **brouillon** : invisible du public, modifiable sans limite ;
 * - **publiée** : listée sur le site, le fichier téléchargeable ;
 * - **envoyée** : l'annonce est partie (`envoi.ts`). Titre, description et
 *   fichier restent corrigibles — les liens des messages mènent au site —,
 *   mais l'envoi ne se refait pas, et la newsletter ne se dépublie plus.
 *
 * Les premières newsletters, rédigées en texte mis en forme, gardent leur
 * corps : il est affiché, jamais réécrit.
 */

const CHAMPS_LISTE = {
  id: true,
  slug: true,
  titleFr: true,
  titleEn: true,
  titlePt: true,
  excerptFr: true,
  excerptEn: true,
  excerptPt: true,
  coverPath: true,
  filePath: true,
  fileName: true,
  fileSize: true,
  downloadCount: true,
  isPublished: true,
  publishedAt: true,
  sentAt: true,
  sentCount: true,
  updatedAt: true,
} as const;

export async function listerNewsletters(editionId: string) {
  return prisma.newsletter.findMany({
    where: { editionId },
    select: CHAMPS_LISTE,
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
  });
}

/** Newsletters visibles du public, la plus récente d'abord. */
export async function listerPubliees(editionId: string) {
  return prisma.newsletter.findMany({
    where: { editionId, isPublished: true },
    select: CHAMPS_LISTE,
    orderBy: { publishedAt: "desc" },
  });
}

export async function trouverNewsletter(id: string) {
  return prisma.newsletter.findUnique({ where: { id } });
}

export async function trouverParSlug(editionId: string, slug: string) {
  return prisma.newsletter.findUnique({ where: { editionId_slug: { editionId, slug } } });
}

/**
 * Adresse libre, dérivée du titre.
 *
 * Le suffixe n'est ajouté qu'en cas de collision : deux newsletters intitulées
 * « Synthèse de la journée » sont plausibles, et faire échouer la seconde pour
 * cela n'aiderait personne.
 */
async function slugLibre(editionId: string, titre: string): Promise<string> {
  const base = slugDepuisTitre(titre);
  for (let essai = 0; essai < 20; essai++) {
    const candidat = essai === 0 ? base : `${base}-${essai + 1}`;
    const pris = await prisma.newsletter.findUnique({
      where: { editionId_slug: { editionId, slug: candidat } },
    });
    if (!pris) return candidat;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

function textes(input: NewsletterInput) {
  return {
    titleFr: input.titleFr,
    titleEn: input.titleEn || input.titleFr,
    titlePt: input.titlePt || null,
    excerptFr: input.excerptFr,
    excerptEn: input.excerptEn || input.excerptFr,
    excerptPt: input.excerptPt || null,
  };
}

/** Crée le brouillon ; le fichier se dépose ensuite (`deposerFichier`). */
export async function creerNewsletter(editionId: string, input: NewsletterInput, acteur: Actor) {
  const slug = await slugLibre(editionId, input.titleFr);

  const newsletter = await prisma.newsletter.create({
    data: {
      editionId,
      slug,
      ...textes(input),
      // Plus de corps saisi : la synthèse est le fichier.
      bodyFr: "",
      bodyEn: "",
      isPublished: false,
    },
  });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "newsletter.create",
    entity: "Newsletter",
    entityId: newsletter.id,
    after: { slug, titre: newsletter.titleFr },
  });

  return newsletter;
}

/** Titre et description ; le corps des anciennes newsletters n'est pas touché. */
export async function modifierNewsletter(id: string, input: NewsletterInput, acteur: Actor) {
  const avant = await prisma.newsletter.findUniqueOrThrow({ where: { id } });

  const newsletter = await prisma.newsletter.update({
    where: { id },
    data: textes(input),
  });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "newsletter.update",
    entity: "Newsletter",
    entityId: id,
    before: { titre: avant.titleFr, description: avant.excerptFr },
    after: { titre: newsletter.titleFr, description: newsletter.excerptFr },
  });

  return newsletter;
}

const SIGNATURE_PDF = Buffer.from("%PDF", "ascii");

/**
 * Dépose ou remplace le fichier de synthèse.
 *
 * Le type est déduit des **octets** : le fichier est distribué sous le nom de
 * l'ANSD, et une extension se renomme. Le remplacement reste permis après
 * l'envoi — une coquille se corrige —, puisque les messages mènent au site et
 * non à une pièce jointe figée.
 */
export async function deposerFichier(
  id: string,
  octets: Buffer,
  nomOrigine: string,
  acteur: Actor,
) {
  if (octets.length === 0) throw new NewsletterRuleError("Aucun fichier reçu.");
  if (octets.length > FICHIER_NEWSLETTER_MAX_BYTES) {
    throw new NewsletterRuleError(
      `Fichier trop lourd (maximum ${FICHIER_NEWSLETTER_MAX_BYTES / 1024 / 1024} Mo).`,
    );
  }
  if (!octets.subarray(0, 4).equals(SIGNATURE_PDF)) {
    throw new NewsletterRuleError("Le fichier doit être un PDF.");
  }

  const avant = await prisma.newsletter.findUniqueOrThrow({
    where: { id },
    select: { filePath: true, fileName: true, titleFr: true },
  });

  const chemin = `newsletters/fichiers/${id}-${randomBytes(6).toString("hex")}.pdf`;
  await fileStorage.put(chemin, octets, "application/pdf");

  const apres = await prisma.newsletter.update({
    where: { id },
    data: {
      filePath: chemin,
      fileName: nomFichierPropre(nomOrigine, avant.titleFr),
      fileSize: octets.length,
    },
  });

  // L'ancien fichier n'est retiré qu'une fois le nouveau en place : un dépôt
  // qui échoue en route ne laisse pas la newsletter sans fichier.
  if (avant.filePath) await fileStorage.delete(avant.filePath).catch(() => undefined);

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: avant.filePath ? "newsletter.file_replaced" : "newsletter.file_added",
    entity: "Newsletter",
    entityId: id,
    before: avant.filePath ? { fichier: avant.fileName } : undefined,
    after: { fichier: apres.fileName, octets: octets.length },
  });

  return apres;
}

/** Une newsletter d'avant la refonte, au corps mis en forme non vide. */
export function aUnCorps(newsletter: { bodyFr: string }): boolean {
  if (!newsletter.bodyFr.trim()) return false;
  try {
    return texteBrut(lireTexteRiche(newsletter.bodyFr)).trim().length > 0;
  } catch {
    return false;
  }
}

/** Met en ligne. Le fichier est exigé : c'est lui que la newsletter publie. */
export async function publierNewsletter(id: string, acteur: Actor) {
  const avant = await prisma.newsletter.findUniqueOrThrow({ where: { id } });
  if (avant.isPublished) return avant;
  if (!avant.filePath && !aUnCorps(avant)) {
    throw new NewsletterRuleError("Déposez le fichier PDF avant de publier la newsletter.");
  }

  const newsletter = await prisma.newsletter.update({
    where: { id },
    data: {
      isPublished: true,
      // La date marque la **première** mise en ligne : une republication ne
      // fait pas remonter la newsletter en tête de liste.
      publishedAt: avant.publishedAt ?? new Date(),
    },
  });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "newsletter.published",
    entity: "Newsletter",
    entityId: id,
    after: { slug: newsletter.slug, titre: newsletter.titleFr },
  });

  return newsletter;
}

export async function depublierNewsletter(id: string, acteur: Actor) {
  const avant = await prisma.newsletter.findUniqueOrThrow({ where: { id } });
  if (avant.sentAt) {
    throw new NewsletterRuleError(
      "Cette newsletter a déjà été envoyée : la retirer du site laisserait les liens des messages partis pointer vers une page introuvable.",
    );
  }
  if (!avant.isPublished) return avant;

  const newsletter = await prisma.newsletter.update({
    where: { id },
    data: { isPublished: false },
  });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "newsletter.unpublished",
    entity: "Newsletter",
    entityId: id,
    before: { slug: avant.slug },
  });

  return newsletter;
}

export async function supprimerNewsletter(id: string, acteur: Actor): Promise<void> {
  const avant = await prisma.newsletter.findUniqueOrThrow({ where: { id } });
  if (avant.sentAt) {
    throw new NewsletterRuleError(
      "Cette newsletter a été envoyée : elle ne se supprime pas, les liens des messages déjà partis y mènent encore.",
    );
  }

  for (const image of lireImages(avant.images)) {
    await fileStorage.delete(image.path).catch(() => undefined);
  }
  if (avant.coverPath) await fileStorage.delete(avant.coverPath).catch(() => undefined);
  if (avant.filePath) await fileStorage.delete(avant.filePath).catch(() => undefined);

  await prisma.newsletter.delete({ where: { id } });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "newsletter.delete",
    entity: "Newsletter",
    entityId: id,
    before: { slug: avant.slug, titre: avant.titleFr },
  });
}

/** URL publique d'une image du corps (newsletters antérieures), par son rang. */
export function urlImage(id: string, cle: number): string {
  return `/api/v1/newsletters/${id}/image/${cle}`;
}

/** URL de téléchargement du fichier de synthèse. */
export function urlFichier(id: string): string {
  return `/api/v1/newsletters/${id}/fichier`;
}

/** URL du même fichier pour la visionneuse intégrée (`inline`, non compté). */
export function urlApercu(id: string): string {
  return `/api/v1/newsletters/${id}/apercu`;
}
