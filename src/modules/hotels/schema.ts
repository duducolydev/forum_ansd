import { z } from "zod";

/**
 * Saisie des hôtels partenaires et des contacts pratiques (§29).
 *
 * Les champs facultatifs acceptent la chaîne vide : c'est ce que renvoie un
 * formulaire HTML pour un champ laissé blanc, et la distinguer de `undefined`
 * n'apporterait rien ici — le service normalise en `null` juste après.
 */

const texteFacultatif = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const hotelInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'hôtel est requis").max(200),
  category: texteFacultatif(80),
  address: texteFacultatif(300),
  district: texteFacultatif(120),
  /*
   * Distance en kilomètres, jusqu'à 999,99. Le champ vient d'un `<input
   * type="number">`, donc d'une chaîne : `coerce` s'en charge, et la chaîne
   * vide devient `undefined` plutôt que zéro — « à 0 km » est un renseignement,
   * « non renseigné » en est un autre.
   */
  distanceKm: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce.number().min(0).max(999.99).optional(),
    )
    .optional(),
  phone: texteFacultatif(40),
  email: z
    .union([z.literal(""), z.string().trim().toLowerCase().email("Adresse e-mail invalide")])
    .optional(),
  website: z.union([z.literal(""), z.string().trim().url("Adresse web invalide")]).optional(),
  mapUrl: z.union([z.literal(""), z.string().trim().url("Lien de carte invalide")]).optional(),
  descriptionFr: texteFacultatif(3000),
  descriptionEn: texteFacultatif(3000),
  /*
   * Prestations saisies en une ligne, séparées par des virgules : c'est la
   * façon dont on les dicte au téléphone en négociant avec un hôtel. Le
   * découpage a lieu ici, pas dans le composant, pour que le service reçoive
   * toujours un tableau propre.
   */
  amenities: z
    .string()
    .trim()
    .max(600)
    .optional()
    .or(z.literal(""))
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  bookingCode: texteFacultatif(80),
  bookingUrl: z
    .union([z.literal(""), z.string().trim().url("Lien de réservation invalide")])
    .optional(),
  isPublished: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export type HotelInput = z.infer<typeof hotelInputSchema>;

export const hotelRateInputSchema = z.object({
  roomType: z.string().trim().min(1, "Le type de chambre est requis").max(120),
  price: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce.number().int().min(0).max(100_000_000).optional(),
    )
    .optional(),
  currency: z.string().trim().min(1).max(8).default("XOF"),
  conditions: texteFacultatif(600),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export type HotelRateInput = z.infer<typeof hotelRateInputSchema>;

export const practicalContactInputSchema = z.object({
  labelFr: z.string().trim().min(1, "L'intitulé est requis").max(160),
  labelEn: texteFacultatif(160),
  name: texteFacultatif(200),
  email: z
    .union([z.literal(""), z.string().trim().toLowerCase().email("Adresse e-mail invalide")])
    .optional(),
  phone: texteFacultatif(40),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export type PracticalContactInput = z.infer<typeof practicalContactInputSchema>;

export function parseHotelForm(formData: FormData): HotelInput {
  return hotelInputSchema.parse({
    name: formData.get("name"),
    category: formData.get("category") ?? "",
    address: formData.get("address") ?? "",
    district: formData.get("district") ?? "",
    distanceKm: formData.get("distanceKm") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    website: formData.get("website") ?? "",
    mapUrl: formData.get("mapUrl") ?? "",
    descriptionFr: formData.get("descriptionFr") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    amenities: formData.get("amenities") ?? "",
    bookingCode: formData.get("bookingCode") ?? "",
    bookingUrl: formData.get("bookingUrl") ?? "",
    isPublished: formData.get("isPublished") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
}

export function parseHotelRateForm(formData: FormData): HotelRateInput {
  return hotelRateInputSchema.parse({
    roomType: formData.get("roomType"),
    price: formData.get("price") ?? "",
    currency: formData.get("currency") || "XOF",
    conditions: formData.get("conditions") ?? "",
    sortOrder: formData.get("sortOrder") || 0,
  });
}

export function parsePracticalContactForm(formData: FormData): PracticalContactInput {
  return practicalContactInputSchema.parse({
    labelFr: formData.get("labelFr"),
    labelEn: formData.get("labelEn") ?? "",
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    sortOrder: formData.get("sortOrder") || 0,
  });
}
