import { describe, expect, it } from "vitest";
import { etatDirect, type CreneauDirect } from "./regles";

/**
 * Bascule entre le lecteur et l'écran d'attente du direct.
 *
 * C'est la seule règle de la page `/direct`, et elle est réévaluée toutes les
 * dix secondes dans le navigateur de chaque téléspectateur. Elle se teste
 * minute par minute parce qu'elle est pure : aucune horloge implicite,
 * `maintenant` est toujours fourni.
 *
 * Les horaires sont en UTC, qui est l'heure de Dakar toute l'année.
 */

const PLENIERE: CreneauDirect = {
  titre: "Cérémonie d'ouverture",
  debut: "2026-11-23T09:00:00.000Z",
  fin: "2026-11-23T10:30:00.000Z",
};

const PANEL: CreneauDirect = {
  titre: "Panel — Qualité des données",
  debut: "2026-11-23T11:00:00.000Z",
  fin: "2026-11-23T12:30:00.000Z",
};

const CRENEAUX = [PANEL, PLENIERE]; // Volontairement désordonnés.

const a = (instant: string) => new Date(instant);

describe("etatDirect, mode automatique", () => {
  it("est à l'antenne pendant une session", () => {
    const etat = etatDirect("auto", 10, CRENEAUX, a("2026-11-23T09:45:00.000Z"));
    expect(etat.antenne).toBe(true);
    expect(etat.courant?.titre).toBe("Cérémonie d'ouverture");
    expect(etat.suivant?.titre).toBe("Panel — Qualité des données");
  });

  it("passe à l'antenne dès la marge, avant l'horaire annoncé", () => {
    // Une séance commence rarement à la minute prévue : le lecteur doit être
    // là quand la salle ouvre, pas dix minutes après.
    expect(etatDirect("auto", 10, CRENEAUX, a("2026-11-23T08:52:00.000Z")).antenne).toBe(true);
    expect(etatDirect("auto", 10, CRENEAUX, a("2026-11-23T08:49:00.000Z")).antenne).toBe(false);
  });

  it("reste à l'antenne pendant la marge qui suit la fin", () => {
    expect(etatDirect("auto", 10, CRENEAUX, a("2026-11-23T10:39:00.000Z")).antenne).toBe(true);
    expect(etatDirect("auto", 10, CRENEAUX, a("2026-11-23T10:41:00.000Z")).antenne).toBe(false);
  });

  it("annonce la session suivante pendant la pause", () => {
    const etat = etatDirect("auto", 10, CRENEAUX, a("2026-11-23T10:45:00.000Z"));
    expect(etat.antenne).toBe(false);
    expect(etat.courant).toBeNull();
    expect(etat.suivant?.titre).toBe("Panel — Qualité des données");
    expect(etat.termine).toBe(false);
  });

  it("ne tient pas pour suivante une session déjà commencée", () => {
    // À 10 h 52, le panel de 11 h est dans sa marge : il est « courant », et
    // la page ne doit pas décompter une reprise déjà advenue.
    const etat = etatDirect("auto", 10, CRENEAUX, a("2026-11-23T10:52:00.000Z"));
    expect(etat.courant?.titre).toBe("Panel — Qualité des données");
    expect(etat.suivant).toBeNull();
  });

  it("se déclare terminé après la dernière session", () => {
    const etat = etatDirect("auto", 10, CRENEAUX, a("2026-11-23T18:00:00.000Z"));
    expect(etat.antenne).toBe(false);
    expect(etat.termine).toBe(true);
    expect(etat.suivant).toBeNull();
  });

  it("n'annonce aucune fin quand rien n'est publié", () => {
    // Sans programme, la page attend : annoncer une fin qui n'a pas eu lieu
    // serait pire que de ne rien dire.
    const etat = etatDirect("auto", 10, [], a("2026-11-23T18:00:00.000Z"));
    expect(etat.termine).toBe(false);
    expect(etat.antenne).toBe(false);
  });

  it("ignore un créneau dont la date est illisible", () => {
    const abime: CreneauDirect = { titre: "Bancal", debut: "pas une date", fin: "non plus" };
    const etat = etatDirect("auto", 10, [abime, PLENIERE], a("2026-11-23T09:45:00.000Z"));
    expect(etat.courant?.titre).toBe("Cérémonie d'ouverture");
  });

  it("accepte une marge nulle", () => {
    expect(etatDirect("auto", 0, CRENEAUX, a("2026-11-23T08:59:30.000Z")).antenne).toBe(false);
    expect(etatDirect("auto", 0, CRENEAUX, a("2026-11-23T09:00:30.000Z")).antenne).toBe(true);
  });
});

describe("etatDirect, modes forcés", () => {
  it("force l'antenne hors de tout créneau", () => {
    const etat = etatDirect("antenne", 10, CRENEAUX, a("2026-11-23T18:00:00.000Z"));
    expect(etat.antenne).toBe(true);
  });

  it("force l'intermède en pleine session", () => {
    const etat = etatDirect("intermede", 10, CRENEAUX, a("2026-11-23T09:45:00.000Z"));
    expect(etat.antenne).toBe(false);
    // Le programme reste lu : l'écran d'attente garde de quoi décompter.
    expect(etat.courant?.titre).toBe("Cérémonie d'ouverture");
  });
});
