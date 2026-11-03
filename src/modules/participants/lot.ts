import { z } from "zod";
import { audit } from "@/lib/audit";
import { InvalidParticipantTransitionError } from "./errors";
import { confirmParticipant, declineParticipant, type Actor } from "./service";

/**
 * Confirmation ou refus de plusieurs inscriptions en une passe (3 novembre
 * 2026), depuis la liste des participants.
 *
 * Chaque personne passe par **la même fonction** que le bouton de sa fiche :
 * mêmes règles de statut, même réserve sur la presse, même trace d'audit,
 * même badge et même e-mail. Une fiche refusée n'arrête pas le lot : elle est
 * mise de côté avec sa raison, et les autres suivent.
 *
 * Le traitement est séquentiel : les e-mails partent par la file d'envoi, qui
 * les étale déjà, et un lot n'a pas à se disputer la base avec lui-même.
 */

/** Une page de la liste au plus : c'est ce qu'on peut cocher d'un coup. */
export const LOT_MAX = 200;

export const OPERATIONS_LOT = ["confirm", "decline"] as const;
export type OperationLot = (typeof OPERATIONS_LOT)[number];

export const lotSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Aucun participant sélectionné.").max(LOT_MAX),
  operation: z.enum(OPERATIONS_LOT),
});

export interface ResultatLot {
  traites: number;
  /** Fiches laissées de côté, avec la raison à montrer. */
  ignores: { id: string; raison: string }[];
}

function raison(error: unknown): string {
  // Fiche traitée entre-temps (autre onglet, autre agent) : le message
  // technique de la transition ne dirait rien à l'écran.
  if (error instanceof InvalidParticipantTransitionError) {
    return "n'est plus en attente de validation";
  }
  return error instanceof Error ? error.message : "erreur inattendue";
}

export async function traiterEnLot(
  ids: string[],
  operation: OperationLot,
  actor: Actor,
  options: { peutAccrediter?: boolean } = {},
): Promise<ResultatLot> {
  const uniques = [...new Set(ids)].slice(0, LOT_MAX);
  const executer = operation === "confirm" ? confirmParticipant : declineParticipant;
  const resultat: ResultatLot = { traites: 0, ignores: [] };

  for (const id of uniques) {
    try {
      await executer(id, actor, options);
      resultat.traites += 1;
    } catch (error) {
      resultat.ignores.push({ id, raison: raison(error) });
    }
  }

  // Une trace pour le geste, en plus de celle de chaque transition : retrouver
  // qui a validé cinquante inscriptions d'un clic ne doit pas demander de
  // recouper cinquante lignes.
  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: operation === "confirm" ? "participant.bulk_confirm" : "participant.bulk_decline",
    entity: "Participant",
    entityId: "lot",
    after: { demandes: uniques.length, traites: resultat.traites, ignores: resultat.ignores },
  });

  return resultat;
}
