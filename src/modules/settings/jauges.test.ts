import { describe, expect, it } from "vitest";
import { inscriptionsSchema } from "./schema";

/**
 * Jauges par journée (22 novembre 2026).
 *
 * Le réglage est nouveau : ce qui compte ici est qu'une édition **déjà
 * enregistrée**, dont le document de paramètres ne connaît pas ce champ,
 * continue de se lire sans rien casser — et qu'elle ne se mette pas à afficher
 * des jauges fantômes.
 */
describe("jauges par journée", () => {
  it("est absent d'une configuration existante, sans la rendre illisible", () => {
    const valeurs = inscriptionsSchema.parse({ active: true, validationComite: true });
    expect(valeurs.jauges).toEqual({});
  });

  it("accepte un nombre par journée, saisi comme texte par le formulaire", () => {
    const valeurs = inscriptionsSchema.parse({ jauges: { "2026-11-23": "600" } });
    expect(valeurs.jauges["2026-11-23"]).toBe(600);
  });

  it("refuse une clé qui n'est pas une date", () => {
    expect(() => inscriptionsSchema.parse({ jauges: { lundi: 600 } })).toThrow();
  });

  it("refuse une jauge négative", () => {
    expect(() => inscriptionsSchema.parse({ jauges: { "2026-11-23": -1 } })).toThrow();
  });
});
