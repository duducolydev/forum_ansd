import { registerNotificationJobs } from "@/modules/notifications/jobs";
import { registerBadgeJobs } from "@/modules/badges/jobs";
import { registerInvitationJobs } from "@/modules/invitations/service";

/**
 * Enregistrement des workers, côté Node uniquement (§34.1).
 *
 * Fichier séparé de `instrumentation.ts`, et ce n'est pas un rangement : Next
 * compile `instrumentation.ts` pour **les deux** runtimes, Node et Edge. Un
 * import de BullMQ qui y figure, même derrière un test sur `NEXT_RUNTIME`, est
 * tout de même tracé par le bundler, qui échoue alors à résoudre `crypto`,
 * `stream`, `net` et `child_process` — absents d'Edge. Constaté à la
 * construction le 24 septembre 2026.
 *
 * Isolé ici et importé depuis un bloc `if`, l'ensemble disparaît de la
 * compilation Edge : `process.env.NEXT_RUNTIME` est remplacé par sa valeur à la
 * construction, la condition devient fausse, et le bloc est éliminé avec tout
 * ce qu'il tire.
 */
export function enregistrerWorkers(): void {
  registerNotificationJobs();
  registerBadgeJobs();
  registerInvitationJobs();
}
