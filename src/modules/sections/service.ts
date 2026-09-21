import type { PageSection } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { detecterImageDeposee } from "@/lib/image-deposee";
import { IMAGE_SECTION_MAX_BYTES } from "./constantes";
import { getContentText } from "@/modules/content/service";
import { besoinsDe, reglagesParDefaut, typeSection, type Besoin } from "./catalogue";
import { blocsRequis, COMPOSITIONS, resoudreContenu } from "./defaut";
import { lireTexte, normaliserSection, type SectionInput } from "./schema";

export interface Acteur {
  userId: string;
}

/**
 * Sections visibles d'une page, **lues sans cache**.
 *
 * Elles l'étaient auparavant par `unstable_cache` (60 s, étiquette
 * « sections-page » invalidée à chaque écriture). Mesuré sur l'image de
 * production : après un enregistrement depuis le BackOffice, la page publique
 * servait encore l'ancienne composition **plus de 90 secondes**, alors que le
 * même changement écrit directement en base apparaissait en 15. L'invalidation
 * par étiquette ne tenait donc pas, et le cache faisait pire que rien — un
 * administrateur qui ajoute une section ne la voyait pas apparaître.
 *
 * La lecture remplacée ne coûte presque rien : une poignée de lignes, sur un
 * index, dans une page déjà rendue à chaque requête. Trois tests de bout en bout
 * tiennent la propriété (`e2e/parametres.spec.ts`).
 */
export async function sectionsVisibles(editionId: string, page: string): Promise<PageSection[]> {
  const sections = await prisma.pageSection.findMany({
    where: { editionId, page, isVisible: true },
    orderBy: { sortOrder: "asc" },
  });
  return sections;
}

export async function listerSections(editionId: string, page: string): Promise<PageSection[]> {
  return prisma.pageSection.findMany({ where: { editionId, page }, orderBy: { sortOrder: "asc" } });
}

export async function trouverSection(sectionId: string): Promise<PageSection | null> {
  return prisma.pageSection.findUnique({ where: { id: sectionId } });
}

/** Données nécessaires aux sections d'une page, chargées en une seule passe. */
export function besoinsDesSections(sections: PageSection[]): Set<Besoin> {
  return besoinsDe(sections.map((section) => section.type));
}

export class SectionRuleError extends Error {}

/**
 * Enregistre l'illustration d'une section et renvoie son chemin.
 *
 * Le nom porte un suffixe aléatoire plutôt que d'écraser le précédent : un
 * remplacement produit une nouvelle URL, donc aucun cache ne peut servir
 * l'ancienne image. L'ancien fichier est supprimé par l'appelant, une fois la
 * section mise à jour — l'effacer avant laisserait une section qui pointe vers
 * un fichier disparu si l'écriture échouait.
 */
export async function deposerImageSection(sectionId: string, fichier: File): Promise<string> {
  if (fichier.size > IMAGE_SECTION_MAX_BYTES) {
    throw new SectionRuleError(
      `Image trop lourde (maximum ${IMAGE_SECTION_MAX_BYTES / 1024 / 1024} Mo).`,
    );
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  const { type, refus } = detecterImageDeposee(octets);
  if (!type) throw new SectionRuleError(refus ?? "Format d'image non reconnu.");

  const chemin = `sections/${sectionId}-${randomBytes(6).toString("hex")}.${type.extension}`;
  await fileStorage.put(chemin, octets, type.type);
  return chemin;
}

/**
 * Efface une illustration devenue orpheline.
 *
 * L'échec est avalé : un fichier absent du stockage n'est pas un incident, et
 * ce nettoyage ne doit jamais faire échouer l'enregistrement d'une section.
 */
export async function oublierImageSection(chemin: string): Promise<void> {
  await fileStorage.delete(chemin).catch(() => undefined);
}

/**
 * Rafraîchit les écrans qui montrent les sections.
 *
 * L'écran du BackOffice est rendu une fois et gardé : sans cela, la liste
 * resterait telle qu'elle était avant l'enregistrement. La page publique, elle,
 * est rendue à chaque requête et lit la base sans cache (voir
 * `sectionsVisibles`) ; l'appel qui la concerne reste par sécurité, au cas où
 * elle deviendrait statique.
 */
function invalider(page: string): void {
  revalidatePath("/admin/parametres/sections");
  if (page === "accueil") revalidatePath("/");
}

/**
 * Écrit la composition d'origine en base, une seule fois, avant la première
 * section ajoutée à la main.
 *
 * Sans cela, ajouter une section pour l'essayer **effaçait la page entière** :
 * le rendu bascule sur les sections enregistrées dès qu'il en existe une, et
 * l'unique section neuve remplaçait bandeau, texte et actualités. Le défaut a
 * été constaté sur l'instance de démonstration, où une section créée par un test
 * a fait disparaître l'accueil.
 *
 * Les textes sont figés au moment de la matérialisation : ils viennent des blocs
 * éditoriaux, qui restent modifiables sous Contenus, mais la section porte
 * désormais sa propre copie — c'est le prix de la reprise en main, et le contenu
 * affiché ne change pas sous les yeux de qui vient de le reprendre.
 */
async function materialiserComposition(editionId: string, page: string): Promise<void> {
  const composition = COMPOSITIONS[page];
  if (!composition || composition.length === 0) return;

  const cles = blocsRequis(composition);
  const textesFr: Record<string, string> = {};
  const textesEn: Record<string, string> = {};
  for (const cle of cles) {
    textesFr[cle] = await getContentText(editionId, cle, "fr");
    textesEn[cle] = await getContentText(editionId, cle, "en");
  }

  await prisma.pageSection.createMany({
    data: composition.map((modele) => ({
      editionId,
      page,
      type: modele.type,
      variant: modele.variant,
      sortOrder: modele.sortOrder,
      isVisible: true,
      settings: modele.settings as object,
      contentFr: resoudreContenu(modele, textesFr, "fr"),
      contentEn: resoudreContenu(modele, textesEn, "en"),
    })),
  });
}

export async function creerSection(
  editionId: string,
  page: string,
  type: string,
  acteur: Acteur,
): Promise<PageSection> {
  const modele = typeSection(type);
  if (!modele) throw new SectionRuleError("Type de section inconnu.");

  // Première section de cette page : on inscrit d'abord la composition
  // d'origine, pour ne pas la perdre.
  const existantes = await prisma.pageSection.count({ where: { editionId, page } });
  if (existantes === 0) {
    await materialiserComposition(editionId, page);
  }

  // Placée en dernier : une section neuve ne doit pas s'insérer au milieu d'une
  // page que l'on vient d'ordonner.
  const dernier = await prisma.pageSection.aggregate({
    where: { editionId, page },
    _max: { sortOrder: true },
  });

  const section = await prisma.pageSection.create({
    data: {
      editionId,
      page,
      type,
      variant: modele.variantes[0]!.cle,
      sortOrder: (dernier._max.sortOrder ?? 0) + 10,
      // Masquée à la création : on la règle avant de la montrer au public.
      isVisible: false,
      settings: reglagesParDefaut(type) as object,
      contentFr: {},
      contentEn: {},
    },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "page_section.created",
    entity: "PageSection",
    entityId: section.id,
    after: { page, type },
  });

  invalider(page);
  return section;
}

export async function enregistrerSection(
  sectionId: string,
  input: SectionInput,
  acteur: Acteur,
): Promise<PageSection> {
  const avant = await prisma.pageSection.findUnique({ where: { id: sectionId } });
  if (!avant) throw new SectionRuleError("Section introuvable.");

  const normalise = normaliserSection({ ...input, type: avant.type, page: avant.page });

  const apres = await prisma.pageSection.update({
    where: { id: sectionId },
    data: {
      variant: normalise.variant,
      isVisible: normalise.isVisible,
      settings: normalise.settings as object,
      contentFr: normalise.contentFr,
      contentEn: normalise.contentEn,
    },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "page_section.updated",
    entity: "PageSection",
    entityId: sectionId,
    before: { variant: avant.variant, isVisible: avant.isVisible },
    after: { variant: apres.variant, isVisible: apres.isVisible },
  });

  invalider(avant.page);
  return apres;
}

/**
 * Déplace une section d'un cran.
 *
 * Par échange de rangs avec la voisine, et non par glisser-déposer : deux
 * boutons se manipulent au clavier, se testent, et fonctionnent sur téléphone.
 * C'est le même raisonnement que pour T43.
 */
export async function deplacerSection(
  sectionId: string,
  sens: "haut" | "bas",
  acteur: Acteur,
): Promise<void> {
  const section = await prisma.pageSection.findUnique({ where: { id: sectionId } });
  if (!section) throw new SectionRuleError("Section introuvable.");

  const voisine = await prisma.pageSection.findFirst({
    where: {
      editionId: section.editionId,
      page: section.page,
      sortOrder: sens === "haut" ? { lt: section.sortOrder } : { gt: section.sortOrder },
    },
    orderBy: { sortOrder: sens === "haut" ? "desc" : "asc" },
  });
  if (!voisine) return;

  await prisma.$transaction([
    prisma.pageSection.update({
      where: { id: section.id },
      data: { sortOrder: voisine.sortOrder },
    }),
    prisma.pageSection.update({
      where: { id: voisine.id },
      data: { sortOrder: section.sortOrder },
    }),
  ]);

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "page_section.moved",
    entity: "PageSection",
    entityId: sectionId,
    after: { sens, page: section.page },
  });

  invalider(section.page);
}

export async function supprimerSection(sectionId: string, acteur: Acteur): Promise<void> {
  const section = await prisma.pageSection.findUnique({ where: { id: sectionId } });
  if (!section) throw new SectionRuleError("Section introuvable.");

  await prisma.pageSection.delete({ where: { id: sectionId } });

  /*
   * L'illustration part avec la section, **après** la suppression en base : dans
   * l'autre ordre, un échec laisserait une section pointant vers un fichier
   * disparu. Sans cette ligne, chaque section supprimée laissait son image sur le
   * disque, sans plus rien pour y mener — trouvé en contrôlant le stockage (§17).
   */
  const illustration = lireTexte(section.settings, "image");
  if (illustration) await oublierImageSection(illustration);

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "page_section.deleted",
    entity: "PageSection",
    entityId: sectionId,
    before: { page: section.page, type: section.type, illustration: illustration || null },
  });

  invalider(section.page);
}
