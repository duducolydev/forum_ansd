import { describe, expect, it } from "vitest";
import {
  comparerSession,
  decrireChangements,
  figerEtat,
  lireEtatAnnonce,
  type EtatSuivi,
} from "./changements";

/**
 * Comparaison de deux états d'une session (13 novembre 2026).
 *
 * Module pur : aucune base, aucun envoi. Ce qui est vérifié ici, c'est la règle
 * qui décide **si** quelqu'un sera dérangé — la plus coûteuse à se tromper,
 * dans un sens comme dans l'autre.
 */

const BASE: EtatSuivi = {
  titleFr: "Données et climat",
  titleEn: "Data and climate",
  titlePt: null,
  day: new Date("2026-11-24T00:00:00.000Z"),
  startTime: new Date("2026-11-24T09:00:00.000Z"),
  endTime: new Date("2026-11-24T10:30:00.000Z"),
  salle: "Salle A",
};

function avec(modifications: Partial<EtatSuivi>): EtatSuivi {
  return { ...BASE, ...modifications };
}

describe("comparerSession", () => {
  it("ne signale rien quand rien n'a bougé", () => {
    // Rouvrir un formulaire et l'enregistrer sans rien toucher ne doit écrire
    // à personne : c'est ce qui protège aussi du double envoi.
    expect(comparerSession(BASE, avec({}))).toEqual([]);
  });

  it("ignore ce qui ne change rien pour le destinataire", () => {
    // La description, les TDR, le quota VIP n'entrent même pas dans `EtatSuivi` :
    // deux états identiques sur les quatre champs suivis ne produisent rien.
    const memeInstant = avec({
      startTime: new Date("2026-11-24T09:00:00.000Z"),
      endTime: new Date("2026-11-24T10:30:00.000Z"),
    });
    expect(comparerSession(BASE, memeInstant)).toEqual([]);
  });

  it("signale un déplacement d'horaire, avec l'avant et l'après", () => {
    const changements = comparerSession(
      BASE,
      avec({
        startTime: new Date("2026-11-24T11:00:00.000Z"),
        endTime: new Date("2026-11-24T12:30:00.000Z"),
      }),
    );

    expect(changements).toHaveLength(1);
    expect(changements[0]!.champ).toBe("horaire");
    expect(changements[0]!.texte.fr).toBe("Horaire : 09:00 - 10:30 → 11:00 - 12:30");
    expect(changements[0]!.texte.en).toBe("Time: 09:00 - 10:30 → 11:00 - 12:30");
  });

  it("signale un changement de jour", () => {
    const changements = comparerSession(BASE, avec({ day: new Date("2026-11-25T00:00:00.000Z") }));

    expect(changements.map((c) => c.champ)).toEqual(["jour"]);
    expect(changements[0]!.texte.fr).toContain("mardi 24 novembre 2026");
    expect(changements[0]!.texte.fr).toContain("mercredi 25 novembre 2026");
  });

  it("signale un changement de salle, y compris quand elle disparaît", () => {
    const retiree = comparerSession(BASE, avec({ salle: null }));
    expect(retiree[0]!.texte.fr).toBe("Salle : Salle A → salle non précisée");
    expect(retiree[0]!.texte.pt).toBe("Sala: Salle A → sala por confirmar");

    const ajoutee = comparerSession(avec({ salle: null }), BASE);
    expect(ajoutee[0]!.texte.en).toBe("Room: room to be confirmed → Salle A");
  });

  it("signale un intitulé corrigé dans une seule langue", () => {
    // La traduction anglaise seule a changé : l'anglophone doit le savoir, et
    // la ligne existe dans les trois langues pour que chacun lise la sienne.
    const changements = comparerSession(BASE, avec({ titleEn: "Data and the climate" }));

    expect(changements.map((c) => c.champ)).toEqual(["titre"]);
    expect(changements[0]!.texte.en).toBe("Title: Data and climate → Data and the climate");
    // Le portugais n'est pas renseigné : il retombe sur l'anglais (`traduire`),
    // et suit donc la correction.
    expect(changements[0]!.texte.pt).toBe("Título: Data and climate → Data and the climate");
  });

  it("cumule les changements dans l'ordre de lecture", () => {
    const changements = comparerSession(
      BASE,
      avec({
        day: new Date("2026-11-25T00:00:00.000Z"),
        startTime: new Date("2026-11-25T14:00:00.000Z"),
        endTime: new Date("2026-11-25T15:30:00.000Z"),
        salle: "Salle B",
        titleFr: "Données, climat et territoires",
      }),
    );

    expect(changements.map((c) => c.champ)).toEqual(["jour", "horaire", "salle", "titre"]);
  });
});

describe("decrireChangements", () => {
  it("rend une liste à puces indentée, dans la langue du destinataire", () => {
    const changements = comparerSession(BASE, avec({ salle: "Salle B" }));
    expect(decrireChangements(changements, "fr")).toBe("  - Salle : Salle A → Salle B");
    expect(decrireChangements(changements, "en")).toBe("  - Room: Salle A → Salle B");
  });

  it("rend une chaîne vide sans changement", () => {
    expect(decrireChangements([], "fr")).toBe("");
  });
});

describe("état annoncé", () => {
  it("se relit tel qu'il a été figé", () => {
    const relu = lireEtatAnnonce(JSON.parse(JSON.stringify(figerEtat(BASE))));
    expect(relu).not.toBeNull();
    // Le tour par JSON est celui que fait la colonne : les instants repartent
    // en texte et doivent revenir en dates comparables.
    expect(comparerSession(relu!, BASE)).toEqual([]);
  });

  it("garde une salle absente distincte d'une salle nommée", () => {
    const relu = lireEtatAnnonce(JSON.parse(JSON.stringify(figerEtat(avec({ salle: null })))));
    expect(relu!.salle).toBeNull();
    expect(comparerSession(relu!, BASE).map((c) => c.champ)).toEqual(["salle"]);
  });

  it("conclut « rien d'annoncé » plutôt que de planter sur une valeur illisible", () => {
    // La colonne est un `Json` : rien ne garantit sa forme. Un écran du
    // programme qui tombe parce qu'une ligne est tronquée serait pire que
    // l'absence d'annonce.
    expect(lireEtatAnnonce(null)).toBeNull();
    expect(lireEtatAnnonce("texte")).toBeNull();
    expect(lireEtatAnnonce([])).toBeNull();
    expect(lireEtatAnnonce({ titleFr: "x" })).toBeNull();
    expect(lireEtatAnnonce({ ...figerEtat(BASE), startTime: "pas une date" })).toBeNull();
  });

  it("ne laisse rien à annoncer quand un horaire revient à sa valeur connue", () => {
    // C'est la raison d'être de l'état annoncé : corriger un horaire en trois
    // essais, revenir au point de départ, et n'écrire à personne.
    const annonce = lireEtatAnnonce(JSON.parse(JSON.stringify(figerEtat(BASE))))!;
    const essai = avec({ startTime: new Date("2026-11-24T11:00:00.000Z") });
    expect(comparerSession(annonce, essai)).toHaveLength(1);
    expect(comparerSession(annonce, avec({}))).toEqual([]);
  });
});
