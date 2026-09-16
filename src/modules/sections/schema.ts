import { z } from "zod";
import { normaliserTexteRiche, TAILLE_MAX_DOCUMENT } from "@/lib/texte-riche";
import { CLES_TYPES, typeSection, type BoutonSection } from "./catalogue";

/** Un bouton d'appel à l'action : adresse interne ou externe, libellé par langue. */
export const boutonSchema = z.object({
  href: z.string().trim().min(1).max(300),
  labelFr: z.string().trim().min(1).max(60),
  labelEn: z.string().trim().max(60).default(""),
  style: z.enum(["principal", "secondaire"]).default("secondaire"),
});

export const sectionInputSchema = z.object({
  page: z.string().trim().min(1).max(40),
  type: z.enum(CLES_TYPES as [string, ...string[]]),
  variant: z.string().trim().min(1).max(40),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isVisible: z.boolean(),
  // Plafond du document stocké, balisage compris. La longueur **visible** de
  // chaque champ est vérifiée à part, contre le catalogue.
  contentFr: z.record(z.string(), z.string().max(TAILLE_MAX_DOCUMENT)),
  contentEn: z.record(z.string(), z.string().max(TAILLE_MAX_DOCUMENT)),
  settings: z.record(z.string(), z.unknown()),
});

export type SectionInput = z.infer<typeof sectionInputSchema>;

/** Refus lié au contenu saisi : le message est destiné à l'écran. */
export class ContenuSectionError extends Error {}

/**
 * Réduit une ancre à ce qui tient dans une URL.
 *
 * Les accents sont dépliés puis retirés, le reste devient des tirets. Une ancre
 * saisie « À propos » donne donc `a-propos`, ce qui est à la fois ce qu'on
 * attend et ce qui survit à une copie de lien : un `#À%20propos` fonctionne
 * dans le navigateur qui l'a produit et nulle part ailleurs.
 */
export function normaliserAncre(brut: unknown): string {
  if (typeof brut !== "string") return "";
  return brut
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Valide la variante, les réglages et le contenu **contre le catalogue** du type.
 *
 * Le formulaire ne propose que des valeurs justes, mais une Server Action
 * s'appelle sans passer par lui : une variante inconnue produirait une section
 * qui ne se rend pas, et un réglage hors bornes une page absurde.
 */
export function normaliserSection(input: SectionInput): SectionInput {
  const type = typeSection(input.type);
  if (!type) throw new Error("Type de section inconnu.");

  const variante = type.variantes.some((candidate) => candidate.cle === input.variant)
    ? input.variant
    : type.variantes[0]!.cle;

  const reglages: Record<string, unknown> = {};
  for (const champ of type.reglages) {
    const brut = input.settings[champ.cle];
    if (champ.type === "booleen") {
      reglages[champ.cle] = brut === true || brut === "on";
    } else if (champ.type === "nombre") {
      const valeur = Number(brut);
      reglages[champ.cle] = Number.isFinite(valeur)
        ? Math.min(champ.max, Math.max(champ.min, Math.round(valeur)))
        : champ.defaut;
    } else if (champ.type === "ancre") {
      reglages[champ.cle] = normaliserAncre(brut);
    } else if (champ.type === "choix") {
      // Une valeur hors de la liste retombe sur la valeur par défaut, jamais
      // sur une chaîne arbitraire que le rendu ne saurait pas lire.
      reglages[champ.cle] = champ.options.some((option) => option.cle === brut)
        ? brut
        : champ.defaut;
    } else if (champ.type === "image") {
      /*
       * Le chemin d'illustration n'est pas saisi : il est produit par le dépôt
       * du fichier. On le reprend tel quel, et une valeur absente vaut « pas
       * d'image » — ce qui permet de retirer une illustration en soumettant le
       * formulaire sans elle.
       */
      reglages[champ.cle] = typeof brut === "string" ? brut : "";
    } else {
      const analyse = z
        .array(boutonSchema)
        .max(champ.max)
        .safeParse(brut ?? []);
      reglages[champ.cle] = analyse.success ? analyse.data : [];
    }
  }

  /*
   * Seuls les champs déclarés par le type sont conservés : un contenu orphelin
   * survivrait à un changement de type sans jamais être affiché ni modifiable.
   *
   * La longueur est vérifiée ici et non seulement par l'attribut `maxLength` du
   * formulaire : l'éditeur mis en forme n'en a pas, et une Server Action
   * s'appelle sans formulaire. Pour un champ mis en forme, c'est le texte
   * visible qui compte, pas le balisage.
   */
  const normaliserContenu = (contenu: Record<string, string>, langue: string) =>
    Object.fromEntries(
      type.champs.map((champ) => {
        const brut = contenu[champ.cle] ?? "";
        const { valeur, longueur } =
          champ.type === "riche"
            ? normaliserTexteRiche(brut)
            : { valeur: brut, longueur: brut.length };
        if (longueur > champ.max) {
          throw new ContenuSectionError(
            `« ${champ.label} » (${langue}) dépasse ${champ.max} caractères : ${longueur} saisis.`,
          );
        }
        return [champ.cle, valeur];
      }),
    );

  return {
    ...input,
    variant: variante,
    settings: reglages,
    contentFr: normaliserContenu(input.contentFr, "français"),
    contentEn: normaliserContenu(input.contentEn, "anglais"),
  };
}

/** Lit les boutons d'une section en tolérant un document ancien ou vide. */
export function lireBoutons(brut: unknown): BoutonSection[] {
  const analyse = z.array(boutonSchema).safeParse(brut ?? []);
  return analyse.success ? (analyse.data as BoutonSection[]) : [];
}

/** Lit un dictionnaire de contenu en tolérant `null` ou une valeur mal formée. */
export function lireContenu(brut: unknown): Record<string, string> {
  const analyse = z.record(z.string(), z.string()).safeParse(brut ?? {});
  return analyse.success ? analyse.data : {};
}

/** Lit un nombre de réglage, avec repli sur la valeur par défaut du catalogue. */
export function lireNombre(settings: unknown, cle: string, defaut: number): number {
  const valeur = (settings as Record<string, unknown> | null)?.[cle];
  const nombre = Number(valeur);
  return Number.isFinite(nombre) ? nombre : defaut;
}

/** Lit un réglage textuel, en tolérant une section enregistrée avant son ajout. */
export function lireTexte(settings: unknown, cle: string): string {
  const valeur = (settings as Record<string, unknown> | null)?.[cle];
  return typeof valeur === "string" ? valeur : "";
}

export function lireBooleen(settings: unknown, cle: string, defaut: boolean): boolean {
  const valeur = (settings as Record<string, unknown> | null)?.[cle];
  return typeof valeur === "boolean" ? valeur : defaut;
}
