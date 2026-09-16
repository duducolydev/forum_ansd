import type { Edition } from "@prisma/client";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getActiveEdition } from "@/lib/edition";
import {
  categorieSchema,
  identiteSchema,
  parametresSchema,
  type CategorieInput,
  type Identite,
  type Parametres,
} from "./schema";
import {
  CONTRASTE_MIN,
  CONTRASTE_MIN_LARGE,
  etatInscriptions,
  formaterRatio,
  verifierCouleur,
  verifierSurFonds,
  type EtatInscriptions,
} from "./regles";

export class ParametreRuleError extends Error {}

export interface Acteur {
  userId: string;
}

/**
 * Les réglages sont lus au rendu de **chaque** page publique (thème, pied de
 * page, ouverture des inscriptions). Même étiquette de cache que les contenus
 * éditoriaux, invalidée à l'enregistrement : sans cela, chaque visite paierait
 * une requête pour un document qui change quelques fois par mois.
 */
const ETIQUETTE_PARAMETRES = "parametres-edition";

/** Applique le schéma et ses valeurs par défaut à un document éventuellement ancien. */
export function lireParametres(edition: Pick<Edition, "settings">): Parametres {
  const brut = (edition.settings ?? {}) as Record<string, unknown>;
  const analyse = parametresSchema.safeParse(brut);
  if (analyse.success) return analyse.data;

  /*
   * Un document illisible ne doit pas éteindre le site : on repart des valeurs
   * par défaut plutôt que de propager l'erreur jusqu'à la page d'accueil. Le
   * cas ne peut venir que d'une écriture faite hors de cet écran.
   */
  console.error("Paramètres d'édition illisibles, valeurs par défaut appliquées.", analyse.error);
  return parametresSchema.parse({});
}

const parametresEnCache = unstable_cache(
  async () => {
    const edition = await getActiveEdition();
    return { edition, parametres: lireParametres(edition) };
  },
  ["parametres-edition"],
  { revalidate: 60, tags: [ETIQUETTE_PARAMETRES] },
);

/** Édition active et ses réglages, en une lecture mise en cache. */
export async function parametresEdition(): Promise<{ edition: Edition; parametres: Parametres }> {
  return parametresEnCache();
}

/**
 * Réglages pour le gabarit racine, qui ne doit **jamais** échouer.
 *
 * Le gabarit rend aussi l'écran de connexion et le scanner : une base
 * injoignable ou une édition absente ne doit pas produire une page blanche là
 * où un site aux couleurs par défaut ferait parfaitement l'affaire.
 */
export async function parametresPourGabarit(): Promise<Parametres> {
  try {
    const { parametres } = await parametresEdition();
    return parametres;
  } catch (erreur) {
    console.error("Paramètres indisponibles, apparence par défaut appliquée.", erreur);
    return parametresSchema.parse({});
  }
}

/**
 * Réglages lus **sans cache**, pour les chemins d'écriture.
 *
 * Le cache de 60 s convient à l'affichage : une couleur ou un pied de page qui
 * met une minute à changer ne gêne personne. Il ne convient pas à une décision
 * — laisser passer une inscription une minute après la fermeture du guichet
 * n'est pas un délai d'affichage, c'est une règle non appliquée. Cette lecture
 * ne dépend d'ailleurs d'aucun contexte de requête, ce qui la rend appelable
 * depuis un test comme depuis un job.
 */
export async function parametresFrais(): Promise<{ edition: Edition; parametres: Parametres }> {
  const edition = await getActiveEdition();
  return { edition, parametres: lireParametres(edition) };
}

/** État courant du guichet d'inscription, lu à la source. */
export async function etatInscriptionsCourant(): Promise<EtatInscriptions> {
  const { parametres } = await parametresFrais();
  return etatInscriptions(parametres.inscriptions);
}

async function enregistrer(
  editionId: string,
  parametres: Parametres,
  acteur: Acteur,
  action: string,
  avant: unknown,
  apres: unknown,
): Promise<void> {
  await prisma.edition.update({
    where: { id: editionId },
    data: { settings: parametres as object },
  });

  revalidateTag(ETIQUETTE_PARAMETRES);

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action,
    entity: "Edition",
    entityId: editionId,
    before: avant,
    after: apres,
  });
}

export async function enregistrerInscriptions(
  editionId: string,
  valeurs: Parametres["inscriptions"],
  acteur: Acteur,
): Promise<void> {
  const edition = await prisma.edition.findUniqueOrThrow({ where: { id: editionId } });
  const parametres = lireParametres(edition);

  if (valeurs.ouvertureLe && valeurs.fermetureLe && valeurs.fermetureLe < valeurs.ouvertureLe) {
    throw new ParametreRuleError("La fermeture ne peut pas précéder l'ouverture.");
  }

  const avant = parametres.inscriptions;
  await enregistrer(
    editionId,
    { ...parametres, inscriptions: valeurs },
    acteur,
    "edition.registration_settings_updated",
    avant,
    valeurs,
  );
}

export async function enregistrerTheme(
  editionId: string,
  valeurs: Parametres["theme"],
  acteur: Acteur,
): Promise<void> {
  const edition = await prisma.edition.findUniqueOrThrow({ where: { id: editionId } });
  const parametres = lireParametres(edition);

  /*
   * Le contraste est vérifié **ici**, à l'enregistrement, et non au rendu.
   * Refuser au rendu produirait un site qui se dégrade sans que personne
   * l'apprenne ; refuser à l'enregistrement le dit à celui qui peut corriger.
   *
   * Le formulaire fait la même vérification en direct, mais elle ne compte pas :
   * une action serveur s'appelle sans passer par l'écran qui la déclare.
   */
  for (const [nom, couleur] of [
    ["d'action", valeurs.primaire],
    ["des liens", valeurs.secondaire],
  ] as const) {
    const verdict = verifierCouleur(couleur);
    if (!verdict.conforme) {
      throw new ParametreRuleError(
        `La couleur ${nom} n'atteint que ${formaterRatio(verdict.ratio)} avec son texte, sous le minimum de ${formaterRatio(CONTRASTE_MIN)} exigé pour un site public.`,
      );
    }
  }

  // L'accent dessine le contour de focus au clavier : seuil non textuel de 3:1
  // (WCAG 1.4.11), sur le moins favorable des deux fonds de thème.
  const accent = verifierSurFonds(valeurs.accent);
  if (!accent.conforme) {
    throw new ParametreRuleError(
      `La couleur d'accent n'atteint que ${formaterRatio(accent.ratio)} sur le fond ${accent.fondLePire}, sous le minimum de ${formaterRatio(CONTRASTE_MIN_LARGE)} exigé pour un contour de focus.`,
    );
  }

  await enregistrer(
    editionId,
    { ...parametres, theme: valeurs },
    acteur,
    "edition.theme_updated",
    parametres.theme,
    valeurs,
  );
}

export async function enregistrerPiedDePage(
  editionId: string,
  valeurs: Parametres["piedDePage"],
  acteur: Acteur,
): Promise<void> {
  const edition = await prisma.edition.findUniqueOrThrow({ where: { id: editionId } });
  const parametres = lireParametres(edition);

  await enregistrer(
    editionId,
    { ...parametres, piedDePage: valeurs },
    acteur,
    "edition.footer_updated",
    parametres.piedDePage,
    valeurs,
  );
}

export async function enregistrerIdentite(
  editionId: string,
  valeurs: Identite,
  acteur: Acteur,
): Promise<void> {
  const avant = await prisma.edition.findUniqueOrThrow({ where: { id: editionId } });

  const apres = await prisma.edition.update({
    where: { id: editionId },
    data: {
      title: valeurs.title,
      theme: valeurs.theme?.trim() || null,
      // Minuit UTC, qui est minuit à Dakar : les dates du Forum sont des jours,
      // pas des instants.
      startDate: new Date(`${valeurs.startDate}T00:00:00.000Z`),
      endDate: new Date(`${valeurs.endDate}T00:00:00.000Z`),
      venue: valeurs.venue,
      city: valeurs.city,
    },
  });

  revalidateTag(ETIQUETTE_PARAMETRES);

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "edition.identity_updated",
    entity: "Edition",
    entityId: editionId,
    before: { title: avant.title, startDate: avant.startDate, venue: avant.venue },
    after: { title: apres.title, startDate: apres.startDate, venue: apres.venue },
  });
}

// --- Catégories de participants --------------------------------------------

export async function listerCategories(editionId: string) {
  return prisma.participantCategory.findMany({
    where: { editionId },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { participants: true } } },
  });
}

export async function enregistrerCategorie(
  editionId: string,
  categoryId: string,
  valeurs: CategorieInput,
  acteur: Acteur,
) {
  const avant = await prisma.participantCategory.findFirst({
    where: { id: categoryId, editionId },
  });
  if (!avant) throw new ParametreRuleError("Catégorie introuvable.");

  const apres = await prisma.participantCategory.update({
    where: { id: categoryId },
    data: {
      labelFr: valeurs.labelFr,
      labelEn: valeurs.labelEn,
      color: valeurs.color?.trim() || null,
      sortOrder: valeurs.sortOrder,
      isActive: valeurs.isActive,
      autoConfirm: valeurs.autoConfirm,
      requiresLogistics: valeurs.requiresLogistics,
      alertOnScan: valeurs.alertOnScan,
    },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "participant_category.updated",
    entity: "ParticipantCategory",
    entityId: categoryId,
    before: {
      labelFr: avant.labelFr,
      autoConfirm: avant.autoConfirm,
      isActive: avant.isActive,
      alertOnScan: avant.alertOnScan,
    },
    after: {
      labelFr: apres.labelFr,
      autoConfirm: apres.autoConfirm,
      isActive: apres.isActive,
      alertOnScan: apres.alertOnScan,
    },
  });

  return apres;
}

export { categorieSchema, identiteSchema };
