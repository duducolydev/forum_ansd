import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createSession, deleteSession, setPublished } from "../src/modules/sessions/service";
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
 *     pnpm programme:officiel                            # inventaire : rien n'est écrit
 *     pnpm programme:officiel --remplacer                # inventaire du remplacement
 *     pnpm programme:officiel --remplacer --appliquer    # retire l'ancien, crée l'officiel
 *
 * Sur le serveur, après `pnpm demo:purger --appliquer` :
 *
 *     forum run --rm -T outils pnpm programme:officiel --remplacer
 *
 * ## Création
 *
 * Une séance officielle déjà là n'est ni modifiée ni dupliquée :
 *
 * - même adresse (`slug`) : chargée par un passage précédent — ou supprimée en
 *   BackOffice depuis, et alors pas recréée : c'est une décision du comité ;
 * - même jour et même titre, ou même numéro de panel, parmi les séances saisies
 *   en BackOffice : gardée telle quelle, à la place de l'officielle.
 *
 * ## Remplacement (`--remplacer`)
 *
 * Le programme fictif n'est pas seulement celui du seed : des séances ont été
 * retouchées en BackOffice (horaires, titres, thèmes), et le nettoyage de la
 * démonstration les garde, puisqu'elles ont peut-être été reprises. Constaté le
 * 23 octobre 2026 sur le portail : sans remplacement, elles s'affichaient à
 * côté du programme officiel — deux ouvertures, deux « Panel 1 ».
 *
 * Avec `--remplacer`, toute séance qui n'est pas du programme officiel est
 * retirée **comme le ferait le BackOffice**, par ses services, journal d'audit
 * compris :
 *
 * - sans inscription : supprimée (suppression douce, `deletedAt` — la fiche
 *   reste en base et se restaure) ;
 * - avec des inscriptions : seulement **dépubliée**, comme le BackOffice
 *   l'exige — les inscrits ne perdent rien.
 *
 * L'inventaire liste chaque séance retirée avec ses inscrits, ses intervenants
 * et ses contributions : c'est lui qu'on relit avant `--appliquer`.
 *
 * Le script se rejoue sans risque. Il ne fait pas partie d'une mise à jour
 * (`scripts/deployer.sh`) : il se lance à la demande du comité.
 */

const APPLIQUER = process.argv.includes("--appliquer");
const REMPLACER = process.argv.includes("--remplacer");

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const heure = (date: Date) => date.toISOString().slice(11, 16);

type Decision =
  | { action: "creer" }
  | { action: "present"; detail: string; id: string }
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
    for (const item of PROGRAMME_DEMO[jour] ?? []) {
      slugsDemo.add(slugSeanceDemo(jour, item.titleFr));
    }
  }
  const existantes = await prisma.session.findMany({
    where: { editionId: edition.id },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      slug: true,
      titleFr: true,
      number: true,
      day: true,
      startTime: true,
      endTime: true,
      isPublished: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { registrations: true, speakers: true, contributions: true } },
    },
  });
  // Les séances fictives ne remplacent jamais une officielle : leurs numéros
  // (1 à 28) et leurs titres (« Pause-café »…) recouvrent ceux du programme,
  // et elles portent des textes de démonstration.
  const saisies = existantes.filter((s) => !slugsDemo.has(s.slug) && !s.deletedAt);

  function decider(seance: SeanceOfficielle): Decision {
    const memeAdresse = existantes.find((s) => s.slug === seance.slug);
    if (memeAdresse?.deletedAt) {
      return { action: "retiree", detail: "supprimée en BackOffice depuis : pas recréée" };
    }
    if (memeAdresse) return { action: "present", detail: "déjà chargée", id: memeAdresse.id };

    const doublon = saisies.find(
      (s) =>
        s.day.toISOString().slice(0, 10) === seance.jour &&
        (normaliser(s.titleFr) === normaliser(seance.titre.fr) ||
          (seance.numero !== undefined && s.number === seance.numero)),
    );
    if (doublon) {
      return {
        action: "present",
        detail: `déjà saisie en BackOffice : « ${doublon.titleFr} »`,
        id: doublon.id,
      };
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

  // --- Programme actuel hors programme officiel ------------------------------------
  const officielles = new Set(
    plan.flatMap(({ decision }) => (decision.action === "present" ? [decision.id] : [])),
  );
  const horsProgramme = existantes
    .filter((s) => !s.deletedAt && !officielles.has(s.id))
    .map((s) => {
      const origine = !slugsDemo.has(s.slug)
        ? "saisie en BackOffice"
        : Math.abs(s.updatedAt.getTime() - s.createdAt.getTime()) < 1000
          ? "fictive, intacte"
          : "fictive, retouchée en BackOffice";
      const inscrits = s._count.registrations;
      const action: "supprimer" | "depublier" | "rien" =
        inscrits === 0 ? "supprimer" : s.isPublished ? "depublier" : "rien";
      return { ...s, origine, action };
    });

  // --- Rapport ---------------------------------------------------------------------
  console.log(
    `\nProgramme officiel — ${APPLIQUER ? "APPLICATION" : "INVENTAIRE (rien n'est écrit)"}${
      REMPLACER ? ", avec remplacement" : ""
    }\n`,
  );
  for (const [cle, salle] of Object.entries(sallesRetenues)) {
    const libelle = SALLES_PROGRAMME[cle as SalleProgramme].libelle;
    console.log(
      `  ${libelle} → salle « ${salle!.nom} »${
        normaliser(salle!.nom) === normaliser(libelle) ? "" : " (renommable en BackOffice)"
      }`,
    );
  }

  console.log("\nPROGRAMME OFFICIEL");
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
    `\nPROGRAMME ACTUEL, HORS PROGRAMME OFFICIEL (${horsProgramme.length})${
      REMPLACER ? " — retiré" : " — reste en ligne sans --remplacer"
    }`,
  );
  if (horsProgramme.length === 0) console.log("  Rien.");
  for (const s of horsProgramme) {
    const effet = !REMPLACER
      ? s.isPublished
        ? "reste en ligne"
        : "reste hors ligne (non publiée)"
      : s.action === "supprimer"
        ? "supprimée (douce, restaurable)"
        : s.action === "depublier"
          ? `dépubliée seulement : ${s._count.registrations} inscription(s)`
          : `déjà dépubliée, gardée : ${s._count.registrations} inscription(s)`;
    console.log(
      `    ${s.day.toISOString().slice(0, 10)} ${heure(s.startTime)}–${heure(s.endTime)}  ${s.titleFr}\n` +
        `        ${s.origine} · ${s._count.speakers} intervenant(s), ${s._count.contributions} contribution(s) — ${effet}`,
    );
  }

  console.log(
    `\n${aCreer.length} séance(s) à créer, ${plan.length - aCreer.length} déjà là ou écartée(s)` +
      (REMPLACER ? `, ${horsProgramme.filter((s) => s.action !== "rien").length} à retirer.` : "."),
  );
  const enLigne = horsProgramme.filter((s) => s.isPublished).length;
  if (!REMPLACER && enLigne > 0) {
    console.log(
      `\n! ${enLigne} séance(s) hors programme officiel resteraient en ligne, à côté du vrai. ` +
        "Relancer avec --remplacer pour les retirer.",
    );
  }

  if (!APPLIQUER) {
    console.log("\nInventaire seulement : relancer avec --appliquer.");
    return;
  }

  // 1. Retrait de l'ancien programme, par les services du BackOffice.
  const acteur = { type: "SYSTEM" as const };
  if (REMPLACER) {
    for (const s of horsProgramme) {
      if (s.action === "supprimer") await deleteSession(s.id, acteur);
      else if (s.action === "depublier") await setPublished(s.id, false, acteur);
    }
  }

  // 2. Création du programme officiel.
  for (const { seance, input } of aCreer) {
    await createSession(edition.id, input, acteur);
    console.log(`  créée : ${seance.titre.fr}`);
  }

  console.log(
    `\nFait : ${aCreer.length} séance(s) créée(s), publiées et sans réservation` +
      (REMPLACER
        ? `, ${horsProgramme.filter((s) => s.action === "supprimer").length} supprimée(s), ` +
          `${horsProgramme.filter((s) => s.action === "depublier").length} dépubliée(s).`
        : ".") +
      "\nIntervenants : Intervenants → Importer, colonne « seances » = numéro du panel.",
  );
}

main()
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
