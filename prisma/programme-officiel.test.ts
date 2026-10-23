import { describe, expect, it } from "vitest";
import { JOURS_DEMO, PROGRAMME_DEMO, slugSeanceDemo } from "./donnees-demo";
import { PROGRAMME_OFFICIEL, versSessionInput } from "./programme-officiel";

const SALLES = { AMPHITHEATRE: "salle-amphi", PLENIERE: "salle-pleniere" };

const jours = [...new Set(PROGRAMME_OFFICIEL.map((seance) => seance.jour))];
const duJour = (jour: string) => PROGRAMME_OFFICIEL.filter((seance) => seance.jour === jour);

describe("programme officiel (note conceptuelle du 24 septembre 2026)", () => {
  it("tient en trois journées, du 23 au 25 novembre", () => {
    expect(jours).toEqual(["2026-11-23", "2026-11-24", "2026-11-25"]);
  });

  it("compte les dix panels de la note, numérotés de 1 à 10 dans leur titre", () => {
    const panels = PROGRAMME_OFFICIEL.filter((seance) => seance.type === "PANEL");
    expect(panels.map((panel) => panel.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const panel of panels) {
      expect(panel.titre.fr.startsWith(`Panel ${panel.numero} — `)).toBe(true);
      expect(panel.titre.en.startsWith(`Panel ${panel.numero} — `)).toBe(true);
      expect(panel.titre.pt.startsWith(`Painel ${panel.numero} — `)).toBe(true);
    }
  });

  it("ne laisse aucun trou ni chevauchement : chaque trou de la note est une pause", () => {
    for (const jour of jours) {
      const seances = duJour(jour);
      for (let i = 1; i < seances.length; i += 1) {
        expect(seances[i]!.debut, `${jour} : ${seances[i]!.titre.fr}`).toBe(seances[i - 1]!.fin);
      }
    }
  });

  it("garde aux pauses leur nature : café le matin, déjeuner à la mi-journée, sans salle", () => {
    const pauses = PROGRAMME_OFFICIEL.filter((s) => s.type === "BREAK" || s.type === "LUNCH");
    expect(pauses).toHaveLength(6);
    for (const pause of pauses) {
      expect(pause.salle).toBeUndefined();
      expect(pause.type).toBe(pause.debut >= "12:00" ? "LUNCH" : "BREAK");
    }
    // Toute autre séance a sa salle.
    for (const seance of PROGRAMME_OFFICIEL.filter((s) => !pauses.includes(s))) {
      expect(seance.salle, seance.titre.fr).toBeDefined();
    }
  });

  it("reprend les horaires de la note pour les temps forts", () => {
    const horaire = (slug: string) => {
      const seance = PROGRAMME_OFFICIEL.find((s) => s.slug === slug)!;
      return `${seance.jour} ${seance.debut}-${seance.fin} ${seance.salle ?? ""}`;
    };
    expect(horaire("ceremonie-officielle-d-ouverture")).toBe("2026-11-23 08:00-10:00 AMPHITHEATRE");
    expect(horaire("panel-3-securisation-des-donnees")).toBe("2026-11-23 15:00-17:00 PLENIERE");
    expect(horaire("panel-7-le-pari-demographique-jeunesse-et-emploi")).toBe(
      "2026-11-24 16:00-17:30 PLENIERE",
    );
    expect(horaire("ceremonie-officielle-de-cloture")).toBe("2026-11-25 18:00-19:00 PLENIERE");
  });

  it("a des adresses uniques, distinctes de celles du programme fictif", () => {
    const slugs = PROGRAMME_OFFICIEL.map((seance) => seance.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    const fictives = JOURS_DEMO.flatMap((jour) =>
      (PROGRAMME_DEMO[jour] ?? []).map((item) => slugSeanceDemo(jour, item.titleFr)),
    );
    expect(slugs.filter((slug) => fictives.includes(slug))).toEqual([]);
  });

  it("passe, séance par séance, la validation du formulaire du BackOffice", () => {
    for (const seance of PROGRAMME_OFFICIEL) {
      const input = versSessionInput(seance, SALLES);
      expect(input).toMatchObject({
        slug: seance.slug,
        isPublished: true,
        registrationOpen: false,
        titleEn: seance.titre.en,
        titlePt: seance.titre.pt,
      });
      expect(input.roomId).toBe(seance.salle ? SALLES[seance.salle] : "");
    }
  });

  it("refuse une séance dont la salle est introuvable", () => {
    const panel = PROGRAMME_OFFICIEL.find((seance) => seance.numero === 4)!;
    expect(() => versSessionInput(panel, { AMPHITHEATRE: "salle-amphi" })).toThrow(
      /Salle « Salle plénière » introuvable/,
    );
  });
});
