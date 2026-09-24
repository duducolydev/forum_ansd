import { z } from "zod";

/**
 * Référent interne d'une délégation (§28).
 *
 * L'adresse e-mail est la clé métier : c'est elle qui reçoit les alertes, et
 * c'est sur elle que porte l'unicité en base. Elle est donc normalisée ici, en
 * minuscules et sans espaces de bord, plutôt qu'au moment de l'écriture — sans
 * quoi « A.Diop@ansd.sn » et « a.diop@ansd.sn » créeraient deux fiches pour la
 * même personne, qui recevrait chaque alerte en double.
 */
export const referentInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom du référent est requis").max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "L'adresse e-mail est requise")
    .email("Adresse e-mail invalide")
    .max(320),
  /*
   * Téléphone laissé libre : les participants viennent d'une trentaine de pays
   * et le référent donne son numéro sous la forme qu'il utilise. Une expression
   * régulière stricte aurait refusé des numéros parfaitement valides, sans rien
   * protéger — ce champ n'est jamais composé automatiquement, il est lu.
   */
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  isActive: z.coerce.boolean().default(true),
});

export type ReferentInput = z.infer<typeof referentInputSchema>;

/** Lecture d'un formulaire BackOffice : les cases à cocher absentes valent `false`. */
export function parseReferentForm(formData: FormData): ReferentInput {
  return referentInputSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role") ?? "",
    isActive: formData.get("isActive") === "on",
  });
}
