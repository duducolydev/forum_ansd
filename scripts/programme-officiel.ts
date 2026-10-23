import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createSession } from "../src/modules/sessions/service";
import { JOURS_DEMO, PROGRAMME_DEMO, slugSeanceDemo } from "../prisma/donnees-demo";
import {
  PROGRAMME_OFFICIEL,
  SALLES_PROGRAMME,
  versSessionInput,
  type SalleProgramme,
  type SeanceOfficielle,
} from "../prisma/programme-officiel";

/**
 * Charge le programme officiel du Forum (note conceptuelle du 24 septembre
 * 2026), à la place du programme fictif (demande du 23 octobre 2026).
 *
 *     pnpm programme:officiel                # inventaire : rien n'est écrit
 *     pnpm programme:officiel --appliquer    # crée les séances annoncées
 *
 * Sur le serveur, **après** `pnpm demo:purger --appliquer`, qui retire les
 * séances fictives :
 *
 *     forum run --rm -T outils pnpm programme:officiel
 *
 * **Création seulement.** Une séance déjà là n'est ni modifiée ni dupliquée :
 *
 * - même adresse (`slug`) : chargée par un passage précédent — ou supprimée en
 *   BackOffice depuis, et alors pas recréée : c'est une décision du comité ;
 * - même jour et même titre, ou même numéro de panel : saisie à la main en
 *   BackOffice, elle est gardée telle quelle.
 *
 * Le script se rejoue donc sans risque, et une retouche faite en BackOffice
 * après le chargement n'est jamais écrasée. Il ne fait pas partie d'une mise à
 * jour (`scripts/deployer.sh`) : il se lance une fois, à la demande du comité.
 */

const APPLIQUER = process.argv.includes("--appliquer");

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Decision =
  | { action: "creer" }
  | { action: "present"; detail: string }
  | { action: "retiree"; detail: string };

async function main(): Promise<void> {
  const edition = await prisma.edition.findFirst({ where: { isActive: true } });
  if (!edition) throw new Error("Aucune édition active.");

  // --- Salles : celles du BackOffice, jamais créées ni renommées ici ---------
  const salles = await prisma.room.findMany({
    where: { editionId: edition.id },
    select: { id: true, name: true },
  });
  const sallesRetenues: Partial<Record<SalleProgramme, { id: string; nom: string }>> = {};
  for (const [cle, { libelle, noms }] of Object.entries(SALLES_PROGRAMME) as [
    SalleProgramme,
    (typeof SALLES_PROGRAMME)[SalleProgramme],
  ][]) {
    const trouvee = noms
      .map((nom) => salles.find((salle) => normaliser(salle.name) === normaliser(nom)))
      .find(Boolean);
    if (!trouvee) {
      throw new Error(
        `Salle « ${libelle} » introuvable (cherchée sous : ${noms.join(", ")}). Salles en base : ${
          salles.map((salle) => salle.name).join(", ") || "aucune"
        }. Créez-la ou renommez-la en BackOffice (Programme → Salles) : rien n'a été écrit.`,
      );
    }
    sallesRetenues[cle] = { id: trouvee.id, nom: trouvee.name };
  }

  // --- Séances déjà en base -----------------------------------------------------
  const slugsDemo = new Set<string>();
  for (const jour of JOURS_DEMO) {
    for (const item of PROGRAMME_DEMO[jour] ?? [])
      slugsDemo.add(slugSeanceDemo(jour, item.titleFr));
  }
  const existantes = await prisma.session.findMany({
    where: { editionId: edition.id },
    select: { slug: true, titleFr: true, number: true, day: true, deletedAt: true },
  });
  const demoRestantes = existantes.filter((s) => slugsDemo.has(s.slug) && !s.deletedAt);
  // Les séances fictives ne comptent pas comme « déjà saisies » : leurs numéros
  // (1 à 28) et leurs titres (« Pause-café »…) recouvrent ceux du programme.
  const saisies = existantes.filter((s) => !slugsDemo.has(s.slug) && !s.deletedAt);

  function decider(seance: SeanceOfficielle): Decision {
    const memeAdresse = existantes.find((s) => s.slug === seance.slug);
    if (memeAdresse?.deletedAt) {
      return { action: "retiree", detail: "supprimée en BackOffice depuis : pas recréée" };
    }
    if (memeAdresse) return { action: "present", detail: "déjà chargée" };

    const jour = seance.jour;
    const doublon = saisies.find(
      (s) =>
        s.day.toISOString().slice(0, 10) === jour &&
        (normaliser(s.titleFr) === normaliser(seance.titre.fr) ||
          (seance.numero !== undefined && s.number === seance.numero)),
    );
    if (doublon) {
      return { action: "present", detail: `déjà saisie en BackOffice : « ${doublon.titleFr} »` };
    }
    return { action: "creer" };
  }

  const plan = PROGRAMME_OFFICIEL.map((seance) => ({ seance, decision: decider(seance) }));
  // Validation complète avant toute écriture : une séance invalide arrête tout.
  const sallesIds = Object.fromEntries(
    Object.entries(sallesRetenues).map(([cle, salle]) => [cle, salle!.id]),
  ) as Partial<Record<SalleProgramme, string>>;
  const aCreer = plan
    .filter(({ decision }) => decision.action === "creer")
    .map(({ seance }) => ({ seance, input: versSessionInput(seance, sallesIds) }));

  // --- Rapport ---------------------------------------------------------------------
  console.log(
    `\nProgramme officiel — ${APPLIQUER ? "APPLICATION" : "INVENTAIRE (rien n'est écrit)"}\n`,
  );
  for (const [cle, salle] of Object.entries(sallesRetenues)) {
    const libelle = SALLES_PROGRAMME[cle as SalleProgramme].libelle;
    console.log(
      `  ${libelle} → salle « ${salle!.nom} »${
        normaliser(salle!.nom) === normaliser(libelle) ? "" : " (renommable en BackOffice)"
      }`,
    );
  }

  let jourCourant = "";
  for (const { seance, decision } of plan) {
    if (seance.jour !== jourCourant) {
      jourCourant = seance.jour;
      console.log(`\n  ${jourCourant}`);
    }
    const salle = seance.salle ? ` [${sallesRetenues[seance.salle]!.nom}]` : "";
    const etat =
      decision.action === "creer"
        ? "à créer"
        : decision.action === "present"
          ? `conservée — ${decision.detail}`
          : `ignorée — ${decision.detail}`;
    console.log(`    ${seance.debut}–${seance.fin}  ${seance.titre.fr}${salle}\n        ${etat}`);
  }

  console.log(
    `\n${aCreer.length} séance(s) à créer, ${plan.length - aCreer.length} déjà là ou écartée(s).`,
  );
  if (demoRestantes.length > 0) {
    console.log(
      `\n! ${demoRestantes.length} séance(s) du programme fictif encore en ligne : elles s'afficheraient à côté du vrai. ` +
        "Lancer d'abord « pnpm demo:purger » (docs/DEPLOIEMENT.md §4.2).",
    );
  }

  if (!APPLIQUER) {
    if (aCreer.length > 0) console.log("\nInventaire seulement : relancer avec --appliquer.");
    return;
  }

  for (const { seance, input } of aCreer) {
    await createSession(edition.id, input, { type: "SYSTEM" });
    console.log(`  créée : ${seance.titre.fr}`);
  }
  console.log(
    `\nFait : ${aCreer.length} séance(s) créée(s), publiées et sans réservation. ` +
      "Intervenants : Intervenants → Importer, colonne « seances » = numéro du panel.",
  );
}

main()
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
