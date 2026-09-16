import "dotenv/config";
import { prisma } from "../src/lib/db";

/**
 * Ajoute la section « À propos » à la page d'accueil d'une édition existante.
 *
 *   pnpm section:a-propos          # applique
 *   pnpm section:a-propos --essai  # montre ce qui serait fait, sans écrire
 *
 * ## Pourquoi un script et non une modification du code
 *
 * La composition d'origine de l'accueil vit dans `src/modules/sections/defaut.ts`
 * (§8.4). Elle ne sert qu'aux installations **où personne n'a encore touché aux
 * sections** : dès qu'une première section est enregistrée, la composition est
 * matérialisée en base et c'est la base qui pilote la page.
 *
 * Sur une installation déjà utilisée, modifier `defaut.ts` n'a donc aucun effet
 * visible. C'est ce qui s'est produit : la composition avait été matérialisée,
 * et la page continuait d'afficher les trois sections d'origine.
 *
 * Le script est **idempotent** : relancé, il ne crée pas de doublon. Il peut
 * donc s'appliquer sans crainte à un poste de développement, à une recette et à
 * la production, qui ne sont pas au même stade.
 */

const ANCRE = "a-propos";
const PAGE = "accueil";

/** Placée entre le bandeau d'ouverture (10) et le bloc des objectifs (20). */
const RANG = 15;

async function main(): Promise<void> {
  const essai = process.argv.includes("--essai");

  const edition = await prisma.edition.findFirst({ where: { isActive: true } });
  if (!edition) throw new Error("Aucune édition active.");

  const sections = await prisma.pageSection.findMany({
    where: { editionId: edition.id, page: PAGE },
    orderBy: { sortOrder: "asc" },
  });

  if (sections.length === 0) {
    console.log(
      "Aucune section en base : la page suit encore la composition du code, qui contient déjà « À propos ». Rien à faire.",
    );
    return;
  }

  const existante = sections.find(
    (section) => (section.settings as Record<string, unknown> | null)?.ancre === ANCRE,
  );
  if (existante) {
    console.log(`Section « À propos » déjà présente (${existante.id}). Rien à faire.`);
    return;
  }

  const bloc = await prisma.contentBlock.findFirst({
    where: { editionId: edition.id, key: "about.body" },
  });
  if (!bloc?.valueFr) {
    throw new Error("Le bloc éditorial « about.body » est vide : rien à déplacer.");
  }

  /*
   * Le rang doit rester libre. S'il est déjà pris, on décale d'un cran plutôt
   * que d'écraser l'ordre choisi par l'utilisateur : deux sections au même rang
   * s'affichent dans un ordre que rien ne garantit.
   */
  const pris = new Set(sections.map((section) => section.sortOrder));
  let rang = RANG;
  while (pris.has(rang)) rang += 1;

  const donnees = {
    editionId: edition.id,
    page: PAGE,
    type: "texte",
    variant: "adouci",
    sortOrder: rang,
    isVisible: true,
    settings: { ancre: ANCRE },
    contentFr: { titre: "À propos du Forum", corps: bloc.valueFr },
    contentEn: { titre: "About the Forum", corps: bloc.valueEn || bloc.valueFr },
  };

  if (essai) {
    console.log("Essai — la section suivante serait créée :");
    console.log(
      JSON.stringify({ ...donnees, contentFr: { ...donnees.contentFr, corps: "…" } }, null, 2),
    );
    return;
  }

  const creee = await prisma.pageSection.create({ data: donnees });
  console.log(`Section « À propos » créée (${creee.id}), rang ${rang}, ancre #${ANCRE}.`);
  console.log("Elle se modifie en BackOffice : Paramètres → Sections de l'accueil.");
}

main()
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
