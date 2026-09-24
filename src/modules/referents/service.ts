import { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import type { Actor } from "@/modules/participants/service";
import * as repo from "./repository";
import { ReferentEmailExistantError, ReferentRattacheError } from "./errors";
import type { ReferentInput } from "./schema";

/**
 * Annuaire des référents internes (§28).
 *
 * Un référent est une personne du comité d'organisation, pas un compte : il
 * n'ouvre aucune session, il reçoit des alertes et ses coordonnées sont
 * communiquées aux participants de la délégation qu'il accompagne.
 */

export const listReferents = repo.listReferents;
export const listReferentsActifs = repo.listReferentsActifs;
export const findReferentById = repo.findReferentById;

/**
 * Violation d'unicité MySQL relayée en erreur métier.
 *
 * Le code `P2002` est la seule façon fiable de détecter le doublon : vérifier
 * l'existence avant d'écrire laisse une fenêtre entre la lecture et l'écriture,
 * que deux formulaires envoyés en même temps suffisent à franchir.
 */
function estDoublonEmail(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createReferent(editionId: string, input: ReferentInput, actor: Actor) {
  let referent;
  try {
    referent = await repo.createReferent({
      edition: { connect: { id: editionId } },
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      role: input.role || null,
      isActive: input.isActive,
    });
  } catch (error) {
    if (estDoublonEmail(error)) throw new ReferentEmailExistantError(input.email);
    throw error;
  }

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "referent.create",
    entity: "Referent",
    entityId: referent.id,
    after: { name: referent.name, email: referent.email },
  });

  return referent;
}

export async function updateReferent(id: string, input: ReferentInput, actor: Actor) {
  const avant = await repo.findReferentById(id);
  if (!avant) throw new Error("Référent introuvable.");

  let referent;
  try {
    referent = await repo.updateReferent(id, {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      role: input.role || null,
      isActive: input.isActive,
    });
  } catch (error) {
    if (estDoublonEmail(error)) throw new ReferentEmailExistantError(input.email);
    throw error;
  }

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "referent.update",
    entity: "Referent",
    entityId: id,
    before: { name: avant.name, email: avant.email, isActive: avant.isActive },
    after: { name: referent.name, email: referent.email, isActive: referent.isActive },
  });

  return referent;
}

export async function deleteReferent(id: string, actor: Actor) {
  const rattachees = await repo.compterDelegations(id);
  if (rattachees > 0) throw new ReferentRattacheError(rattachees);

  const avant = await repo.findReferentById(id);
  await repo.deleteReferent(id);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "referent.delete",
    entity: "Referent",
    entityId: id,
    before: avant ? { name: avant.name, email: avant.email } : undefined,
  });
}

/** Coordonnées telles qu'elles sont montrées à un participant. */
export interface CoordonneesReferent {
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
}

/**
 * Bloc de texte inséré dans l'e-mail de confirmation d'inscription.
 *
 * Le moteur de modèles ne connaît que la substitution `{{variable}}`, sans
 * condition : un participant sans délégation, ou dont la délégation n'a pas
 * encore de référent, aurait reçu « Votre référent est , joignable au ». Le
 * paragraphe entier est donc composé ici et passé en une seule variable, vide
 * quand il n'y a rien à dire.
 */
export function blocReferent(
  referent: CoordonneesReferent | null | undefined,
  locale: "fr" | "en",
): string {
  if (!referent) return "";

  const lignes =
    locale === "en"
      ? [
          "",
          "Your delegation's internal contact:",
          `  ${referent.name}${referent.role ? ` — ${referent.role}` : ""}`,
          `  ${referent.email}`,
        ]
      : [
          "",
          "Le référent de votre délégation :",
          `  ${referent.name}${referent.role ? ` — ${referent.role}` : ""}`,
          `  ${referent.email}`,
        ];

  if (referent.phone) lignes.push(`  ${referent.phone}`);
  return lignes.join("\n");
}
