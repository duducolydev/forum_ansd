import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Contribution } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { detecterImageDeposee } from "@/lib/image-deposee";
import {
  niveauAcces,
  peutCreer,
  peutModifier,
  peutOrdonner,
  peutPublier,
  peutRattacher,
  type NiveauAcces,
  type Verdict,
} from "./droits";
import { detecterDocument, refusDocument } from "./fichier";
import {
  contributionSchema,
  MODELES,
  reconnaitreVideo,
  type ContributionInput,
  type TypeContribution,
} from "./schema";

export class ContributionRuleError extends Error {}

/** Refus lié aux droits, et non aux données : la route le traduit en 403. */
export class ContributionRefusError extends ContributionRuleError {}

/**
 * Qui agit.
 *
 * Les permissions viennent du jeton de session. Le rattachement aux sessions,
 * lui, est relu en base à chaque geste : retirer un rapporteur d'une session
 * prend effet tout de suite, sans attendre qu'il se reconnecte.
 */
export interface Acteur {
  userId: string;
  permissions: readonly string[];
}

/** Niveau d'accès d'un compte à une session (§15). */
export async function niveauPour(acteur: Acteur, sessionId: string): Promise<NiveauAcces> {
  // Le gestionnaire voit toutes les sessions : inutile d'interroger la base.
  if (acteur.permissions.includes("contributions.write")) return "complet";
  if (!acteur.permissions.includes("contributions.draft")) return "aucun";

  const lien = await prisma.sessionRapporteur.findUnique({
    where: { sessionId_userId: { sessionId, userId: acteur.userId } },
    select: { id: true },
  });
  return niveauAcces(acteur.permissions, lien !== null);
}

function exiger(verdict: Verdict): void {
  if (!verdict.autorise) throw new ContributionRefusError(verdict.raison ?? "Action refusée.");
}

/** Accord de l'intervenant, pour une contribution issue de son dépôt. */
async function consentementDe(
  contribution: Pick<Contribution, "origine" | "speakerId">,
): Promise<boolean> {
  if (contribution.origine !== "INTERVENANT" || !contribution.speakerId) return false;
  const speaker = await prisma.speaker.findUnique({
    where: { id: contribution.speakerId },
    select: { presentationConsentement: true },
  });
  return speaker?.presentationConsentement ?? false;
}

/**
 * Contributions d'une session, dans l'ordre d'affichage.
 *
 * Lecture non mise en cache, à dessein : l'écran de saisie et la fiche publique
 * doivent montrer le même état. Une contribution publiée puis invisible une
 * minute ferait douter l'agent de son propre geste — c'est précisément le
 * doute qu'a créé le cache des illustrations (§13.6).
 */
export async function listerParSession(sessionId: string): Promise<Contribution[]> {
  return prisma.contribution.findMany({
    where: { sessionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function listerPubliees(sessionId: string): Promise<Contribution[]> {
  return prisma.contribution.findMany({
    where: { sessionId, isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function trouver(id: string): Promise<Contribution | null> {
  return prisma.contribution.findUnique({ where: { id } });
}

/** Sessions ayant au moins une contribution publiée, pour la page publique. */
export async function sessionsCapitalisees(editionId: string) {
  return prisma.session.findMany({
    where: {
      editionId,
      isPublished: true,
      contributions: { some: { isPublished: true } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      slug: true,
      titleFr: true,
      theme: true,
      day: true,
      startTime: true,
      type: true,
      contributions: {
        where: { isPublished: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, type: true, title: true, filePath: true, url: true },
      },
    },
  });
}

/**
 * Sessions de l'écran « Contributions » du BackOffice.
 *
 * Toutes pour le gestionnaire ; pour le rapporteur, celles auxquelles il est
 * rattaché et **elles seules** — les autres ne lui sont pas même nommées.
 */
export async function sessionsDeContribution(editionId: string, acteur: Acteur) {
  const toutes = acteur.permissions.includes("contributions.write");
  if (!toutes && !acteur.permissions.includes("contributions.draft")) return [];

  return prisma.session.findMany({
    where: {
      editionId,
      // Suppression douce : une session supprimée n'a plus rien à capitaliser.
      deletedAt: null,
      ...(toutes ? {} : { rapporteurs: { some: { userId: acteur.userId } } }),
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      titleFr: true,
      day: true,
      startTime: true,
      isPublished: true,
      contributions: { select: { isPublished: true, origine: true } },
      rapporteurs: {
        orderBy: { createdAt: "asc" },
        select: { user: { select: { name: true } } },
      },
    },
  });
}

/** Vrai si le compte peut voir les brouillons de cette session. */
export async function peutVoirBrouillons(acteur: Acteur | null, sessionId: string) {
  if (!acteur) return false;
  return (await niveauPour(acteur, sessionId)) !== "aucun";
}

/**
 * Accord de publication des intervenants ayant déposé, par identifiant, pour
 * que l'écran de gestion dise d'emblée ce qui peut être publié.
 */
export async function consentementsDesIntervenants(
  contributions: readonly Pick<Contribution, "origine" | "speakerId">[],
): Promise<Record<string, boolean>> {
  const ids = [
    ...new Set(
      contributions
        .filter((contribution) => contribution.origine === "INTERVENANT")
        .map((contribution) => contribution.speakerId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return {};

  const speakers = await prisma.speaker.findMany({
    where: { id: { in: ids } },
    select: { id: true, presentationConsentement: true },
  });
  return Object.fromEntries(
    speakers.map((speaker) => [speaker.id, speaker.presentationConsentement]),
  );
}

function invalider(slug?: string): void {
  revalidatePath("/contributions");
  if (slug) revalidatePath(`/programme/${slug}`);
}

async function rangSuivant(sessionId: string): Promise<number> {
  const dernier = await prisma.contribution.aggregate({
    where: { sessionId },
    _max: { sortOrder: true },
  });
  return (dernier._max.sortOrder ?? 0) + 10;
}

/** Vérifie la cohérence entre le type choisi et ce qui est fourni. */
function verifierSelonLeType(input: ContributionInput): void {
  const modele = MODELES[input.type as TypeContribution];

  if (modele.lien) {
    if (!input.url) throw new ContributionRuleError("Une vidéo demande un lien.");
    if (!reconnaitreVideo(input.url)) {
      throw new ContributionRuleError(
        "Lien vidéo non reconnu. Seuls YouTube et Vimeo sont acceptés, en https.",
      );
    }
  } else if (input.url) {
    throw new ContributionRuleError("Ce type de contribution n'accepte pas de lien.");
  }
}

export async function creer(
  editionId: string,
  brut: unknown,
  acteur: Acteur,
): Promise<Contribution> {
  const input = contributionSchema.parse(brut);
  verifierSelonLeType(input);

  const session = await prisma.session.findFirst({
    where: { id: input.sessionId, editionId },
    select: { id: true, slug: true },
  });
  if (!session) throw new ContributionRuleError("Session introuvable.");

  const niveau = await niveauPour(acteur, session.id);
  exiger(peutCreer(niveau));
  const origine = niveau === "rapporteur" ? "RAPPORTEUR" : "COMITE";

  // Le rapporteur ne voit pas la case « Publier ». Si elle arrive cochée, le
  // formulaire a été forgé : la réponse est un refus, pas une correction muette.
  if (input.isPublished) exiger(peutPublier(niveau, { isPublished: false, origine }, false));

  const contribution = await prisma.contribution.create({
    data: {
      editionId,
      sessionId: input.sessionId,
      type: input.type,
      title: input.title,
      body: input.body || null,
      url: input.url || null,
      speakerId: input.speakerId || null,
      isPublished: input.isPublished,
      origine,
      sortOrder: await rangSuivant(input.sessionId),
    },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "contribution.created",
    entity: "Contribution",
    entityId: contribution.id,
    after: { type: contribution.type, title: contribution.title, origine },
  });

  invalider(session.slug);
  return contribution;
}

export async function modifier(id: string, brut: unknown, acteur: Acteur): Promise<Contribution> {
  const avant = await trouver(id);
  if (!avant) throw new ContributionRuleError("Contribution introuvable.");

  const niveau = await niveauPour(acteur, avant.sessionId);
  exiger(peutModifier(niveau, avant));

  /*
   * La session n'est pas modifiable : une contribution appartient à la séance
   * où elle a été dite. La déplacer serait une autre opération, explicite.
   *
   * Pour une présentation d'intervenant, le type et l'intervenant désigné ne le
   * sont pas davantage : l'accord de publication porte sur ce support et sur
   * cette personne. Changer l'intervenant suffirait sinon à publier sous
   * l'accord d'un autre.
   */
  const verrous =
    avant.origine === "INTERVENANT" ? { type: avant.type, speakerId: avant.speakerId ?? "" } : {};
  const input = contributionSchema.parse({
    ...(brut as Record<string, unknown>),
    sessionId: avant.sessionId,
    ...verrous,
  });
  verifierSelonLeType(input);

  if (input.isPublished) exiger(peutPublier(niveau, avant, await consentementDe(avant)));

  const apres = await prisma.contribution.update({
    where: { id },
    data: {
      type: input.type,
      title: input.title,
      body: input.body || null,
      url: input.url || null,
      speakerId: input.speakerId || null,
      isPublished: input.isPublished,
    },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "contribution.updated",
    entity: "Contribution",
    entityId: id,
    before: { type: avant.type, isPublished: avant.isPublished },
    after: { type: apres.type, isPublished: apres.isPublished },
  });

  const session = await prisma.session.findUnique({
    where: { id: apres.sessionId },
    select: { slug: true },
  });
  invalider(session?.slug);
  return apres;
}

export async function supprimer(id: string, acteur: Acteur): Promise<void> {
  const avant = await trouver(id);
  if (!avant) return;

  exiger(peutModifier(await niveauPour(acteur, avant.sessionId), avant));

  await prisma.contribution.delete({ where: { id } });

  // Le fichier part **après** la suppression en base : dans l'autre ordre, un
  // échec laisserait une contribution pointant vers un fichier disparu.
  if (avant.filePath) await fileStorage.delete(avant.filePath).catch(() => undefined);

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "contribution.deleted",
    entity: "Contribution",
    entityId: id,
    before: { type: avant.type, title: avant.title, origine: avant.origine },
  });

  const session = await prisma.session.findUnique({
    where: { id: avant.sessionId },
    select: { slug: true },
  });
  invalider(session?.slug);
}

/** Déplace une contribution d'un cran, en échangeant son rang avec sa voisine. */
export async function deplacer(id: string, sens: "haut" | "bas", acteur: Acteur): Promise<void> {
  const courante = await trouver(id);
  if (!courante) return;

  exiger(peutOrdonner(await niveauPour(acteur, courante.sessionId)));

  const voisine = await prisma.contribution.findFirst({
    where: {
      sessionId: courante.sessionId,
      sortOrder: sens === "haut" ? { lt: courante.sortOrder } : { gt: courante.sortOrder },
    },
    orderBy: { sortOrder: sens === "haut" ? "desc" : "asc" },
  });
  if (!voisine) return;

  await prisma.$transaction([
    prisma.contribution.update({
      where: { id: courante.id },
      data: { sortOrder: voisine.sortOrder },
    }),
    prisma.contribution.update({
      where: { id: voisine.id },
      data: { sortOrder: courante.sortOrder },
    }),
  ]);

  const session = await prisma.session.findUnique({
    where: { id: courante.sessionId },
    select: { slug: true },
  });
  invalider(session?.slug);
}

/**
 * Enregistre le fichier d'une contribution.
 *
 * Appelée depuis une **route** et non depuis une Server Action : le brief
 * autorise 50 Mo, les Server Actions s'arrêtent à 3 Mo et rejettent au-delà
 * sans message (§13.7).
 */
export async function deposerFichier(
  id: string,
  octets: Buffer,
  acteur: Acteur,
): Promise<Contribution> {
  const avant = await trouver(id);
  if (!avant) throw new ContributionRuleError("Contribution introuvable.");

  exiger(peutModifier(await niveauPour(acteur, avant.sessionId), avant));

  // Le support d'un intervenant se remplace depuis son espace, par lui : c'est
  // ce fichier-là, et aucun autre, que couvre son accord de publication.
  if (avant.origine === "INTERVENANT") {
    throw new ContributionRefusError(
      "Cette présentation se remplace depuis l'espace de l'intervenant.",
    );
  }

  const modele = MODELES[avant.type as TypeContribution];
  if (modele.fichier === "aucun") {
    throw new ContributionRuleError("Ce type de contribution n'accepte pas de fichier.");
  }

  let extension: string;
  let typeMime: string;

  if (modele.fichier === "image") {
    const detecte = detecterImageDeposee(octets);
    if (!detecte.type) throw new ContributionRuleError(detecte.refus ?? "Image non reconnue.");
    extension = detecte.type.extension;
    typeMime = detecte.type.type;
  } else {
    const detecte = detecterDocument(octets);
    if (!detecte) throw new ContributionRuleError(refusDocument());
    extension = detecte.extension;
    typeMime = detecte.type;
  }

  const chemin = `contributions/${id}-${randomBytes(6).toString("hex")}.${extension}`;
  await fileStorage.put(chemin, octets, typeMime);

  const apres = await prisma.contribution.update({ where: { id }, data: { filePath: chemin } });

  if (avant.filePath && avant.filePath !== chemin) {
    await fileStorage.delete(avant.filePath).catch(() => undefined);
  }

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "contribution.file_uploaded",
    entity: "Contribution",
    entityId: id,
    after: { bytes: octets.length, type: typeMime },
  });

  const session = await prisma.session.findUnique({
    where: { id: apres.sessionId },
    select: { slug: true },
  });
  invalider(session?.slug);
  return apres;
}

// ---------------------------------------------------------------------------
// Rapporteurs
// ---------------------------------------------------------------------------

export interface CompteRapporteur {
  id: string;
  nom: string;
  email: string;
}

function permissionsDuRole(valeur: unknown): string[] {
  return Array.isArray(valeur)
    ? valeur.filter((permission): permission is string => typeof permission === "string")
    : [];
}

/**
 * Comptes qu'on peut rattacher à une session : actifs, et dont le rôle porte
 * `contributions.draft`.
 *
 * Filtré après lecture plutôt qu'en SQL : les permissions d'un rôle sont une
 * colonne JSON, et le BackOffice les ajuste — un rôle renommé ou un rôle
 * personnalisé doté de cette permission est donc reconnu, là où un filtre sur
 * le nom « RAPPORTEUR » l'ignorerait.
 *
 * Un gestionnaire (`contributions.write`) n'est pas proposé : il voit déjà
 * toutes les sessions, et le rattacher laisserait croire le contraire.
 */
export async function comptesRapporteurs(): Promise<CompteRapporteur[]> {
  const comptes = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: { select: { permissions: true } } },
  });

  return comptes
    .filter((compte) => {
      const permissions = permissionsDuRole(compte.role.permissions);
      return (
        permissions.includes("contributions.draft") && !permissions.includes("contributions.write")
      );
    })
    .map((compte) => ({ id: compte.id, nom: compte.name, email: compte.email }));
}

export async function rapporteursDeSession(sessionId: string): Promise<CompteRapporteur[]> {
  const liens = await prisma.sessionRapporteur.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  return liens.map(({ user }) => ({ id: user.id, nom: user.name, email: user.email }));
}

export async function rattacherRapporteur(
  sessionId: string,
  userId: string,
  acteur: Acteur,
): Promise<void> {
  exiger(peutRattacher(await niveauPour(acteur, sessionId)));

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) throw new ContributionRuleError("Session introuvable.");

  const eligibles = await comptesRapporteurs();
  if (!eligibles.some((compte) => compte.id === userId)) {
    throw new ContributionRuleError("Ce compte n'a pas le rôle Rapporteur, ou il est désactivé.");
  }

  await prisma.sessionRapporteur.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    update: {},
    create: { sessionId, userId },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "contribution.rapporteur_attached",
    entity: "Session",
    entityId: sessionId,
    after: { userId },
  });
}

export async function retirerRapporteur(
  sessionId: string,
  userId: string,
  acteur: Acteur,
): Promise<void> {
  exiger(peutRattacher(await niveauPour(acteur, sessionId)));

  // Ce que le rapporteur a rédigé reste en place : c'est le travail de la
  // session, pas celui du compte.
  const { count } = await prisma.sessionRapporteur.deleteMany({ where: { sessionId, userId } });
  if (count === 0) return;

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "contribution.rapporteur_detached",
    entity: "Session",
    entityId: sessionId,
    before: { userId },
  });
}

// ---------------------------------------------------------------------------
// Dépôts des intervenants
// ---------------------------------------------------------------------------

/**
 * Relie la présentation d'un intervenant aux contributions de ses sessions.
 *
 * Une contribution « Présentation » par session où il intervient, créée au
 * premier dépôt et mise à jour aux suivants. Elle naît **en brouillon**, et un
 * nouveau fichier l'y ramène : le comité a validé un support, pas celui qui
 * l'a remplacé depuis.
 *
 * Le fichier est **copié**, pas partagé avec celui de l'espace intervenant.
 * Les deux vivent chacun leur vie — l'intervenant remplace le sien, le
 * gestionnaire supprime une contribution — et un chemin commun ferait qu'effacer
 * l'un effacerait l'autre.
 *
 * Renvoie le nombre de sessions reliées.
 */
export async function relierPresentationIntervenant(
  speakerId: string,
  octets: Buffer,
): Promise<number> {
  const speaker = await prisma.speaker.findUnique({
    where: { id: speakerId },
    select: {
      id: true,
      editionId: true,
      firstName: true,
      lastName: true,
      // Une session supprimée (suppression douce) ne reçoit plus rien.
      sessions: {
        where: { session: { deletedAt: null } },
        select: { session: { select: { id: true, slug: true } } },
      },
    },
  });
  if (!speaker) return 0;

  for (const { session } of speaker.sessions) {
    await deposerDansSession(speaker, session, octets);
  }

  return speaker.sessions.length;
}

interface AuteurPresentation {
  id: string;
  editionId: string;
  firstName: string;
  lastName: string;
}

/** Crée ou met à jour, dans une session, la contribution issue du dépôt. */
async function deposerDansSession(
  speaker: AuteurPresentation,
  session: { id: string; slug: string },
  octets: Buffer,
): Promise<void> {
  const existante = await prisma.contribution.findFirst({
    where: { sessionId: session.id, speakerId: speaker.id, origine: "INTERVENANT" },
  });

  const contribution =
    existante ??
    (await prisma.contribution.create({
      data: {
        editionId: speaker.editionId,
        sessionId: session.id,
        speakerId: speaker.id,
        origine: "INTERVENANT",
        type: "PRESENTATION",
        title: `Présentation — ${speaker.firstName} ${speaker.lastName}`,
        isPublished: false,
        sortOrder: await rangSuivant(session.id),
      },
    }));

  const chemin = `contributions/${contribution.id}-${randomBytes(6).toString("hex")}.pdf`;
  await fileStorage.put(chemin, octets, "application/pdf");
  await prisma.contribution.update({
    where: { id: contribution.id },
    data: { filePath: chemin, isPublished: false },
  });

  if (existante?.filePath && existante.filePath !== chemin) {
    await fileStorage.delete(existante.filePath).catch(() => undefined);
  }

  await audit.log({
    actorType: "SYSTEM",
    action: existante
      ? "contribution.speaker_presentation_replaced"
      : "contribution.speaker_presentation_linked",
    entity: "Contribution",
    entityId: contribution.id,
    after: {
      speakerId: speaker.id,
      bytes: octets.length,
      retireeDuSite: existante?.isPublished ?? false,
    },
  });

  invalider(session.slug);
}

/**
 * Rattachement **après** dépôt (§15.9).
 *
 * Un intervenant peut déposer sa présentation avant que le comité ne l'ait mis
 * au programme. Quand il est ensuite rattaché à une session, sa présentation
 * doit y paraître comme s'il l'avait déposée après : c'est ce qui manquait, et
 * ce qui rendait le dépôt invisible.
 *
 * Une contribution déjà présente n'est pas touchée : la remplacer la ramènerait
 * en brouillon, peut-être après sa publication. Renvoie vrai si elle a été créée.
 */
export async function ajouterPresentationASession(
  speakerId: string,
  sessionId: string,
): Promise<boolean> {
  const speaker = await prisma.speaker.findFirst({
    where: { id: speakerId, deletedAt: null },
    select: { id: true, editionId: true, firstName: true, lastName: true, presentationPath: true },
  });
  if (!speaker?.presentationPath) return false;

  const session = await prisma.session.findFirst({
    where: { id: sessionId, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!session) return false;

  const existante = await prisma.contribution.findFirst({
    where: { sessionId, speakerId, origine: "INTERVENANT" },
    select: { id: true },
  });
  if (existante) return false;

  let octets: Buffer;
  try {
    octets = await fileStorage.get(speaker.presentationPath);
  } catch {
    return false;
  }

  await deposerDansSession(speaker, session, octets);
  return true;
}

/**
 * Retrait d'un intervenant d'une session : sa présentation en sort aussi, si
 * elle n'y est qu'en brouillon.
 *
 * En ligne, elle reste : le comité l'a validée et publiée, et la retirer du site
 * est une décision à prendre sur l'écran des contributions, pas l'effet de bord
 * d'un changement de programme.
 */
export async function retirerPresentationDeSession(
  speakerId: string,
  sessionId: string,
): Promise<"retiree" | "conservee" | "aucune"> {
  const contribution = await prisma.contribution.findFirst({
    where: { sessionId, speakerId, origine: "INTERVENANT" },
    select: { id: true, isPublished: true, filePath: true, session: { select: { slug: true } } },
  });
  if (!contribution) return "aucune";
  if (contribution.isPublished) return "conservee";

  await prisma.contribution.delete({ where: { id: contribution.id } });
  if (contribution.filePath) {
    await fileStorage.delete(contribution.filePath).catch(() => undefined);
  }

  await audit.log({
    actorType: "SYSTEM",
    action: "contribution.speaker_presentation_detached",
    entity: "Contribution",
    entityId: contribution.id,
    before: { speakerId, sessionId },
  });

  invalider(contribution.session.slug);
  return "retiree";
}

/**
 * Présentations déposées par des intervenants rattachés à aucune session : elles
 * ne figurent dans aucune contribution, et le gestionnaire doit le voir.
 */
export async function presentationsEnAttenteDeSession(editionId: string) {
  return prisma.speaker.findMany({
    where: {
      editionId,
      deletedAt: null,
      presentationPath: { not: null },
      sessions: { none: { session: { deletedAt: null } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      organization: true,
      presentationConsentement: true,
    },
  });
}

/**
 * Retire du site les présentations d'un intervenant qui a retiré son accord.
 *
 * Un accord qu'on retire sans effet n'en est pas un : ce qui était en ligne
 * repasse en brouillon, sur-le-champ.
 */
export async function retirerPresentationsDuSite(speakerId: string): Promise<void> {
  const enLigne = await prisma.contribution.findMany({
    where: { speakerId, origine: "INTERVENANT", isPublished: true },
    select: { id: true, session: { select: { slug: true } } },
  });
  if (enLigne.length === 0) return;

  await prisma.contribution.updateMany({
    where: { id: { in: enLigne.map((contribution) => contribution.id) } },
    data: { isPublished: false },
  });

  for (const contribution of enLigne) {
    await audit.log({
      actorType: "SYSTEM",
      action: "contribution.unpublished_consent_withdrawn",
      entity: "Contribution",
      entityId: contribution.id,
      after: { speakerId },
    });
    invalider(contribution.session.slug);
  }
}
