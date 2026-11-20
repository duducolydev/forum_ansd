import { lireLangue, traduire, type Langue } from "@/lib/langue";
import type { NotificationTemplate, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendMail, type BoiteEnvoi } from "@/lib/mail";
import { audit } from "@/lib/audit";
import type { Actor } from "@/modules/participants/service";
import { resoudreVariablesProgramme, variablesProgrammeUtilisees } from "./recap-programme";
import { variablesDeclarees } from "./catalogue";
import {
  baliserLiens,
  corpsCourriel,
  gabaritCourriel,
  resumeCourriel,
  type PiedCourriel,
} from "./courriel";
import type { TemplateInput } from "./schema";

export type Locale = Langue;

/** Adresse publique du portail, racine de tous les liens d'un message. */
export function adresseDuSite(): string {
  return process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
}

/*
 * Signature du message, lue une fois par édition et gardée cinq minutes.
 *
 * Sans ce cache, une campagne de mille messages ajouterait mille lectures pour
 * un intitulé et deux dates qui ne bougent pas. Avec une péremption courte
 * plutôt qu'aucune : un worker vit des jours, et un lieu corrigé en BackOffice
 * doit finir par apparaître au bas des courriels.
 */
const PEREMPTION_PIED_MS = 5 * 60_000;
const piedsEnCache = new Map<string, { expire: number; edition: PiedCourriel }>();

export async function piedDeCourriel(editionId: string, langue: Locale): Promise<PiedCourriel> {
  const cle = `${editionId}:${langue}`;
  const connu = piedsEnCache.get(cle);
  if (connu && connu.expire > Date.now()) return connu.edition;

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: {
      title: true,
      titleEn: true,
      titlePt: true,
      startDate: true,
      endDate: true,
      venue: true,
      city: true,
    },
  });

  const pied: PiedCourriel = edition
    ? {
        organisation: traduire(langue, {
          fr: "Agence nationale de la Statistique et de la Démographie (ANSD)",
          en: "National Agency for Statistics and Demography (ANSD)",
          pt: "Agência Nacional de Estatística e Demografia (ANSD)",
        }),
        edition: traduire(langue, {
          fr: edition.title,
          en: edition.titleEn,
          pt: edition.titlePt,
        }),
        quand: `${periode(edition.startDate, edition.endDate, langue)} · ${edition.venue}, ${edition.city}`,
      }
    : // Une édition introuvable ne doit pas empêcher un message de partir : le
      // pied se réduit, le corps reste intact.
      { organisation: "ANSD", edition: "", quand: "" };

  piedsEnCache.set(cle, { expire: Date.now() + PEREMPTION_PIED_MS, edition: pied });
  return pied;
}

/** « 23–25 novembre 2026 », en UTC — l'heure de Dakar toute l'année. */
function periode(debut: Date, fin: Date, langue: Locale): string {
  const locale = langue === "fr" ? "fr-FR" : langue === "pt" ? "pt-PT" : "en-GB";
  const jour = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" });
  const complet = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const memeMois =
    debut.getUTCFullYear() === fin.getUTCFullYear() && debut.getUTCMonth() === fin.getUTCMonth();
  return memeMois
    ? `${jour.format(debut)}–${complet.format(fin)}`
    : `${complet.format(debut)} – ${complet.format(fin)}`;
}

/** Variables communes injectées dans tous les modèles, sans que l'appelant ait à les fournir. */
export interface TemplateVariables {
  [key: string]: string;
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

export function interpolate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => variables[key] ?? match);
}

/**
 * Choix de la langue du modèle. Le portail est bilingue et `Participant.locale`
 * est renseigné dès l'inscription : envoyer systématiquement la version
 * française à un participant anglophone était un défaut du squelette initial.
 * Repli sur le français si la version anglaise est vide ; le portugais
 * (30 septembre 2026) retombe sur l'anglais, puis le français.
 */
export function pickLocalised(
  template: Pick<NotificationTemplate, "subjectFr" | "subjectEn" | "bodyFr" | "bodyEn"> &
    Partial<Pick<NotificationTemplate, "subjectPt" | "bodyPt">>,
  locale: Locale,
): { subject: string; body: string } {
  return {
    subject: traduire(locale, {
      fr: template.subjectFr?.trim(),
      en: template.subjectEn?.trim(),
      pt: template.subjectPt?.trim(),
    }),
    body: traduire(locale, { fr: template.bodyFr, en: template.bodyEn, pt: template.bodyPt }),
  };
}

/**
 * Message complet, corps mis en forme et enveloppe du Forum.
 *
 * Deux interpolations et non une : la version **texte** garde les adresses
 * nues — c'est elle que lisent les clients en mode texte — tandis que la
 * version **HTML** reçoit les liens nommés (`baliserLiens`), ce qui donne des
 * boutons intitulés sur les modèles déjà en base, sans les réécrire.
 */
async function composer(options: {
  editionId: string;
  corpsTexte: string;
  variables: TemplateVariables;
  locale: Locale;
  appendHtml?: string;
}): Promise<{ text: string; html: string }> {
  const text = interpolate(options.corpsTexte, options.variables);
  const pourHtml = interpolate(options.corpsTexte, baliserLiens(options.variables, options.locale));

  return {
    text,
    html: gabaritCourriel({
      corps: corpsCourriel(pourHtml),
      langue: options.locale,
      baseUrl: adresseDuSite(),
      pied: await piedDeCourriel(options.editionId, options.locale),
      preheader: resumeCourriel(text),
      appendHtml: options.appendHtml,
    }),
  };
}

/** Rendu d'un modèle sans envoi — prévisualisation et vérification du gabarit. */
export async function renderTemplate(options: {
  editionId: string;
  templateKey: string;
  locale: Locale;
  variables: TemplateVariables;
}): Promise<{ subject: string; body: string; html: string }> {
  const template = await getTemplate(options.editionId, options.templateKey);
  if (!template) {
    throw new Error(`Modèle de notification introuvable : "${options.templateKey}" (EMAIL).`);
  }
  const picked = pickLocalised(template, options.locale);
  const variables = await avecVariablesProgramme(picked, options);
  const subject = interpolate(picked.subject, variables);
  const { text, html } = await composer({
    editionId: options.editionId,
    corpsTexte: picked.body,
    variables,
    locale: options.locale,
  });
  return { subject, body: text, html };
}

/**
 * Les variables de l'appelant, complétées par celles du programme
 * (`{{programme}}`, `{{mes_panels}}`) si le modèle les emploie.
 *
 * Résolues **ici** et non à la mise en file : un rappel J-7 est programmé des
 * semaines à l'avance, et un programme recopié à ce moment-là aurait annoncé
 * des horaires périmés le jour du départ (voir `recap-programme.ts`).
 */
async function avecVariablesProgramme(
  picked: { subject: string; body: string },
  options: {
    editionId: string;
    locale: Locale;
    participantId?: string;
    variables: TemplateVariables;
  },
): Promise<TemplateVariables> {
  const noms = variablesProgrammeUtilisees(`${picked.subject}\n${picked.body}`, options.variables);
  if (noms.length === 0) return options.variables;

  return {
    ...options.variables,
    ...(await resoudreVariablesProgramme({
      editionId: options.editionId,
      participantId: options.participantId,
      langue: options.locale,
      noms,
    })),
  };
}

// ---------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------

/**
 * Envoi d'un e-mail à partir d'un `NotificationTemplate` (brief §5.13).
 * Toujours appelé depuis un job — jamais synchrone dans une requête (§3.3).
 */
export async function sendTemplatedEmail(options: {
  editionId: string;
  templateKey: string;
  to: string;
  variables: TemplateVariables;
  participantId?: string;
  /** Envoi lié à une invitation (destinataire pas encore inscrit) : consigné lui aussi. */
  invitationId?: string;
  /** Forcé par l'appelant ; sinon déduit de `Participant.locale`, sinon `fr`. */
  locale?: Locale;
  /** Ex. pixel de suivi d'ouverture (brief §5.5) — ajouté après le corps du message. */
  appendHtml?: string;
  /** Adresse de réponse (formulaire de contact). */
  replyTo?: string;
  /**
   * Boîte d'envoi (`lib/mail.ts`). Par défaut `transactionnel` : c'est aux
   * quelques points d'entrée qui envoient **en nombre** de se déclarer, pas à
   * la centaine d'envois unitaires de penser à le faire.
   */
  boite?: BoiteEnvoi;
}): Promise<void> {
  const template = await getTemplate(options.editionId, options.templateKey);
  if (!template) {
    throw new Error(`Modèle de notification introuvable : "${options.templateKey}" (EMAIL).`);
  }

  const contexte = await contexteParticipant(options.participantId);
  const locale = options.locale ?? contexte.locale;
  const picked = pickLocalised(template, locale);
  // L'appelant a le dernier mot : un lien signé de confirmation ou de badge
  // doit l'emporter sur l'adresse générique des variables communes.
  const fournies = { ...contexte.variables, ...options.variables };
  const variables = await avecVariablesProgramme(picked, {
    ...options,
    locale,
    variables: fournies,
  });
  const subject = interpolate(picked.subject, variables);
  const { text: body, html } = await composer({
    editionId: options.editionId,
    corpsTexte: picked.body,
    variables,
    locale,
    appendHtml: options.appendHtml,
  });

  let log: { id: string } | undefined;
  // Seuls les envois rattachés à quelqu'un sont consignés : le formulaire de
  // contact et les codes de connexion du BackOffice ne visent ni participant
  // ni invité.
  if (options.participantId || options.invitationId) {
    log = await prisma.notificationLog.create({
      data: {
        participantId: options.participantId,
        invitationId: options.invitationId,
        templateKey: options.templateKey,
        channel: "EMAIL",
        to: options.to,
        status: "QUEUED",
      },
    });
  }

  try {
    const result = await sendMail({
      to: options.to,
      subject,
      html,
      text: body,
      replyTo: options.replyTo,
      boite: options.boite,
    });

    // Le serveur SMTP a accepté la connexion mais refusé ce destinataire :
    // c'est un rebond dur, à distinguer d'une panne d'envoi (brief §5.13).
    const rejected = (result.rejected ?? []).map(String);
    const bounced = rejected.some((address) => address.includes(options.to));

    if (log) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: bounced
          ? { status: "BOUNCED", error: "Destinataire refusé par le serveur SMTP." }
          : { status: "SENT", sentAt: new Date(), providerMessageId: result.messageId },
      });
    }
    if (bounced) {
      throw new Error(`Destinataire refusé : ${options.to}`);
    }
  } catch (error) {
    if (log) {
      await prisma.notificationLog.updateMany({
        // `updateMany` : ne pas écraser un statut BOUNCED déjà posé juste au-dessus.
        where: { id: log.id, status: "QUEUED" },
        data: { status: "FAILED", error: error instanceof Error ? error.message : String(error) },
      });
    }
    throw error;
  }
}

/**
 * Langue **et** variables communes du destinataire, en une seule lecture.
 *
 * Pourquoi des variables communes : ce que chaque modèle reçoit dépendait du
 * seul appelant, et l'oubli était silencieux. `reminders.ts` ne fournissait que
 * `{{prenom}}` ; les rappels J-7 et J-1 partaient donc avec « Téléchargez-le
 * dans votre espace : {{lien_espace}} », `interpolate` laissant intacte toute
 * variable inconnue. Même défaut pour `session_promoted`, dont les trois
 * émetteurs ne passaient que `{{session}}` (17 novembre 2026).
 *
 * Tout destinataire rattaché à un participant reçoit donc d'office son prénom,
 * son nom, son identifiant et les deux liens vers son espace — un émetteur
 * n'ayant plus à y penser, et gardant la main pour les remplacer.
 */
async function contexteParticipant(
  participantId?: string,
): Promise<{ locale: Locale; variables: TemplateVariables }> {
  if (!participantId) return { locale: "fr", variables: {} };

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { locale: true, firstName: true, lastName: true, publicId: true },
  });
  if (!participant) return { locale: "fr", variables: {} };

  const baseUrl = adresseDuSite();
  return {
    locale: lireLangue(participant.locale),
    variables: {
      prenom: participant.firstName,
      nom: participant.lastName,
      identifiant: participant.publicId,
      lien_espace: `${baseUrl}/mon-espace`,
      lien_badge: `${baseUrl}/mon-espace`,
      // Adresses publiques fixes (20 novembre 2026) : fournies d'office, pour
      // qu'un envoi groupé depuis le BackOffice — qui ne passe aucune variable
      // en propre — puisse les employer dans n'importe quel modèle.
      lien_direct: `${baseUrl}/direct`,
      lien_programme: `${baseUrl}/programme`,
    },
  };
}

// ---------------------------------------------------------------------------
// Modèles (BackOffice)
// ---------------------------------------------------------------------------

export async function getTemplate(
  editionId: string,
  key: string,
): Promise<NotificationTemplate | null> {
  return prisma.notificationTemplate.findUnique({
    where: { editionId_key_channel: { editionId, key, channel: "EMAIL" } },
  });
}

export async function listTemplates(editionId: string): Promise<NotificationTemplate[]> {
  return prisma.notificationTemplate.findMany({
    where: { editionId },
    orderBy: [{ channel: "asc" }, { key: "asc" }],
  });
}

export async function updateTemplate(
  editionId: string,
  key: string,
  input: TemplateInput,
  actor: Actor,
): Promise<NotificationTemplate> {
  const before = await getTemplate(editionId, key);
  if (!before) throw new Error(`Modèle introuvable : "${key}".`);

  const updated = await prisma.notificationTemplate.update({
    where: { id: before.id },
    data: {
      subjectFr: input.subjectFr,
      subjectEn: input.subjectEn,
      subjectPt: input.subjectPt || null,
      bodyFr: input.bodyFr,
      bodyEn: input.bodyEn,
      bodyPt: input.bodyPt || null,
    },
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "notification_template.updated",
    entity: "NotificationTemplate",
    entityId: updated.id,
    before: { subjectFr: before.subjectFr, bodyFr: before.bodyFr },
    after: { subjectFr: updated.subjectFr, bodyFr: updated.bodyFr },
  });

  return updated;
}

/**
 * Variables déclarées d'un modèle, pour l'aide à la saisie.
 *
 * Le catalogue (`catalogue.ts`) fait foi : il suit le code qui envoie, alors
 * que la colonne `variables` est figée depuis le premier `seed` — une migration
 * ne rattrape que les modèles jamais retouchés, si bien qu'un modèle corrigé
 * dans le BackOffice se voyait reprocher des variables pourtant remplies. La
 * colonne reste lue en repli, pour un modèle ajouté en base sans passer par le
 * code.
 */
export function templateVariables(
  template: Pick<NotificationTemplate, "key" | "variables">,
): string[] {
  const repli = Array.isArray(template.variables) ? template.variables.map(String) : [];
  return variablesDeclarees(template.key, repli);
}

/**
 * Variables réellement présentes dans les corps mais **non déclarées** : signale
 * à l'éditeur une faute de frappe (`{{prenon}}`) qui, sinon, partirait telle
 * quelle dans l'e-mail — `interpolate` laisse les inconnues intactes.
 */
export function undeclaredVariables(template: {
  bodyFr: string;
  bodyEn: string;
  bodyPt?: string | null;
  subjectFr?: string | null;
  subjectEn?: string | null;
  subjectPt?: string | null;
  declared: string[];
}): string[] {
  const used = new Set<string>();
  const texts = [
    template.bodyFr,
    template.bodyEn,
    template.bodyPt,
    template.subjectFr,
    template.subjectEn,
    template.subjectPt,
  ];
  for (const text of texts) {
    for (const match of (text ?? "").matchAll(/\{\{(\w+)\}\}/g)) {
      used.add(match[1]!);
    }
  }
  return [...used].filter((name) => !template.declared.includes(name)).sort();
}

// ---------------------------------------------------------------------------
// Envoi groupé (brief §5.13)
// ---------------------------------------------------------------------------

export interface BulkFilter {
  status?: string;
  /**
   * Plusieurs statuts à la fois (§34).
   *
   * `status` ne permettait qu'un seul choix, ce qui convient à une campagne
   * ciblée — « relancer les inscrits » — mais pas à une newsletter, qui
   * s'adresse à tous ceux qui ont manifesté leur intérêt, quel que soit
   * l'avancement de leur dossier. Les deux champs cohabitent : `status` reste
   * le filtre simple des écrans existants.
   */
  statuts?: string[];
  categoryId?: string;
  country?: string;
}

export function bulkWhere(editionId: string, filter: BulkFilter): Prisma.ParticipantWhereInput {
  return {
    editionId,
    deletedAt: null,
    ...(filter.status ? { status: filter.status as never } : {}),
    ...(filter.statuts?.length ? { status: { in: filter.statuts as never[] } } : {}),
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    ...(filter.country ? { country: filter.country } : {}),
  };
}

export interface BulkPreview {
  total: number;
  sample: { id: string; firstName: string; lastName: string; email: string; locale: string }[];
}

export async function previewBulk(
  editionId: string,
  filter: BulkFilter,
  sampleSize = 5,
): Promise<BulkPreview> {
  const where = bulkWhere(editionId, filter);
  const [total, sample] = await Promise.all([
    prisma.participant.count({ where }),
    prisma.participant.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true, locale: true },
      orderBy: { lastName: "asc" },
      take: sampleSize,
    }),
  ]);
  return { total, sample };
}
