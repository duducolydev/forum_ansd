import { describe, expect, it } from "vitest";
import { filtrerDelegations, type DelegationFiltrable } from "./filtre-delegations";

function delegation(valeurs: Partial<DelegationFiltrable> & { name: string }): DelegationFiltrable {
  return {
    country: null,
    institution: null,
    referentId: null,
    maxMembers: null,
    headParticipant: null,
    referent: null,
    _count: { members: 0 },
    ...valeurs,
  };
}

const LISTE = [
  delegation({
    name: "INS Mali",
    country: "Mali",
    institution: "Institut national de la statistique",
    referentId: "r1",
    referent: { name: "Awa Diop" },
    headParticipant: { firstName: "Moussa", lastName: "KEITA" },
    maxMembers: 3,
    _count: { members: 3 },
  }),
  delegation({ name: "ANSD", country: "Sénégal", _count: { members: 2 } }),
  delegation({ name: "Test", country: "Test" }),
];

const noms = (liste: DelegationFiltrable[]) => liste.map((d) => d.name);

describe("filtre des délégations", () => {
  it("cherche chaque mot dans le nom, le pays, l'institution, le chef et le référent", () => {
    expect(noms(filtrerDelegations(LISTE, { q: "mali keita" }))).toEqual(["INS Mali"]);
    expect(noms(filtrerDelegations(LISTE, { q: "awa" }))).toEqual(["INS Mali"]);
    expect(noms(filtrerDelegations(LISTE, { q: "senegal" }))).toEqual(["ANSD"]);
  });

  it("filtre par pays, sans tenir compte des accents ni de la casse", () => {
    expect(noms(filtrerDelegations(LISTE, { country: "sénégal" }))).toEqual(["ANSD"]);
  });

  it("filtre par référent, ou par absence de référent", () => {
    expect(noms(filtrerDelegations(LISTE, { referentId: "r1" }))).toEqual(["INS Mali"]);
    expect(noms(filtrerDelegations(LISTE, { referentId: "aucun" }))).toEqual(["ANSD", "Test"]);
  });

  it("filtre par situation", () => {
    expect(noms(filtrerDelegations(LISTE, { situation: "sans-chef" }))).toEqual(["ANSD", "Test"]);
    expect(noms(filtrerDelegations(LISTE, { situation: "vide" }))).toEqual(["Test"]);
    expect(noms(filtrerDelegations(LISTE, { situation: "complete" }))).toEqual(["INS Mali"]);
  });

  it("rend tout sans filtre", () => {
    expect(filtrerDelegations(LISTE, {})).toHaveLength(3);
  });
});
