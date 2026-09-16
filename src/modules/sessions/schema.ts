import { z } from "zod";

/**
 * Programme et sessions (brief §5.5, §5.8).
 *
 * Les horaires sont saisis en `jour` + `HH:MM` et recomposés en `DateTime` UTC :
 * le Forum se tient à Dakar, dont le fuseau est UTC toute l'année, donc l'heure
 * saisie est l'heure vécue sur place. Écrit explicitement ici pour que le jour
 * où une édition se tiendrait ailleurs, on tombe sur cette règle plutôt que sur
 * un décalage silencieux.
 */
export const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * 8 Mo : des termes de référence de quelques dizaines de pages y tiennent.
 *
 * Ici et non dans `actions.ts` : un fichier `"use server"` ne peut exporter que
 * des fonctions asynchrones, et Next ne le signale qu'à l'exécution — ni le
 * typage ni le lint ne l'attrapent.
 */
export const TDR_MAX_BYTES = 8 * 1024 * 1024;

export const roomInputSchema = z.object({
  name: z.string().trim().min(2, "Le nom de la salle est requis").max(100),
  capacity: z.coerce.number().int().min(1).max(10000).optional(),
  floor: z.string().trim().max(40).optional().or(z.literal("")),
});

export type RoomInput = z.infer<typeof roomInputSchema>;

export const SESSION_TYPES = [
  "OPENING",
  "PLENARY",
  "PANEL",
  "INAUGURAL",
  "AWARDS",
  "BREAK",
  "LUNCH",
  "CLOSING",
  "SIDE_EVENT",
] as const;

export const sessionInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .max(150)
      .regex(/^[a-z0-9]*(?:-[a-z0-9]+)*$/, "Minuscules, chiffres et tirets uniquement")
      .optional()
      .or(z.literal("")),
    type: z.enum(SESSION_TYPES),
    number: z.coerce.number().int().min(1).max(999).optional(),
    titleFr: z.string().trim().min(3, "Le titre français est requis").max(200),
    titleEn: z.string().trim().max(200).optional().or(z.literal("")),
    descriptionFr: z.string().trim().max(5000).optional().or(z.literal("")),
    descriptionEn: z.string().trim().max(5000).optional().or(z.literal("")),
    objectives: z.string().trim().max(3000).optional().or(z.literal("")),
    theme: z.string().trim().max(120).optional().or(z.literal("")),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Jour attendu au format AAAA-MM-JJ"),
    startTime: z.string().regex(HEURE, "Heure de début attendue au format HH:MM"),
    endTime: z.string().regex(HEURE, "Heure de fin attendue au format HH:MM"),
    roomId: z.string().max(40).optional().or(z.literal("")),
    capacity: z.coerce.number().int().min(1).max(10000).optional(),
    registrationOpen: z.boolean().default(false),
    registrationDeadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Échéance attendue au format AAAA-MM-JJ")
      .optional()
      .or(z.literal("")),
    waitlistEnabled: z.boolean().default(true),
    vipQuota: z.coerce.number().int().min(0).max(10000).optional(),
    liveStreamUrl: z.string().trim().url("Lien de diffusion invalide").optional().or(z.literal("")),
    isPublished: z.boolean().default(false),
  })
  .refine((valeurs) => valeurs.endTime > valeurs.startTime, {
    message: "L'heure de fin doit suivre l'heure de début",
    path: ["endTime"],
  })
  .refine((valeurs) => !valeurs.registrationOpen || valeurs.capacity !== undefined, {
    // Une session ouverte sans capacité accepterait un nombre illimité
    // d'inscrits, ce qui n'a pas de sens dans une salle.
    message: "Une session ouverte à la réservation doit avoir une capacité",
    path: ["capacity"],
  })
  .refine(
    (valeurs) =>
      valeurs.vipQuota === undefined ||
      valeurs.capacity === undefined ||
      valeurs.vipQuota <= valeurs.capacity,
    {
      message: "Le quota VIP ne peut pas dépasser la capacité",
      path: ["vipQuota"],
    },
  );

export type SessionInput = z.infer<typeof sessionInputSchema>;

/** Libellés d'affichage des types de session. */
export const TYPE_LABELS: Record<(typeof SESSION_TYPES)[number], string> = {
  OPENING: "Ouverture",
  PLENARY: "Plénière",
  PANEL: "Panel",
  INAUGURAL: "Conférence inaugurale",
  AWARDS: "Remise de prix",
  BREAK: "Pause",
  LUNCH: "Déjeuner",
  CLOSING: "Clôture",
  SIDE_EVENT: "Événement parallèle",
};

/** Slug lisible dérivé du titre, quand l'utilisateur n'en fournit pas. */
export function slugifier(titre: string): string {
  return (
    titre
      .normalize("NFD")
      // Plage des diacritiques combinants, en échappements : ces caractères sont
      // invisibles dans un éditeur et se perdent au premier copier-coller.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120)
  );
}
