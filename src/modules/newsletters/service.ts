import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { detectImageType } from "@/modules/participants/photo";
import { enqueueBulk } from "@/modules/notifications/jobs";
import type { Actor } from "@/modules/participants/service";
import {
  IMAGE_NEWSLETTER_MAX_BYTES,
  lireImages,
  normaliserNewsletter,
  NewsletterRuleError,
  slugDepuisTitre,
  type NewsletterInput,
} from "./schema";

/**
 * Newsletters : rédaction, publication, envoi (§34).
 *
 * Trois états, et le passage de l'un à l'autre n'est pas symétrique :
 *
 * - **brouillon** : invisible du public, modifiable sans limite ;
 * - **publiée** : lisible sur le site, toujours modifiable ;
 * - **envoyée** : les e-mails sont partis. La newsletter reste modifiable —
 *   une coquille se corrige sur le site — mais l'envoi ne se refait pas.
 *
 * L'envoi est le seul acte irréversible du module, et c'est lui qui gouverne
 * tout le reste : dépublier après envoi laisserait mille liens pointer vers une
 * page introuvable, donc c'est refusé.
 */

const CHAMPS_LISTE = {
  id: true,
  slug: true,
  titleFr: true,
  titleEn: true,
  excerptFr: true,
  excerptEn: true,
  coverPath: true,
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
 * « Programme mis à jour » sont plausibles à six mois d'intervalle, et faire
 * échouer la seconde pour cela n'aiderait personne.
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

export async function creerNewsletter(editionId: string, input: NewsletterInput, acteur: Actor) {
  const propre = normaliserNewsletter(input);
  const slug = await slugLibre(editionId, propre.titleFr);

  const newsletter = await prisma.newsletter.create({
    data: {
      editionId,
      slug,
      titleFr: propre.titleFr,
      titleEn: propre.titleEn || propre.titleFr,
      excerptFr: propre.excerptFr,
      excerptEn: propre.excerptEn || propre.excerptFr,
      bodyFr: propre.bodyFr,
      bodyEn: propre.bodyEn,
      isPublished: propre.isPublished,
      publishedAt: propre.isPublished ? new Date() : null,
    },
  });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "newsletter.create",
    entity: "Newsletter",
    entityId: newsletter.id,
    after: { slug, titre: newsletter.titleFr, publiee: newsletter.isPublished },
  });

  return newsletter;
}

export async function modifierNewsletter(id: string, input: NewsletterInput, acteur: Actor) {
  const avant = await prisma.newsletter.findUniqueOrThrow({ where: { id } });
  const propre = normaliserNewsletter(input);

  if (avant.sentAt && !propre.isPublished) {
    throw new NewsletterRuleError(
      "Cette newsletter a déjà été envoyée : la dépublier laisserait les liens des e-mails déjà partis pointer vers une page introuvable.",
    );
  }

  const newsletter = await prisma.newsletter.update({
    where: { id },
    data: {
      titleFr: propre.titleFr,
      titleEn: propre.titleEn || propre.titleFr,
      excerptFr: propre.excerptFr,
      excerptEn: propre.excerptEn || propre.excerptFr,
      bodyFr: propre.bodyFr,
      bodyEn: propre.bodyEn,
      isPublished: propre.isPublished,
      // La date de publication marque la **première** mise en ligne : la
      // réécrire à chaque enregistrement ferait remonter en tête de liste une
      // newsletter dont on a corrigé une virgule.
      publishedAt: propre.isPublished ? (avant.publishedAt ?? new Date()) : null,
    },
  });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "newsletter.update",
    entity: "Newsletter",
    entityId: id,
    before: { titre: avant.titleFr, publiee: avant.isPublished },
    after: { titre: newsletter.titleFr, publiee: newsletter.isPublished },
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

  // Les images du corps partent avec elle : plus rien ne les désigne.
  for (const image of lireImages(avant.images)) {
    await fileStorage.delete(image.path).catch(() => undefined);
  }
  if (avant.coverPath) await fileStorage.delete(avant.coverPath).catch(() => undefined);

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

/**
 * Envoi aux participants (§34).
 *
 * Destinataires : les inscrits et les confirmés, hors désistés et annulés —
 * ceux qui ont manifesté leur intérêt et qui attendent des nouvelles. Le
 * message est une **annonce avec lien**, pas le texte intégral : les
 * messageries d'entreprise bloquent les images distantes, et Gmail tronque les
 * longs messages.
 *
 * Un second envoi est refusé. La clé d'idempotence de la file protège déjà des
 * doublons pendant quelques heures, mais elle ne dit rien d'un clic six jours
 * plus tard — la règle est donc en base, dans `sentAt`.
 */
export async function envoyerNewsletter(
  editionId: string,
  id: string,
  acteur: Actor,
): Promise<{ destinataires: number }> {
  const newsletter = await prisma.newsletter.findUniqueOrThrow({ where: { id } });

  if (!newsletter.isPublished) {
    throw new NewsletterRuleError(
      "Publiez la newsletter avant de l'envoyer : le message porte un lien vers sa page.",
    );
  }
  if (newsletter.sentAt) {
    throw new NewsletterRuleError(
      `Déjà envoyée le ${newsletter.sentAt.toLocaleDateString("fr-FR")} à ${newsletter.sentCount} destinataire(s).`,
    );
  }

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const { queued } = await enqueueBulk({
    editionId,
    templateKey: "newsletter_published",
    filter: { statuts: ["REGISTERED", "CONFIRMED", "BADGED", "CHECKED_IN"] },
    variables: {
      titre: newsletter.titleFr,
      chapo: newsletter.excerptFr,
      lien_newsletter: `${baseUrl}/newsletters/${newsletter.slug}`,
    },
    actor: acteur,
  });

  await prisma.newsletter.update({
    where: { id },
    data: { sentAt: new Date(), sentCount: queued },
  });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "newsletter.sent",
    entity: "Newsletter",
    entityId: id,
    after: { slug: newsletter.slug, destinataires: queued },
  });

  return { destinataires: queued };
}

// --- Images du corps -------------------------------------------------------

/**
 * Ajoute une image au corps et renvoie son **rang**.
 *
 * C'est ce rang que l'éditeur inscrit dans le document : jamais le chemin. Le
 * type est déduit des octets et non de l'extension — l'image est publiée, et
 * une extension se renomme.
 */
export async function ajouterImage(
  id: string,
  fichier: File,
  acteur: Actor,
): Promise<{ cle: number }> {
  if (fichier.size === 0) throw new NewsletterRuleError("Aucun fichier reçu.");
  if (fichier.size > IMAGE_NEWSLETTER_MAX_BYTES) {
    throw new NewsletterRuleError(
      `Image trop lourde (maximum ${IMAGE_NEWSLETTER_MAX_BYTES / 1024 / 1024} Mo).`,
    );
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  const detecte = detectImageType(octets);
  if (!detecte) throw new NewsletterRuleError("Format non reconnu (JPEG, PNG ou WebP).");

  const newsletter = await prisma.newsletter.findUniqueOrThrow({
    where: { id },
    select: { images: true },
  });
  const images = lireImages(newsletter.images);

  const chemin = `newsletters/${id}-${randomBytes(6).toString("hex")}.${detecte.extension}`;
  await fileStorage.put(chemin, octets, detecte.type);

  /*
   * L'image est **ajoutée en fin de liste**, jamais insérée : les rangs déjà
   * inscrits dans le document ne doivent pas se décaler. C'est aussi pourquoi
   * une image retirée laisse son emplacement occupé (voir `retirerImage`).
   */
  const suite = [...images, { path: chemin }];
  await prisma.newsletter.update({
    where: { id },
    data: { images: suite as unknown as Prisma.InputJsonValue },
  });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "newsletter.image_added",
    entity: "Newsletter",
    entityId: id,
    after: { cle: suite.length - 1 },
  });

  return { cle: suite.length - 1 };
}

/** URL publique d'une image du corps, par son rang. */
export function urlImage(id: string, cle: number): string {
  return `/api/v1/newsletters/${id}/image/${cle}`;
}
