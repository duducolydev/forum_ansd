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
  /**
   * Validation par le comité avant le badge (6 octobre 2026) : toute
   * inscription en ligne, invités compris, attend la confirmation du comité,
   * quelle que soit la « validation automatique » de sa catégorie. Le comptoir
   * et l'import par fichier n'y sont pas soumis : l'agent ou le comité y
   * valident déjà eux-mêmes.
   */
  validationComite: z.boolean().default(true),
  ouvertureLe: jour.default(""),
  fermetureLe: jour.default(""),
  messageFermeFr: z
    .string()
    .trim()
    .max(600)
    .default("Les inscriptions ne sont pas ouvertes pour le moment."),
  messageFermeEn: z.string().trim().max(600).default("Registration is not open at the moment."),
  messageFermePt: z.string().trim().max(600).default("As inscrições não estão abertas de momento."),
});

/**
 * Langues proposées aux visiteurs (30 septembre 2026).
 *
 * Le français et l'anglais le sont toujours. Le portugais s'active ici : on
 * peut le préparer en BackOffice — traduire les contenus — avant de l'ouvrir
 * au public. Désactivé, il disparaît du sélecteur, et un visiteur qui l'avait
 * choisi retombe sur l'anglais.
 */
export const languesSchema = z.object({
  portugais: z.boolean().default(true),
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

/** Ordre d'affichage dans le pied de page et dans le formulaire. */
export const RESEAUX = [
  "facebook",
  "linkedin",
  "x",
  "instagram",
  "tiktok",
  "youtube",
  "site",
] as const;

export type Reseau = (typeof RESEAUX)[number];

export const RESEAUX_LABELS: Record<Reseau, string> = {
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  site: "Site web",
};

/**
 * Comptes de l'ANSD (1er octobre 2026) : valeur par défaut d'une installation
 * neuve. Une base en service les reçoit par migration, sans écraser une saisie.
 */
export const RESEAUX_ANSD: { reseau: Reseau; url: string }[] = [
  { reseau: "facebook", url: "https://web.facebook.com/ansdsn" },
  {
    reseau: "linkedin",
    url: "https://www.linkedin.com/company/agence-nationale-de-la-statistique-et-de-la-d%C3%A9mographie-ansd/",
  },
  { reseau: "x", url: "https://x.com/statsenegal" },
  { reseau: "instagram", url: "https://www.instagram.com/ansdsenegal/" },
  { reseau: "tiktok", url: "https://www.tiktok.com/@ansdsenegal" },
];

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
  /**
   * Destinataire des messages du formulaire de contact (29 septembre 2026).
   * Jamais affiché sur le site : le visiteur écrit par le formulaire.
   */
  destinataireContact: z
    .email("Adresse de réception du formulaire invalide.")
    .trim()
    .max(190)
    .default("forumansd@gmail.com"),
  mentionCopyright: z.string().trim().max(120).default("© 2026 ANSD"),
  /** Un réseau sans adresse n'est pas affiché : c'est ainsi qu'on en retire un. */
  reseaux: z
    .array(z.object({ reseau: z.enum(RESEAUX), url: z.string().trim().max(300) }))
    .max(RESEAUX.length)
    .default(RESEAUX_ANSD),
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
export const LANGUES_PAR_DEFAUT = languesSchema.parse({});

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
    langues: languesSchema.default(LANGUES_PAR_DEFAUT),
  })
  .passthrough();

export type Inscriptions = z.infer<typeof inscriptionsSchema>;
export type ThemeEdition = z.infer<typeof themeSchema>;
export type PiedDePage = z.infer<typeof piedDePageSchema>;
export type Langues = z.infer<typeof languesSchema>;
export type Parametres = z.infer<typeof parametresSchema>;

/** Identité de l'édition : ces champs sont des colonnes, pas du JSON. */
export const identiteSchema = z
  .object({
    title: z.string().trim().min(3, "Le titre est requis.").max(200),
    titleEn: z.string().trim().max(200).optional().or(z.literal("")),
    titlePt: z.string().trim().max(200).optional().or(z.literal("")),
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
  labelPt: z.string().trim().max(120).optional().or(z.literal("")),
  color: couleur.optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
  autoConfirm: z.boolean(),
  requiresLogistics: z.boolean(),
  alertOnScan: z.boolean(),
  requiresAccreditation: z.boolean().default(false),
  // 24 octobre 2026 : catégories créées en BackOffice.
  isPublic: z.boolean().default(true),
  badgeMention: z
    .string()
    .trim()
    .max(30, "La mention du badge tient en 30 caractères au plus.")
    .optional()
    .or(z.literal("")),
});

/**
 * Nouvelle catégorie : les champs d'une catégorie, plus son code — figé ensuite,
 * il est référencé par la matrice d'accès et les imports — et les zones qu'elle
 * ouvre au départ.
 */
export const nouvelleCategorieSchema = categorieSchema.extend({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^$|^[A-Z][A-Z0-9_]{1,39}$/,
      "Code : lettres majuscules, chiffres et « _ », 40 caractères au plus (ex. COMITE_ORGANISATION).",
    )
    .optional()
    .or(z.literal("")),
  /** `TOUTES`, `AUCUNE`, ou l'identifiant d'une catégorie dont on copie les accès. */
  zonesDepuis: z.string().trim().min(1).max(40),
});

export type Identite = z.infer<typeof identiteSchema>;
export type CategorieInput = z.infer<typeof categorieSchema>;
export type NouvelleCategorieInput = z.infer<typeof nouvelleCategorieSchema>;
