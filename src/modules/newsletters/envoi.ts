import { Prisma } from "@prisma/client";
import { LANGUES, lireLangue, traduire } from "@/lib/langue";
import { ENVOIS_PAR_MINUTE } from "@/lib/cadence-envoi";
import { BOITES, compteBoite, quotaJourBoite, type BoiteEnvoi } from "@/lib/mail";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { enqueueNotifications } from "@/modules/notifications/jobs";
import { boitePourModele } from "@/modules/notifications/boites";
import type { Actor } from "@/modules/participants/service";
import {
  planifierEnvoi,
  RepartitionImpossible,
  type CompteEnvoi,
  type Lot,
  type Reservation,
} from "./repartition";
import { NewsletterRuleError, type Ciblage } from "./schema";
import { publierNewsletter, urlFichier } from "./service";

/**
 * Envoi d'une newsletter aux participants (25 novembre 2026).
 *
 * L'annonce part **à la publication**, d'un seul geste : « Publier et
 * envoyer ». Ce n'est pas un effet de bord d'enregistrement — le bouton dit sa
 * portée (« … à 812 participants ») et demande confirmation —, et il ne peut
 * servir qu'une fois : `sentAt` est posé avant la mise en file, par une
 * écriture conditionnelle qui fait échouer le second clic.
 *
 * Les destinataires sont répartis entre les boîtes retenues
 * (`repartition.ts`) : chaque compte dans la limite de son quota du jour, le
 * reste programmé les jours suivants.
 */

/**
 * Part du quota quotidien laissée aux autres envois.
 *
 * La boîte des accès porte aussi les liens de connexion et les badges, celle de
 * la participation les confirmations : une newsletter ne doit pas les assécher.
 */
export const RESERVE_QUOTA = 0.2;

/** Statuts du journal qui ont consommé du quota. Un échec n'a rien coûté. */
const STATUTS_CONSOMMES = ["QUEUED", "SENT", "BOUNCED"] as const;

export interface BoiteDisponible {
  boite: BoiteEnvoi;
  libelle: string;
  sert: string;
  cle: string;
  adresse: string;
  quota: number;
  plafond: number;
  dejaUtilise: number;
  /** Boîte repliée sur le compte d'une autre : sa capacité n'est pas en plus. */
  partageAvec: BoiteEnvoi | null;
}

/**
 * Messages partis sur vingt-quatre heures, par compte.
 *
 * Les lignes antérieures au 25 novembre n'ont pas de boîte : elle se déduit
 * alors du modèle, ce qui est juste sauf pour les rares envois qui forçaient la
 * leur.
 */
async function consommationParCompte(): Promise<Map<string, number>> {
  const depuis = new Date(Date.now() - 24 * 3600_000);
  const lignes = await prisma.notificationLog.groupBy({
    by: ["boite", "templateKey"],
    where: { createdAt: { gte: depuis }, status: { in: [...STATUTS_CONSOMMES] } },
    _count: { _all: true },
  });

  const parCompte = new Map<string, number>();
  for (const ligne of lignes) {
    const boite = (ligne.boite as BoiteEnvoi | null) ?? boitePourModele(ligne.templateKey);
    const cle = compteBoite(boite in BOITES ? boite : "transactionnel").cle;
    parCompte.set(cle, (parCompte.get(cle) ?? 0) + ligne._count._all);
  }
  return parCompte;
}

/** Les boîtes, leur compte réel, leur quota et ce qu'elles ont déjà envoyé. */
export async function boitesDisponibles(): Promise<BoiteDisponible[]> {
  const consommation = await consommationParCompte();
  const vues = new Map<string, BoiteEnvoi>();

  return (Object.keys(BOITES) as BoiteEnvoi[]).map((boite) => {
    const { cle, adresse } = compteBoite(boite);
    const quota = quotaJourBoite(boite);
    const partageAvec = vues.get(cle) ?? null;
    if (!partageAvec) vues.set(cle, boite);
    return {
      boite,
      libelle: BOITES[boite].libelle,
      sert: BOITES[boite].sert,
      cle,
      adresse,
      quota,
      plafond: Math.floor(quota * (1 - RESERVE_QUOTA)),
      dejaUtilise: consommation.get(cle) ?? 0,
      partageAvec,
    };
  });
}

/** Plan d'envoi enregistré avec une newsletter. */
export function lireLots(brut: unknown): Lot[] {
  if (!brut || typeof brut !== "object" || !("lots" in brut)) return [];
  const lots = (brut as { lots: unknown }).lots;
  return Array.isArray(lots) ? (lots as Lot[]) : [];
}

/** Lots des autres newsletters encore en cours ou à venir, à déduire des capacités. */
async function reservationsEnCours(editionId: string, saufId: string): Promise<Reservation[]> {
  const depuis = new Date(Date.now() - 24 * 3600_000);
  const autres = await prisma.newsletter.findMany({
    where: { editionId, id: { not: saufId }, sentAt: { not: null } },
    select: { envoi: true },
  });
  return autres
    .flatMap((autre) => lireLots(autre.envoi))
    .map((lot) => ({ cle: lot.cle, debut: new Date(lot.debut), nombre: lot.nombre }))
    .filter((reservation) => reservation.debut > depuis);
}

function filtreDestinataires(editionId: string, ciblage: Ciblage): Prisma.ParticipantWhereInput {
  return {
    editionId,
    deletedAt: null,
    status: { in: [...ciblage.statuts] },
    ...(ciblage.categoryIds.length ? { categoryId: { in: ciblage.categoryIds } } : {}),
  };
}

function comptesRetenus(boites: BoiteDisponible[], ciblage: Ciblage): CompteEnvoi[] {
  return boites
    .filter((boite) => ciblage.boites.includes(boite.boite))
    .map((boite) => ({
      cle: boite.cle,
      boite: boite.boite,
      adresse: boite.adresse,
      plafond: boite.plafond,
      dejaUtilise: boite.dejaUtilise,
    }));
}

export interface ApercuEnvoi {
  destinataires: number;
  lots: Lot[];
  jours: number;
  /** Boîtes cochées qui partagent le compte d'une autre cochée : sans effet. */
  doublons: BoiteEnvoi[];
  erreur?: string;
}

/** Ce que l'envoi ferait, sans rien envoyer : nombre et plan par boîte et par jour. */
export async function apercuEnvoi(
  editionId: string,
  newsletterId: string,
  ciblage: Ciblage,
): Promise<ApercuEnvoi> {
  const [destinataires, boites, reservations] = await Promise.all([
    prisma.participant.count({ where: filtreDestinataires(editionId, ciblage) }),
    boitesDisponibles(),
    reservationsEnCours(editionId, newsletterId),
  ]);

  const comptes = comptesRetenus(boites, ciblage);
  const doublons = comptes
    .filter((compte, index) => comptes.findIndex((autre) => autre.cle === compte.cle) !== index)
    .map((compte) => compte.boite);

  try {
    const plan = planifierEnvoi(destinataires, comptes, new Date(), {
      envoisParMinute: ENVOIS_PAR_MINUTE,
      reservations,
    });
    return { destinataires, lots: plan.lots, jours: plan.jours, doublons };
  } catch (erreur) {
    if (!(erreur instanceof RepartitionImpossible)) throw erreur;
    return { destinataires, lots: [], jours: 0, doublons, erreur: erreur.message };
  }
}

/**
 * Publie (si besoin) et envoie.
 *
 * Les destinataires sont pris dans l'ordre des catégories (`sortOrder`) : si
 * l'envoi s'étale sur plusieurs jours, ce sont les premières catégories qui
 * reçoivent le premier jour.
 */
export async function publierEtEnvoyer(
  editionId: string,
  id: string,
  ciblage: Ciblage,
  acteur: Actor,
): Promise<{ destinataires: number; lots: Lot[]; jours: number }> {
  const avant = await prisma.newsletter.findUniqueOrThrow({ where: { id } });
  if (avant.sentAt) {
    throw new NewsletterRuleError(
      `Déjà envoyée le ${avant.sentAt.toLocaleDateString("fr-FR")} à ${avant.sentCount} destinataire(s).`,
    );
  }
  if (!avant.filePath) {
    throw new NewsletterRuleError("Déposez le fichier PDF avant d'envoyer la newsletter.");
  }

  const [destinataires, boites, reservations] = await Promise.all([
    prisma.participant.findMany({
      where: filtreDestinataires(editionId, ciblage),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        publicId: true,
        locale: true,
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
    }),
    boitesDisponibles(),
    reservationsEnCours(editionId, id),
  ]);
  if (destinataires.length === 0) {
    throw new NewsletterRuleError("Aucun participant ne correspond à ces critères.");
  }

  let plan;
  try {
    plan = planifierEnvoi(destinataires.length, comptesRetenus(boites, ciblage), new Date(), {
      envoisParMinute: ENVOIS_PAR_MINUTE,
      reservations,
    });
  } catch (erreur) {
    if (erreur instanceof RepartitionImpossible) throw new NewsletterRuleError(erreur.message);
    throw erreur;
  }

  const newsletter = await publierNewsletter(id, acteur);

  // Le verrou : une écriture conditionnelle. Deux clics simultanés ne posent
  // `sentAt` qu'une fois, et le second s'arrête ici.
  const verrou = await prisma.newsletter.updateMany({
    where: { id, sentAt: null },
    data: { sentAt: new Date(), sentCount: destinataires.length },
  });
  if (verrou.count === 0) {
    throw new NewsletterRuleError("Cette newsletter vient d'être envoyée.");
  }

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const communes = {
    lien_newsletter: `${baseUrl}/newsletters/${newsletter.slug}`,
    lien_fichier: `${baseUrl}${urlFichier(id)}`,
    lien_espace: `${baseUrl}/mon-espace`,
  };
  const parLangue = Object.fromEntries(
    LANGUES.map((langue) => [
      langue,
      {
        titre: traduire(langue, {
          fr: newsletter.titleFr,
          en: newsletter.titleEn,
          pt: newsletter.titlePt,
        }),
        chapo: traduire(langue, {
          fr: newsletter.excerptFr,
          en: newsletter.excerptEn,
          pt: newsletter.excerptPt,
        }),
      },
    ]),
  );

  try {
    await enqueueNotifications(
      destinataires.map((destinataire, index) => ({
        payload: {
          editionId,
          templateKey: "newsletter_published",
          to: destinataire.email,
          participantId: destinataire.id,
          boite: plan.affectations[index]!.boite,
          variables: {
            prenom: destinataire.firstName,
            nom: destinataire.lastName,
            identifiant: destinataire.publicId,
            ...communes,
            ...parLangue[lireLangue(destinataire.locale)],
          },
        },
        idempotencyKey: `newsletter-${id}-${destinataire.id}`,
        runAt: plan.affectations[index]!.runAt,
      })),
    );
  } catch (erreur) {
    // Rien n'est parti : le verrou est levé pour qu'un nouvel essai soit possible.
    await prisma.newsletter.update({ where: { id }, data: { sentAt: null, sentCount: 0 } });
    throw erreur;
  }

  await prisma.newsletter.update({
    where: { id },
    data: {
      audience: { categoryIds: ciblage.categoryIds, statuts: ciblage.statuts },
      envoi: { lots: plan.lots, jours: plan.jours } as unknown as Prisma.InputJsonValue,
    },
  });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "newsletter.sent",
    entity: "Newsletter",
    entityId: id,
    after: {
      slug: newsletter.slug,
      destinataires: destinataires.length,
      categories: ciblage.categoryIds,
      statuts: ciblage.statuts,
      lots: plan.lots.map((lot) => ({ boite: lot.boite, jour: lot.jour, nombre: lot.nombre })),
    },
  });

  return { destinataires: destinataires.length, lots: plan.lots, jours: plan.jours };
}

/**
 * Avancement de l'envoi, lu dans le journal : destinataires servis, en échec,
 * et encore à venir.
 *
 * Compté **par destinataire** et non par ligne : un message refusé faute de
 * quota laisse une ligne en échec puis une ligne envoyée au report suivant, et
 * ne doit compter qu'une fois, comme servi. Si deux newsletters partent en même
 * temps, leurs lignes se confondent — le modèle est le même — et les chiffres
 * deviennent approximatifs.
 */
export async function avancementEnvoi(newsletter: {
  sentAt: Date | null;
  sentCount: number;
}): Promise<{ partis: number; echecs: number; restants: number } | null> {
  if (!newsletter.sentAt) return null;
  const lignes = await prisma.notificationLog.findMany({
    where: {
      templateKey: "newsletter_published",
      createdAt: { gte: newsletter.sentAt },
      participantId: { not: null },
    },
    select: { participantId: true, status: true },
  });

  const servis = new Set<string>();
  const enEchec = new Set<string>();
  for (const ligne of lignes) {
    if (ligne.status === "SENT") servis.add(ligne.participantId!);
    else if (ligne.status === "FAILED" || ligne.status === "BOUNCED") {
      enEchec.add(ligne.participantId!);
    }
  }
  const partis = Math.min(servis.size, newsletter.sentCount);
  const echecs = [...enEchec].filter((id) => !servis.has(id)).length;
  return { partis, echecs, restants: Math.max(0, newsletter.sentCount - partis - echecs) };
}
