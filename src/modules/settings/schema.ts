import { z } from "zod";

/**
 * Réglages de l'édition (brief §5.14), stockés dans `Edition.settings`.
 *
 * Un seul document JSON plutôt qu'une table de clés : ces réglages se lisent
 * toujours ensemble, au rendu de chaque page, et une lecture unique vaut mieux
 * qu'une dizaine. Chaque section porte ses propres valeurs par défaut, ce qui
 * rend le document tolérant : une édition semée avant l'ajout d'une section la
 * reçoit complète à la lecture, sans migration de données.
 *
 * Les dates sont des jours (« AAAA-MM-JJ ») et non des horodatages. Le Sénégal
 * est à UTC+0 toute l'année : la frontière de journée en UTC **est** la
 * frontière locale, et une fenêtre d'inscription se règle en jours, pas à la
 * minute près.
 */

const jour = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
  .or(z.literal(""));

export const inscriptionsSchema = z.object({
  /** Interrupteur manuel : ferme tout de suite, sans toucher aux dates. */
  active: z.boolean().default(true),
  ouvertureLe: jour.default(""),
  fermetureLe: jour.default(""),
  messageFermeFr: z
    .string()
    .trim()
    .max(600)
    .default("Les inscriptions ne sont pas ouvertes pour le moment."),
  messageFermeEn: z.string().trim().max(600).default("Registration is not open at the moment."),
});

/** Couleur hexadécimale à six chiffres — la forme courte complique le calcul de contraste. */
const couleur = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Couleur attendue au format #rrggbb");

/**
 * Polices proposées.
 *
 * Une liste courte et non un champ libre : chaque police est servie depuis le
 * domaine par `next/font` (le §7 proscrit les appels tiers non maîtrisés) et
 * doit avoir été vue en gras comme en petit corps.
 *
 * `pile` désigne la **variable CSS** posée par `next/font`, jamais le nom de la
 * famille : Next génère un nom haché à la compilation, et écrire « Source
 * Sans 3 » en clair ne désignerait rien. « Système » n'en a pas : c'est la pile
 * du système d'exploitation, sans aucun téléchargement.
 */
export const POLICES = [
  { cle: "inter", label: "Inter (par défaut)", pile: "var(--font-inter), sans-serif" },
  {
    cle: "systeme",
    label: "Système (aucun téléchargement)",
    pile: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  { cle: "source-sans", label: "Source Sans 3", pile: "var(--font-source-sans), sans-serif" },
  { cle: "ibm-plex", label: "IBM Plex Sans", pile: "var(--font-ibm-plex), sans-serif" },
] as const;

export const CLES_POLICES = ["inter", "systeme", "source-sans", "ibm-plex"] as const;

export const ANIMATIONS = [
  { cle: "aucune", label: "Aucune" },
  { cle: "discrete", label: "Discrète (fondu)" },
  { cle: "marquee", label: "Marquée (fondu et glissement)" },
] as const;

export const CLES_ANIMATIONS = ["aucune", "discrete", "marquee"] as const;

export const themeSchema = z.object({
  /** Couleur des boutons d'action ; le texte posé dessus est calculé, pas choisi. */
  primaire: couleur.default("#1d8247"),
  /** Couleur des liens et des titres. */
  secondaire: couleur.default("#0b4f8a"),
  accent: couleur.default("#b6831c"),
  police: z.enum(CLES_POLICES).default("inter"),
  /** Rayon des cartes et des boutons, en pixels. */
  rayon: z.coerce.number().int().min(0).max(28).default(12),
  animation: z.enum(CLES_ANIMATIONS).default("discrete"),
});

const lienPiedDePage = z.object({
  libelle: z.string().trim().min(1).max(60),
  url: z.string().trim().min(1).max(300),
});

const RESEAUX = ["linkedin", "x", "facebook", "youtube", "instagram", "site"] as const;

export type Reseau = (typeof RESEAUX)[number];

export const RESEAUX_LABELS: Record<Reseau, string> = {
  linkedin: "LinkedIn",
  x: "X / Twitter",
  facebook: "Facebook",
  youtube: "YouTube",
  instagram: "Instagram",
  site: "Site web",
};

export const piedDePageSchema = z.object({
  organisation: z
    .string()
    .trim()
    .max(200)
    .default("Agence nationale de la Statistique et de la Démographie"),
  adresse: z
    .string()
    .trim()
    .max(300)
    .default("Rocade Fann – Bel-Air – Cerf-volant, Dakar, Sénégal"),
  email: z.string().trim().max(190).default(""),
  telephone: z.string().trim().max(60).default(""),
  mentionCopyright: z.string().trim().max(120).default("© 2026 ANSD"),
  /** Un réseau sans adresse n'est pas affiché : c'est ainsi qu'on en retire un. */
  reseaux: z
    .array(z.object({ reseau: z.enum(RESEAUX), url: z.string().trim().max(300) }))
    .max(RESEAUX.length)
    .default([]),
  liens: z.array(lienPiedDePage).max(12).default([]),
});

/*
 * Valeurs par défaut de chaque section, calculées une fois au chargement.
 * `.default({})` ne suffit pas en zod v4 : la valeur par défaut doit être
 * complète, même quand tous les champs internes en ont déjà une.
 */
export const INSCRIPTIONS_PAR_DEFAUT = inscriptionsSchema.parse({});
export const THEME_PAR_DEFAUT = themeSchema.parse({});
export const PIED_DE_PAGE_PAR_DEFAUT = piedDePageSchema.parse({});

/**
 * Document complet. `.passthrough()` volontaire : le seed d'origine y avait posé
 * `registrationsOpenAt` et `featureFlags`, que rien ne lisait ; les écraser à la
 * première sauvegarde serait une perte silencieuse de données.
 */
export const parametresSchema = z
  .object({
    inscriptions: inscriptionsSchema.default(INSCRIPTIONS_PAR_DEFAUT),
    theme: themeSchema.default(THEME_PAR_DEFAUT),
    piedDePage: piedDePageSchema.default(PIED_DE_PAGE_PAR_DEFAUT),
  })
  .passthrough();

export type Inscriptions = z.infer<typeof inscriptionsSchema>;
export type ThemeEdition = z.infer<typeof themeSchema>;
export type PiedDePage = z.infer<typeof piedDePageSchema>;
export type Parametres = z.infer<typeof parametresSchema>;

/** Identité de l'édition : ces champs sont des colonnes, pas du JSON. */
export const identiteSchema = z
  .object({
    title: z.string().trim().min(3, "Le titre est requis.").max(200),
    theme: z.string().trim().max(300).optional().or(z.literal("")),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début attendue (AAAA-MM-JJ)"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin attendue (AAAA-MM-JJ)"),
    venue: z.string().trim().min(2, "Le lieu est requis.").max(200),
    city: z.string().trim().min(2, "La ville est requise.").max(120),
  })
  .refine((valeurs) => valeurs.endDate >= valeurs.startDate, {
    message: "La date de fin ne peut pas précéder la date de début.",
    path: ["endDate"],
  });

export const categorieSchema = z.object({
  labelFr: z.string().trim().min(2, "Le libellé français est requis.").max(120),
  labelEn: z.string().trim().min(2, "Le libellé anglais est requis.").max(120),
  color: couleur.optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
  autoConfirm: z.boolean(),
  requiresLogistics: z.boolean(),
  alertOnScan: z.boolean(),
});

export type Identite = z.infer<typeof identiteSchema>;
export type CategorieInput = z.infer<typeof categorieSchema>;
