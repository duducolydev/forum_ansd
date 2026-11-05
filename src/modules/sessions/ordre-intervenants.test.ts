import { describe, expect, it } from "vitest";
import { ordonnerIntervenants } from "./ordre-intervenants";

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
