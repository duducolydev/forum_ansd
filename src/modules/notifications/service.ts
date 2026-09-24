import type { NotificationTemplate, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { audit } from "@/lib/audit";
import type { Actor } from "@/modules/participants/service";
import type { TemplateInput } from "./schema";

export type Locale = "fr" | "en";

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
 * Repli sur le français si la version anglaise est vide.
 */
export function pickLocalised(
  template: Pick<NotificationTemplate, "subjectFr" | "subjectEn" | "bodyFr" | "bodyEn">,
  locale: Locale,
): { subject: string; body: string } {
  if (locale === "en") {
    return {
      subject: template.subjectEn?.trim() || template.subjectFr?.trim() || "",
      body: template.bodyEn?.trim() || template.bodyFr,
    };
  }
  return { subject: template.subjectFr?.trim() || "", body: template.bodyFr };
}

export function renderHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<p>&nbsp;</p>"))
    .join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Rendu d'un modèle sans envoi — utilisé par la prévisualisation du BackOffice. */
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
  const subject = interpolate(picked.subject, options.variables);
  const body = interpolate(picked.body, options.variables);
  return { subject, body, html: renderHtml(body) };
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
  /** Forcé par l'appelant ; sinon déduit de `Participant.locale`, sinon `fr`. */
  locale?: Locale;
  /** Ex. pixel de suivi d'ouverture (brief §5.5) — ajouté après le corps du message. */
  appendHtml?: string;
}): Promise<void> {
  const template = await getTemplate(options.editionId, options.templateKey);
  if (!template) {
    throw new Error(`Modèle de notification introuvable : "${options.templateKey}" (EMAIL).`);
  }

  const locale = options.locale ?? (await resolveLocale(options.participantId));
  const picked = pickLocalised(template, locale);
  const subject = interpolate(picked.subject, options.variables);
  const body = interpolate(picked.body, options.variables);

  let log: { id: string } | undefined;
  if (options.participantId) {
    log = await prisma.notificationLog.create({
      data: {
        participantId: options.participantId,
        templateKey: options.templateKey,
        channel: "EMAIL",
        to: options.to,
        status: "QUEUED",
      },
    });
  }

  try {
    const html = renderHtml(body) + (options.appendHtml ?? "");
    const result = await sendMail({ to: options.to, subject, html, text: body });

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

async function resolveLocale(participantId?: string): Promise<Locale> {
  if (!participantId) return "fr";
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { locale: true },
  });
  return participant?.locale === "en" ? "en" : "fr";
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
      bodyFr: input.bodyFr,
      bodyEn: input.bodyEn,
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

/** Variables déclarées sur le modèle (colonne `variables`), pour l'aide à la saisie. */
export function templateVariables(template: NotificationTemplate): string[] {
  return Array.isArray(template.variables) ? template.variables.map(String) : [];
}

/**
 * Variables réellement présentes dans les corps mais **non déclarées** : signale
 * à l'éditeur une faute de frappe (`{{prenon}}`) qui, sinon, partirait telle
 * quelle dans l'e-mail — `interpolate` laisse les inconnues intactes.
 */
export function undeclaredVariables(template: {
  bodyFr: string;
  bodyEn: string;
  subjectFr?: string | null;
  subjectEn?: string | null;
  declared: string[];
}): string[] {
  const used = new Set<string>();
  const texts = [template.bodyFr, template.bodyEn, template.subjectFr, template.subjectEn];
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
