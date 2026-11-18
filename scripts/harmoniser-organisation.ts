import "dotenv/config";
import { prisma } from "../src/lib/db";

/**
 * Harmonise le champ « Organisation » (18 novembre 2026).
 *
 *     pnpm organisation:harmoniser                     # inventaire : rien n'est modifié
 *     pnpm organisation:harmoniser --appliquer         # écrit ce que l'inventaire annonce
 *     pnpm organisation:harmoniser --appliquer --inclure <id,…>
 *     pnpm organisation:harmoniser --seulement participants
 *     pnpm organisation:harmoniser --sigle OMS --nom "Organisation mondiale de la santé"
 *
 * Sur le serveur, après une sauvegarde :
 *
 *     forum run --rm -T outils pnpm organisation:harmoniser
 *
 * ## Inventaire par défaut
 *
 * Comme `demo:purger`, et pour la même raison : un oubli d'option doit coûter
 * une relecture, pas des fiches. Rien n'est écrit sans `--appliquer`.
 *
 * ## Trois cas, et un seul se corrige tout seul
 *
 * Les saisies libres divergent — « ANSD », « ansd », « A.N.S.D. », « ANSD /
 * DSDS », « ANSD Thiès ». Toutes ne désignent pas la même chose, et le script
 * ne le devine pas :
 *
 * - **À harmoniser** : la valeur ne contient *que* le sigle, à la casse, aux
 *   points et aux espaces près. Aucun doute possible, c'est corrigé.
 * - **À vérifier** : la valeur mentionne le sigle mais dit autre chose en plus
 *   — une direction, une antenne régionale. « ANSD Thiès » est peut-être à
 *   fondre dans la maison mère, peut-être pas : ce n'est pas au script d'en
 *   décider. Ces fiches sont **listées et laissées intactes** ; `--inclure`
 *   tranche, identifiant par identifiant, après relecture.
 * - **Déjà bon** : la valeur est déjà le nom complet attendu.
 *
 * Le nom complet écrit dans une casse ou une accentuation différente est traité
 * comme « à harmoniser » : c'est la même maison, et l'uniformité des badges en
 * dépend.
 *
 * ## Trois collections
 *
 * Participants, intervenants et invitations portent le même champ, saisi par
 * les mêmes mains — l'écart s'y retrouve donc à l'identique. Le script visait
 * d'abord les seuls participants et comptait les autres sans y toucher ; le
 * périmètre a été étendu le 18 novembre 2026, à la demande du comité.
 *
 * `--seulement` restreint à une ou plusieurs collections, pour reprendre une
 * harmonisation par morceaux plutôt qu'en bloc.
 *
 * Les fiches supprimées sont écartées là où la suppression existe
 * (`Participant.deletedAt`, `Speaker.deletedAt`) ; `Invitation` n'en a pas.
 */

const SIGLE_DEFAUT = "ANSD";
const NOM_DEFAUT = "Agence Nationale de la Statistique et de la Démographie";

function option(nom: string): string | undefined {
  const index = process.argv.indexOf(`--${nom}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function liste(nom: string): Set<string> {
  return new Set(
    (option(nom) ?? "")
      .split(",")
      .map((valeur) => valeur.trim())
      .filter(Boolean),
  );
}

const appliquer = process.argv.includes("--appliquer");
const sigle = option("sigle") ?? SIGLE_DEFAUT;
const nomComplet = option("nom") ?? NOM_DEFAUT;
const inclure = liste("inclure");
const seulement = liste("seulement");

/**
 * Forme comparable d'une saisie : sans accents, sans ponctuation, sans espaces,
 * en capitales.
 *
 * Les espaces sont retirés et non réduits, à dessein : « A N S D » et
 * « A.N.S.D. » doivent rejoindre « ANSD ». La contrepartie est que
 * « ANSD Thiès » devient « ANSDTHIES » — différent, donc classé à vérifier.
 * C'est le comportement voulu : seule l'égalité stricte autorise une écriture.
 */
function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.,;:_/\\()[\]-]/g, " ")
    .replace(/\s+/g, "")
    .toUpperCase();
}

interface Fiche {
  id: string;
  nom: string;
  /** Identifiant public ou adresse — de quoi retrouver la fiche au BackOffice. */
  reference: string;
  valeur: string;
}

interface Collection {
  cle: string;
  libelle: string;
  /** Nom du modèle, tel qu'il est écrit dans le journal d'audit. */
  entite: string;
  lire: () => Promise<Fiche[]>;
  ecrire: (ids: string[]) => Promise<number>;
}

const COLLECTIONS: Collection[] = [
  {
    cle: "participants",
    libelle: "Participants",
    entite: "Participant",
    lire: async () =>
      (
        await prisma.participant.findMany({
          where: { deletedAt: null, organization: { not: null } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            publicId: true,
            organization: true,
          },
          orderBy: { lastName: "asc" },
        })
      ).map((ligne) => ({
        id: ligne.id,
        nom: `${ligne.firstName} ${ligne.lastName}`.trim(),
        reference: ligne.publicId,
        valeur: ligne.organization ?? "",
      })),
    ecrire: async (ids) =>
      (
        await prisma.participant.updateMany({
          where: { id: { in: ids } },
          data: { organization: nomComplet },
        })
      ).count,
  },
  {
    cle: "intervenants",
    libelle: "Intervenants",
    entite: "Speaker",
    lire: async () =>
      (
        await prisma.speaker.findMany({
          where: { deletedAt: null, organization: { not: null } },
          select: { id: true, firstName: true, lastName: true, email: true, organization: true },
          orderBy: { lastName: "asc" },
        })
      ).map((ligne) => ({
        id: ligne.id,
        nom: `${ligne.firstName} ${ligne.lastName}`.trim(),
        reference: ligne.email ?? "sans adresse",
        valeur: ligne.organization ?? "",
      })),
    ecrire: async (ids) =>
      (
        await prisma.speaker.updateMany({
          where: { id: { in: ids } },
          data: { organization: nomComplet },
        })
      ).count,
  },
  {
    cle: "invitations",
    libelle: "Invitations",
    entite: "Invitation",
    lire: async () =>
      (
        await prisma.invitation.findMany({
          where: { organization: { not: null } },
          select: { id: true, firstName: true, lastName: true, email: true, organization: true },
          orderBy: { lastName: "asc" },
        })
      ).map((ligne) => ({
        id: ligne.id,
        nom: `${ligne.firstName} ${ligne.lastName}`.trim(),
        reference: ligne.email,
        valeur: ligne.organization ?? "",
      })),
    ecrire: async (ids) =>
      (
        await prisma.invitation.updateMany({
          where: { id: { in: ids } },
          data: { organization: nomComplet },
        })
      ).count,
  },
];

interface Tri {
  aHarmoniser: Fiche[];
  aVerifier: Fiche[];
  dejaBon: number;
  examinees: number;
}

function trier(fiches: Fiche[], cibleSigle: string, cibleNom: string): Tri {
  const tri: Tri = { aHarmoniser: [], aVerifier: [], dejaBon: 0, examinees: fiches.length };

  for (const fiche of fiches) {
    if (!fiche.valeur.trim()) continue;
    if (fiche.valeur === nomComplet) {
      tri.dejaBon += 1;
      continue;
    }
    const forme = normaliser(fiche.valeur);
    if (forme === cibleSigle || forme === cibleNom) tri.aHarmoniser.push(fiche);
    else if (forme.includes(cibleSigle)) tri.aVerifier.push(fiche);
  }
  return tri;
}

/** Les valeurs distinctes rencontrées, avec leur nombre — un inventaire se lit mieux groupé. */
function parValeur(fiches: Fiche[]): { valeur: string; nombre: number }[] {
  const comptes = new Map<string, number>();
  for (const fiche of fiches) comptes.set(fiche.valeur, (comptes.get(fiche.valeur) ?? 0) + 1);
  return [...comptes.entries()]
    .map(([valeur, nombre]) => ({ valeur, nombre }))
    .sort((a, b) => b.nombre - a.nombre || a.valeur.localeCompare(b.valeur, "fr"));
}

async function principal(): Promise<void> {
  const cibleSigle = normaliser(sigle);
  const cibleNom = normaliser(nomComplet);

  const inconnues = [...seulement].filter(
    (cle) => !COLLECTIONS.some((collection) => collection.cle === cle),
  );
  if (inconnues.length > 0) {
    console.error(
      `--seulement : collection inconnue (${inconnues.join(", ")}).\n` +
        `  Attendu : ${COLLECTIONS.map((collection) => collection.cle).join(", ")}.`,
    );
    process.exitCode = 1;
    return;
  }

  const retenues = COLLECTIONS.filter(
    (collection) => seulement.size === 0 || seulement.has(collection.cle),
  );

  console.log(`\nHarmonisation du champ « Organisation »`);
  console.log(`  sigle reconnu : ${sigle}`);
  console.log(`  valeur écrite : ${nomComplet}`);
  console.log(`  collections   : ${retenues.map((collection) => collection.cle).join(", ")}\n`);

  const plan: { collection: Collection; aEcrire: Fiche[]; tri: Tri }[] = [];
  let totalAVerifier = 0;

  for (const collection of retenues) {
    const tri = trier(await collection.lire(), cibleSigle, cibleNom);
    const forcees = tri.aVerifier.filter((fiche) => inclure.has(fiche.id));
    const restantAVerifier = tri.aVerifier.filter((fiche) => !inclure.has(fiche.id));
    const aEcrire = [...tri.aHarmoniser, ...forcees];

    console.log(`${collection.libelle} — ${tri.examinees} fiche(s) renseignent ce champ`);

    if (aEcrire.length === 0) {
      console.log("  à harmoniser : aucune");
    } else {
      console.log(`  à harmoniser : ${aEcrire.length}`);
      for (const { valeur, nombre } of parValeur(aEcrire)) {
        console.log(`      « ${valeur} » → ${nombre}`);
      }
    }
    if (tri.dejaBon > 0) console.log(`  déjà au bon format : ${tri.dejaBon}`);

    if (restantAVerifier.length > 0) {
      console.log(`  à vérifier, laissées intactes : ${restantAVerifier.length}`);
      for (const fiche of restantAVerifier) {
        console.log(`      « ${fiche.valeur} »`);
        console.log(`          ${fiche.nom} (${fiche.reference})  id: ${fiche.id}`);
      }
    }
    console.log("");

    totalAVerifier += restantAVerifier.length;
    plan.push({ collection, aEcrire, tri });
  }

  // Un identifiant passé à --inclure qui ne correspond à aucune fiche douteuse
  // est une faute de frappe, ou une fiche déjà traitée : mieux vaut s'arrêter
  // que d'écrire en laissant croire qu'elle a été prise en compte.
  const douteuses = new Set(plan.flatMap(({ tri }) => tri.aVerifier.map((fiche) => fiche.id)));
  const inconnus = [...inclure].filter((id) => !douteuses.has(id));
  if (inconnus.length > 0) {
    console.error(
      `Identifiants passés à --inclure mais absents des listes à vérifier :\n` +
        inconnus.map((id) => `  ${id}`).join("\n") +
        `\nRien n'a été écrit : vérifier les identifiants.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const total = plan.reduce((somme, { aEcrire }) => somme + aEcrire.length, 0);

  if (totalAVerifier > 0) {
    console.log(
      `${totalAVerifier} fiche(s) à vérifier au total. Elles ne seront pas modifiées ` +
        `tant qu'elles ne sont pas nommées par --inclure.\n`,
    );
  }

  if (!appliquer) {
    console.log(
      total > 0
        ? `Inventaire seul : ${total} fiche(s) seraient harmonisées. Relancer avec --appliquer.`
        : "Inventaire seul : rien à harmoniser.",
    );
    return;
  }

  if (total === 0) {
    console.log("Rien à harmoniser.");
    return;
  }

  /*
   * Une écriture par collection, une pour le journal.
   *
   * Le journal garde la valeur **d'avant**, fiche par fiche : c'est le seul
   * moyen de revenir en arrière si l'harmonisation a mordu sur une saisie
   * qu'on croyait équivalente. Un récapitulatif global ne le permettrait pas.
   */
  for (const { collection, aEcrire } of plan) {
    if (aEcrire.length === 0) continue;

    const modifies = await collection.ecrire(aEcrire.map((fiche) => fiche.id));
    await prisma.auditLog.createMany({
      data: aEcrire.map((fiche) => ({
        actorType: "SYSTEM" as const,
        action: "organization_harmonised_by_script",
        entity: collection.entite,
        entityId: fiche.id,
        before: { organization: fiche.valeur },
        after: { organization: nomComplet },
      })),
    });
    console.log(`${collection.libelle} : ${modifies} fiche(s) harmonisée(s).`);
  }

  console.log(
    `\nValeurs d'origine conservées dans le journal d'audit ` +
      `(action « organization_harmonised_by_script »).`,
  );
}

principal()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
