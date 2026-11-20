import { describe, expect, it } from "vitest";
import { completerCourbe, creneau, jetonValide, jourDe, CRENEAU_MS } from "./audience";

/**
 * Règles de l'affluence du direct.
 *
 * Elles décident d'un chiffre que le comité lira comme une mesure : une erreur
 * ici ne se voit pas, elle se croit. D'où des cas aux bornes plutôt qu'un
 * passage nominal.
 */

const a = (instant: string) => new Date(instant);

describe("jeton anonyme", () => {
  it("accepte 32 caractères hexadécimaux minuscules", () => {
    expect(jetonValide("0123456789abcdef0123456789abcdef")).toBe(true);
  });

  it("refuse tout le reste, la route étant publique", () => {
    expect(jetonValide("0123456789ABCDEF0123456789ABCDEF")).toBe(false); // majuscules
    expect(jetonValide("0123456789abcdef")).toBe(false); // trop court
    expect(jetonValide(`${"a".repeat(32)}x`)).toBe(false); // trop long
    expect(jetonValide("../../etc/passwd")).toBe(false);
    expect(jetonValide(42)).toBe(false);
    expect(jetonValide(null)).toBe(false);
    expect(jetonValide(undefined)).toBe(false);
  });
});

describe("découpage en créneaux", () => {
  it("ramène un instant au début de son créneau de cinq minutes", () => {
    expect(creneau(a("2026-11-23T09:07:41.512Z")).toISOString()).toBe("2026-11-23T09:05:00.000Z");
  });

  it("laisse en place un instant déjà sur une borne", () => {
    expect(creneau(a("2026-11-23T09:05:00.000Z")).toISOString()).toBe("2026-11-23T09:05:00.000Z");
  });

  it("ne glisse pas au créneau suivant une milliseconde avant la borne", () => {
    expect(creneau(a("2026-11-23T09:09:59.999Z")).toISOString()).toBe("2026-11-23T09:05:00.000Z");
  });
});

describe("journée", () => {
  it("ramène à minuit UTC, qui est minuit à Dakar", () => {
    expect(jourDe(a("2026-11-23T23:58:00.000Z")).toISOString()).toBe("2026-11-23T00:00:00.000Z");
  });

  it("ne bascule pas de journée juste avant minuit", () => {
    expect(jourDe(a("2026-11-23T00:00:00.000Z")).toISOString()).toBe("2026-11-23T00:00:00.000Z");
  });
});

describe("courbe", () => {
  it("ne trace rien sans relevé", () => {
    expect(completerCourbe([])).toEqual([]);
  });

  it("comble les créneaux sans relevé par des zéros", () => {
    // Sans ce remplissage, la courbe relierait 09:00 à 09:15 par une diagonale
    // et laisserait croire à une audience continue entre les deux.
    const courbe = completerCourbe([
      { at: a("2026-11-23T09:00:00.000Z"), viewers: 12 },
      { at: a("2026-11-23T09:15:00.000Z"), viewers: 30 },
    ]);
    expect(courbe.map((point) => point.viewers)).toEqual([12, 0, 0, 30]);
  });

  it("s'arrête aux relevés et ne trace pas la journée entière", () => {
    // Tracer de minuit à minuit noierait deux heures de diffusion dans
    // vingt-deux heures de zéro.
    const courbe = completerCourbe([
      { at: a("2026-11-23T09:00:00.000Z"), viewers: 5 },
      { at: a("2026-11-23T09:05:00.000Z"), viewers: 7 },
    ]);
    expect(courbe).toHaveLength(2);
    expect(courbe[0]!.at).toBe("2026-11-23T09:00:00.000Z");
  });

  it("range des relevés arrivés dans le désordre", () => {
    const courbe = completerCourbe([
      { at: a("2026-11-23T09:10:00.000Z"), viewers: 9 },
      { at: a("2026-11-23T09:00:00.000Z"), viewers: 4 },
    ]);
    expect(courbe.map((point) => point.viewers)).toEqual([4, 0, 9]);
  });

  it("aligne un relevé horodaté hors borne sur son créneau", () => {
    const courbe = completerCourbe([{ at: a("2026-11-23T09:03:20.000Z"), viewers: 3 }]);
    expect(courbe).toEqual([{ at: "2026-11-23T09:00:00.000Z", viewers: 3 }]);
  });

  it("garde un pas régulier de cinq minutes", () => {
    const courbe = completerCourbe([
      { at: a("2026-11-23T09:00:00.000Z"), viewers: 1 },
      { at: a("2026-11-23T10:00:00.000Z"), viewers: 2 },
    ]);
    expect(courbe).toHaveLength(13);
    for (let rang = 1; rang < courbe.length; rang += 1) {
      const ecart = Date.parse(courbe[rang]!.at) - Date.parse(courbe[rang - 1]!.at);
      expect(ecart).toBe(CRENEAU_MS);
    }
  });
});
