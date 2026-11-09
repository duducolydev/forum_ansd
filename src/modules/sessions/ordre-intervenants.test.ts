import { describe, expect, it } from "vitest";
import { ordonnerIntervenants, ordonnerParRoles } from "./ordre-intervenants";

describe("ordre des intervenants d'une session", () => {
  it("place les modérateurs en tête, puis les panélistes, puis les autres rôles", () => {
    const liens = [
      { nom: "Panéliste A", role: "PANELIST" },
      { nom: "Invité", role: "GUEST_OF_HONOR" },
      { nom: "Modérateur", role: "MODERATOR" },
      { nom: "Panéliste B", role: "PANELIST" },
      { nom: "Orateur", role: "KEYNOTE" },
    ];
    expect(ordonnerIntervenants(liens).map((lien) => lien.nom)).toEqual([
      "Modérateur",
      "Panéliste A",
      "Panéliste B",
      "Orateur",
      "Invité",
    ]);
  });

  it("garde l'ordre fixé par le comité à rôle égal, et ne modifie pas la liste reçue", () => {
    const liens = [
      { nom: "Co-modératrice", role: "MODERATOR" },
      { nom: "Panéliste C", role: "PANELIST" },
      { nom: "Modérateur", role: "MODERATOR" },
    ];
    const copie = [...liens];
    expect(ordonnerIntervenants(liens).map((lien) => lien.nom)).toEqual([
      "Co-modératrice",
      "Modérateur",
      "Panéliste C",
    ]);
    expect(liens).toEqual(copie);
  });
});

describe("ordre de l'annuaire des intervenants", () => {
  it("classe modérateurs, panélistes, autres rôles, puis sans rôle, alphabétique à rang égal", () => {
    const personnes = [
      { nom: "Aw", roles: ["PANELIST"] },
      { nom: "Ba", roles: [] },
      { nom: "Cissé", roles: ["KEYNOTE"] },
      { nom: "Diop", roles: ["MODERATOR"] },
      { nom: "Fall", roles: ["PANELIST"] },
      { nom: "Gueye", roles: ["MODERATOR"] },
    ];
    expect(ordonnerParRoles(personnes).map((personne) => personne.nom)).toEqual([
      "Diop",
      "Gueye",
      "Aw",
      "Fall",
      "Cissé",
      "Ba",
    ]);
  });

  it("classe une personne à plusieurs rôles selon le plus haut", () => {
    const personnes = [
      { nom: "Aw", roles: ["PANELIST"] },
      { nom: "Ba", roles: ["PANELIST", "MODERATOR"] },
    ];
    expect(ordonnerParRoles(personnes).map((personne) => personne.nom)).toEqual(["Ba", "Aw"]);
  });
});
