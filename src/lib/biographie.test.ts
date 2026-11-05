import { describe, expect, it } from "vitest";
import {
  BIOGRAPHIE_MAX_CARACTERES,
  BIOGRAPHIE_MAX_MOTS,
  compterMots,
  extraitBiographie,
  schemaBiographie,
} from "./biographie";

describe("limites de la biographie", () => {
  it("compte les mots quels que soient les espaces et retours à la ligne", () => {
    expect(compterMots("")).toBe(0);
    expect(compterMots("   ")).toBe(0);
    expect(compterMots("  Statisticienne  à\nl'ANSD,\tdepuis 2010. ")).toBe(5);
  });

  it("accepte 600 mots et refuse le 601e", () => {
    const mots = (n: number) => Array.from({ length: n }, () => "mot").join(" ");
    expect(schemaBiographie.safeParse(mots(BIOGRAPHIE_MAX_MOTS)).success).toBe(true);
    const refus = schemaBiographie.safeParse(mots(BIOGRAPHIE_MAX_MOTS + 1));
    expect(refus.success).toBe(false);
    expect(refus.error?.issues[0]?.message).toBe("600 mots maximum");
  });

  it("refuse au-delà de 5000 caractères, même en peu de mots", () => {
    expect(schemaBiographie.safeParse("x".repeat(BIOGRAPHIE_MAX_CARACTERES)).success).toBe(true);
    const refus = schemaBiographie.safeParse("x".repeat(BIOGRAPHIE_MAX_CARACTERES + 1));
    expect(refus.success).toBe(false);
    expect(refus.error?.issues[0]?.message).toBe("5000 caractères maximum");
  });

  it("reste facultative", () => {
    expect(schemaBiographie.safeParse("").success).toBe(true);
    expect(schemaBiographie.safeParse(undefined).success).toBe(true);
  });
});

describe("extrait de biographie pour les cartes", () => {
  it("laisse entière une biographie courte, ou à peine plus longue que la limite", () => {
    expect(extraitBiographie("Statisticienne.", 50)).toEqual({
      extrait: "Statisticienne.",
      tronquee: false,
    });
    expect(extraitBiographie("x".repeat(54), 50).tronquee).toBe(false);
  });

  it("coupe une biographie longue à la fin d'un mot, avec des points de suspension", () => {
    const bio =
      "Statisticienne de formation, elle dirige depuis 2015 les enquêtes démographiques et de santé.";
    const { extrait, tronquee } = extraitBiographie(bio, 40);
    expect(tronquee).toBe(true);
    expect(extrait).toBe("Statisticienne de formation, elle…");
    expect(bio.startsWith(extrait.slice(0, -1))).toBe(true);
  });
});
