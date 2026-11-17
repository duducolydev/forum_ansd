import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * La file doit être **unique par processus**, worker compris (17 novembre 2026).
 *
 * ## Ce que ce test protège
 *
 * Next découpe le serveur en plusieurs paquets, chacun avec son propre registre
 * de modules : `queue/index.ts` est évalué plusieurs fois dans le même
 * processus. Sans garde sur `globalThis`, chaque copie fabriquait sa propre
 * table de handlers **et son propre `Worker`**, branchés sur la même file
 * Redis. Or un worker consomme tous les types de jobs, pas seulement ceux que
 * son paquet a enregistrés : celui né d'un paquet « badges » happait les
 * `notification.send` et les rejetait — « Aucun handler enregistré ».
 *
 * Coût réel : deux campagnes de 273 rappels J-7, 39 messages partis, 507 jobs
 * en échec, et **aucune trace dans le journal des notifications**, l'erreur
 * survenant avant son écriture. Rien ne le signalait dans le BackOffice.
 *
 * ## Pourquoi un test sur le texte du module
 *
 * La règle ne se vérifie pas en important le module : dans un test, il n'y a
 * qu'un registre de modules, donc le défaut est invisible. Ce qui se vérifie,
 * c'est la forme du code — le garde inconditionnel, et le worker qui ne naît
 * pas d'un `process()`. C'est la même garde que celle du corpus public
 * (`modules/corpus/construire.test.ts`) : quand la propriété tient à la
 * structure, c'est la structure qu'on relit.
 */

function lire(nom: string): string {
  return readFileSync(fileURLToPath(new URL(nom, import.meta.url)), "utf8");
}

describe("file d'attente : une seule par processus", () => {
  const index = lire("./index.ts");

  it("pose le singleton sur globalThis sans condition", () => {
    expect(index).toContain("globalThis.__jobQueue ??= createJobQueue()");
  });

  it("ne réserve plus le garde au développement", () => {
    // La forme fautive : `if (process.env.NODE_ENV !== "production")` autour de
    // l'affectation. En production, chaque paquet avait alors sa propre file.
    expect(index).not.toMatch(/NODE_ENV\s*!==\s*"production"[\s\S]{0,80}__jobQueue\s*=/);
  });
});

describe("worker : démarré une fois, après tous les handlers", () => {
  const bullmq = lire("./bullmq-queue.ts");
  const instrumentation = lire("../../instrumentation-node.ts");

  it("ne crée pas le worker dans process()", () => {
    const corps = bullmq.slice(
      bullmq.indexOf("process<T>(type: string"),
      bullmq.indexOf("demarrerWorker()"),
    );
    expect(corps).not.toContain("new Worker(");
  });

  it("le crée dans demarrerWorker(), et une seule fois", () => {
    expect(bullmq).toMatch(/demarrerWorker\(\): void \{\s*this\.worker \?\?= new Worker\(/);
  });

  it("n'est démarré qu'après l'enregistrement des trois familles de jobs", () => {
    const ordre = ["registerNotificationJobs()", "registerBadgeJobs()", "registerInvitationJobs()"];
    const demarrage = instrumentation.indexOf("jobQueue.demarrerWorker()");
    expect(demarrage).toBeGreaterThan(0);
    for (const appel of ordre) {
      expect(instrumentation.indexOf(appel), appel).toBeGreaterThan(0);
      expect(instrumentation.indexOf(appel), appel).toBeLessThan(demarrage);
    }
  });
});
