import { randomBytes } from "node:crypto";
import * as XLSX from "xlsx";
import type { Invitation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { jobQueue } from "@/lib/queue";
import { sendTemplatedEmail } from "@/modules/notifications/service";
import * as repo from "./repository";
import {
  invitationImportRowSchema,
  type InvitationImportRow,
  type InvitationInput,
  type ReminderFilters,
} from "./schema";

export interface Actor {
  type: "USER" | "PARTICIPANT" | "SYSTEM";
  userId?: string;
}

const MAX_REMINDERS = 3;

export function generateInvitationToken(): string {
  return randomBytes(24).toString("base64url");
}

// ---------------------------------------------------------------------------
// Création manuelle
// ---------------------------------------------------------------------------

export async function createInvitation(
  editionId: string,
  input: InvitationInput,
  actor: Actor,
): Promise<Invitation> {
  const existing = await repo.findInvitationByEmail(editionId, input.email);
  if (existing) {
    throw new Error(`Une invitation existe déjà pour ${input.email}.`);
  }

  const invitation = await repo.createInvitation({
    edition: { connect: { id: editionId } },
    category: { connect: { id: input.categoryId } },
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    organization: input.organization || null,
    country: input.country || null,
    token: generateInvitationToken(),
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "invitation.create",
    entity: "Invitation",
    entityId: invitation.id,
    after: { email: invitation.email },
  });

  return invitation;
}

// ---------------------------------------------------------------------------
// Import Excel/CSV (brief §5.5)
//
// SÉCURITÉ : `xlsx` est installé depuis le registre officiel SheetJS
// (`https://cdn.sheetjs.com/xlsx-0.20.3/...`, épinglé avec vérification
// d'intégrité dans `pnpm-lock.yaml`) et non depuis npm public, dont la dernière
// version publiée (0.18.5) porte un ReDoS non corrigé — SheetJS ne publie plus
// ses correctifs sur npm. Défense en profondeur conservée : import réservé aux
// administrateurs authentifiés (`invitations.write`), plafonné à 5 Mo, parsing
// serveur uniquement.
// ---------------------------------------------------------------------------

export interface ParsedImportRow {
  raw: Record<string, unknown>;
  rowNumber: number;
}

/** Colonnes attendues (insensibles à la casse) : email, prenom, nom, organisation, pays, categorie. */
const COLUMN_ALIASES: Record<string, keyof InvitationImportRow> = {
  email: "email",
  "e-mail": "email",
  prenom: "firstName",
  prénom: "firstName",
  firstname: "firstName",
  nom: "lastName",
  lastname: "lastName",
  organisation: "organization",
  organization: "organization",
  pays: "country",
  country: "country",
  categorie: "categoryCode",
  catégorie: "categoryCode",
  category: "categoryCode",
  categorycode: "categoryCode",
};

export function parseImportFile(buffer: Buffer): ParsedImportRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.map((row, index) => {
    const normalised: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const alias = COLUMN_ALIASES[key.trim().toLowerCase()];
      if (alias) normalised[alias] = String(value ?? "").trim();
    }
    return { raw: normalised, rowNumber: index + 2 }; // +2 : ligne 1 = en-têtes, index 0-based
  });
}

export interface ImportPreviewError {
  rowNumber: number;
  message: string;
}

export interface ImportPreviewResult {
  valid: (InvitationImportRow & { rowNumber: number })[];
  errors: ImportPreviewError[];
  duplicatesInFile: number;
}

/**
 * Prévisualisation : valide chaque ligne, détecte les doublons (dans le fichier
 * et contre les invitations/participants déjà en base), sans rien écrire.
 */
export async function previewImport(
  editionId: string,
  rows: ParsedImportRow[],
  categoryCodeToId: Map<string, string>,
): Promise<ImportPreviewResult> {
  const errors: ImportPreviewError[] = [];
  const parsed: (InvitationImportRow & { rowNumber: number })[] = [];
  const seenInFile = new Set<string>();
  let duplicatesInFile = 0;

  for (const { raw, rowNumber } of rows) {
    const result = invitationImportRowSchema.safeParse(raw);
    if (!result.success) {
      errors.push({ rowNumber, message: result.error.issues[0]?.message ?? "Ligne invalide" });
      continue;
    }
    if (!categoryCodeToId.has(result.data.categoryCode)) {
      errors.push({ rowNumber, message: `Catégorie inconnue : "${result.data.categoryCode}"` });
      continue;
    }
    if (seenInFile.has(result.data.email)) {
      duplicatesInFile += 1;
      errors.push({
        rowNumber,
        message: `E-mail en doublon dans le fichier : ${result.data.email}`,
      });
      continue;
    }
    seenInFile.add(result.data.email);
    parsed.push({ ...result.data, rowNumber });
  }

  if (parsed.length > 0) {
    const existingEmails = await repo.existingEmailsForEdition(
      editionId,
      parsed.map((row) => row.email),
    );
    for (const row of [...parsed]) {
      if (existingEmails.has(row.email)) {
        errors.push({
          rowNumber: row.rowNumber,
          message: `Déjà invité(e) ou inscrit(e) : ${row.email}`,
        });
        const index = parsed.indexOf(row);
        parsed.splice(index, 1);
      }
    }
  }

  return { valid: parsed, errors, duplicatesInFile };
}

export interface ImportSummary {
  imported: number;
  batchId: string;
}

/** Écrit les lignes déjà validées par `previewImport` — un seul aller-retour DB (brief : 1000 lignes < 10 s). */
export async function importInvitations(
  editionId: string,
  rows: (InvitationImportRow & { rowNumber: number })[],
  categoryCodeToId: Map<string, string>,
  actor: Actor,
): Promise<ImportSummary> {
  const batchId = randomBytes(8).toString("hex");

  const { count } = await repo.createManyInvitations(
    rows.map((row) => ({
      editionId,
      categoryId: categoryCodeToId.get(row.categoryCode)!,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      organization: row.organization || null,
      country: row.country || null,
      token: generateInvitationToken(),
      importBatchId: batchId,
    })),
  );

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "invitation.import",
    entity: "Invitation",
    entityId: batchId,
    after: { count, batchId },
  });

  return { imported: count, batchId };
}

// ---------------------------------------------------------------------------
// Envoi (toujours asynchrone via JobQueue — brief §3.3)
// ---------------------------------------------------------------------------

let jobsRegistered = false;

/**
 * Enregistrement paresseux du handler, à la première mise en file, plutôt qu'au
 * moment de l'import du module. Deux raisons :
 *   1. un script court-lived important ce module ouvrirait sinon un worker
 *      BullMQ (connexion Redis) et ne se terminerait jamais ;
 *   2. `src/instrumentation.ts` (l'autre point d'entrée possible) est compilé
 *      pour le runtime Edge aussi — à cause du middleware — où BullMQ ne peut
 *      pas être résolu (`child_process`, `net`), ce qui casse le build.
 * Les Server Actions qui appellent `sendInvitation` tournent en runtime Node :
 * c'est le bon endroit pour démarrer le worker.
 */
export function registerInvitationJobs(): void {
  if (jobsRegistered) return;
  jobsRegistered = true;

  jobQueue.process<{ invitationId: string }>("invitation.send", async ({ invitationId }) => {
    const invitation = await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";

    await sendTemplatedEmail({
      editionId: invitation.editionId,
      templateKey: invitation.remindersCount > 0 ? "invitation_reminder" : "invitation",
      to: invitation.email,
      variables: {
        prenom: invitation.firstName,
        lien_inscription: `${baseUrl}/inscription?inv=${invitation.token}`,
      },
      appendHtml: `<img src="${baseUrl}/api/v1/invitations/${invitation.token}/pixel" width="1" height="1" alt="" style="display:none" />`,
    });

    await prisma.invitation.update({
      where: { id: invitationId },
      data:
        invitation.status === "PENDING"
          ? { status: "SENT", sentAt: new Date() }
          : { remindersCount: { increment: 1 }, lastReminderAt: new Date() },
    });
  });
}

export async function sendInvitation(invitationId: string, actor: Actor): Promise<void> {
  registerInvitationJobs();
  await jobQueue.enqueue(
    "invitation.send",
    { invitationId },
    { idempotencyKey: `invitation-send-${invitationId}-${Date.now()}` },
  );
  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "invitation.send_queued",
    entity: "Invitation",
    entityId: invitationId,
  });
}

export async function sendInvitationsBulk(invitationIds: string[], actor: Actor): Promise<void> {
  for (const id of invitationIds) {
    await sendInvitation(id, actor);
  }
}

export async function sendReminders(
  editionId: string,
  filters: ReminderFilters,
  actor: Actor,
): Promise<{ queued: number }> {
  const invitations = await repo.listRemindableInvitations(
    editionId,
    { categoryId: filters.categoryId || undefined, country: filters.country || undefined },
    MAX_REMINDERS,
  );
  await sendInvitationsBulk(
    invitations.map((invitation) => invitation.id),
    actor,
  );
  return { queued: invitations.length };
}

// ---------------------------------------------------------------------------
// Suivi (pixel d'ouverture, clic) et rapprochement automatique
// ---------------------------------------------------------------------------

export async function markOpened(token: string): Promise<void> {
  const invitation = await repo.findInvitationByToken(token);
  if (!invitation || invitation.openedAt) return;
  await repo.updateInvitation(invitation.id, {
    openedAt: new Date(),
    status: invitation.status === "SENT" ? "OPENED" : invitation.status,
  });
}

export async function markClicked(token: string): Promise<void> {
  const invitation = await repo.findInvitationByToken(token);
  if (!invitation) return;
  if (
    invitation.status === "PENDING" ||
    invitation.status === "SENT" ||
    invitation.status === "OPENED"
  ) {
    await repo.updateInvitation(invitation.id, { status: "CLICKED" });
  }
}

/**
 * Rapproche une inscription hors lien avec une invitation existante (brief §5.5) :
 * appelé par `modules/participants` à la création/complétion d'un participant.
 */
export async function reconcileByEmail(
  editionId: string,
  email: string,
  participantId: string,
): Promise<void> {
  const invitation = await repo.findReconcilableInvitation(editionId, email);
  if (!invitation) return;

  await repo.updateInvitation(invitation.id, {
    status: "REGISTERED",
    respondedAt: new Date(),
    participant: { connect: { id: participantId } },
  });

  await audit.log({
    actorType: "SYSTEM",
    action: "invitation.reconciled",
    entity: "Invitation",
    entityId: invitation.id,
    after: { participantId },
  });
}

export async function getInvitationByToken(token: string) {
  return repo.findInvitationByToken(token);
}

export async function listInvitations(
  editionId: string,
  search: {
    q?: string;
    status?: string;
    categoryId?: string;
    page: number;
    pageSize: number;
  },
) {
  return repo.listInvitations({
    editionId,
    q: search.q || undefined,
    status: (search.status as Invitation["status"]) || undefined,
    categoryId: search.categoryId || undefined,
    page: search.page,
    pageSize: search.pageSize,
  });
}
