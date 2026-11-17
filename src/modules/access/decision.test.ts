import { describe, expect, it } from "vitest";
import {
  evaluerAcces,
  resoudreZones,
  type BadgeConnu,
  type ContexteScan,
  type Verdict,
} from "./decision";

const T0 = new Date("2026-11-23T08:30:00.000Z");

function badge(surcharge: Partial<BadgeConnu> = {}): BadgeConnu {
  return {
    publicId: "FID26-7K3M2P",
    statut: "CONFIRMED",
    zones: ["ENTREE", "PLENIERE"],
    alerteAccueil: false,
    revoque: false,
    ...surcharge,
  };
}

function contexte(surcharge: Partial<ContexteScan> = {}): ContexteScan {
  return {
    zoneCode: "ENTREE",
    scanneA: T0,
    premierPassageDuJour: null,
    ...surcharge,
  };
}

describe("résolution des zones (brief §2.6)", () => {
  it("ajoute les exceptions individuelles à la matrice de la catégorie", () => {
    expect(resoudreZones(["ENTREE", "PLENIERE"], ["VIP"])).toEqual(["ENTREE", "PLENIERE", "VIP"]);
  });

  it("ne duplique pas une exception déjà couverte par la catégorie", () => {
    expect(resoudreZones(["ENTREE", "VIP"], ["VIP"])).toEqual(["ENTREE", "VIP"]);
  });

  it("n'ôte jamais une zone : une exception ne fait qu'élargir", () => {
    const zones = resoudreZones(["ENTREE", "PLENIERE", "RESTAURATION"], []);
    expect(zones).toHaveLength(3);
  });
});

describe("verdict de scan (brief §2.5)", () => {
  it("autorise en vert un participant confirmé sur une zone de sa catégorie", () => {
    const verdict = evaluerAcces(badge(), contexte());
    expect(verdict).toMatchObject({ couleur: "VERT", resultat: "OK" });
  });

  it("refuse un QR non reconnu", () => {
    expect(evaluerAcces(null, contexte())).toMatchObject({
      couleur: "ROUGE",
      resultat: "UNKNOWN",
    });
  });

  it("refuse une zone hors matrice", () => {
    const verdict = evaluerAcces(badge(), contexte({ zoneCode: "VIP" }));
    expect(verdict).toMatchObject({ couleur: "ROUGE", resultat: "DENIED_ZONE" });
  });

  it("ouvre la zone dès qu'une exception individuelle la couvre", () => {
    const zones = resoudreZones(["ENTREE", "PLENIERE"], ["VIP"]);
    const verdict = evaluerAcces(badge({ zones }), contexte({ zoneCode: "VIP" }));
    expect(verdict.resultat).toBe("OK");
  });

  it("refuse un badge révoqué, y compris sur une zone autorisée", () => {
    const verdict = evaluerAcces(badge({ revoque: true }), contexte());
    expect(verdict).toMatchObject({ couleur: "ROUGE", resultat: "REVOKED" });
  });

  it("annonce la révocation plutôt que la zone quand les deux s'appliquent", () => {
    // L'ordre compte : un « mauvaise salle » laisserait repartir la personne
    // avec un badge révoqué en poche.
    const verdict = evaluerAcces(badge({ revoque: true }), contexte({ zoneCode: "VIP" }));
    expect(verdict.resultat).toBe("REVOKED");
  });

  it.each(["INVITED", "REGISTERED", "DECLINED", "CANCELLED"] as const)(
    "refuse le statut %s",
    (statut) => {
      const verdict = evaluerAcces(badge({ statut }), contexte());
      expect(verdict).toMatchObject({ couleur: "ROUGE", resultat: "DENIED_STATUS" });
    },
  );

  it.each(["CONFIRMED", "BADGED", "CHECKED_IN"] as const)("admet le statut %s", (statut) => {
    expect(evaluerAcces(badge({ statut }), contexte()).resultat).toBe("OK");
  });

  it("distingue une annulation d'une inscription simplement non confirmée", () => {
    expect(evaluerAcces(badge({ statut: "CANCELLED" }), contexte()).motif).toBe(
      "Inscription annulée",
    );
    expect(evaluerAcces(badge({ statut: "REGISTERED" }), contexte()).motif).toBe(
      "Inscription non confirmée",
    );
  });

  it("annonce « déjà badgé » au second passage de la journée", () => {
    const verdict = evaluerAcces(
      badge(),
      contexte({ premierPassageDuJour: new Date("2026-11-23T08:04:00.000Z") }),
    );
    expect(verdict).toMatchObject({ couleur: "ORANGE", resultat: "ALREADY" });
    expect(verdict.motif).toBe("Déjà badgé aujourd'hui");
  });

  it("donne l'heure du premier passage, sans quoi l'agent ne peut rien en faire", () => {
    const verdict = evaluerAcces(
      badge(),
      contexte({ premierPassageDuJour: new Date("2026-11-23T08:04:00.000Z") }),
    );
    expect(verdict.alertes).toContain("Premier passage : 08h04");
  });

  it("lit l'heure en UTC, quel que soit le fuseau de l'appareil de l'agent", () => {
    // Une heure décalée se lirait comme une erreur de la personne, pas de
    // l'horloge. Dakar est à UTC toute l'année.
    const verdict = evaluerAcces(
      badge(),
      contexte({ premierPassageDuJour: new Date("2026-11-23T23:50:00.000Z") }),
    );
    expect(verdict.alertes).toContain("Premier passage : 23h50");
  });

  it("laisse passer au vert le premier badgeage de la journée", () => {
    expect(evaluerAcces(badge(), contexte({ premierPassageDuJour: null }))).toMatchObject({
      couleur: "VERT",
      resultat: "OK",
    });
  });

  it("ne prétend pas « déjà badgé » quand la zone est refusée", () => {
    const verdict = evaluerAcces(
      badge(),
      contexte({ zoneCode: "VIP", premierPassageDuJour: new Date(T0.getTime() - 10_000) }),
    );
    expect(verdict.resultat).toBe("DENIED_ZONE");
  });

  it("passe en orange pour une catégorie à accueillir", () => {
    const verdict = evaluerAcces(badge({ alerteAccueil: true }), contexte());
    expect(verdict).toMatchObject({ couleur: "ORANGE", resultat: "OK" });
    expect(verdict.alertes).toContain("À accueillir");
  });

  it("garde « À accueillir » sur un second passage", () => {
    // La catégorie à accueillir ne cesse pas de l'être parce que la personne
    // est déjà venue le matin : l'agent doit toujours la voir.
    const verdict = evaluerAcces(
      badge({ alerteAccueil: true }),
      contexte({ premierPassageDuJour: new Date(T0.getTime() - 3_600_000) }),
    );
    expect(verdict.resultat).toBe("ALREADY");
    expect(verdict.alertes).toContain("À accueillir");
  });

  it("ne renvoie jamais VERT avec un résultat autre que OK", () => {
    const combinaisons: Verdict[] = [];
    for (const statut of ["CONFIRMED", "CANCELLED"] as const) {
      for (const revoque of [false, true]) {
        for (const zoneCode of ["ENTREE", "VIP"]) {
          for (const premierPassageDuJour of [null, new Date(T0.getTime() - 5_000)]) {
            combinaisons.push(
              evaluerAcces(
                badge({ statut, revoque }),
                contexte({ zoneCode, premierPassageDuJour }),
              ),
            );
          }
        }
      }
    }
    for (const verdict of combinaisons) {
      expect(verdict.couleur === "VERT" ? verdict.resultat : "OK").toBe("OK");
    }
  });
});
