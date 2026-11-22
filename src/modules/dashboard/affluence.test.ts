import { describe, expect, it } from "vitest";
import type { ParticipantStatus } from "@prisma/client";
import { calculerAffluence, joursDeclares, type LigneAffluence } from "./affluence";

/**
 * Affluence par journée (22 novembre 2026).
 *
 * Ce qui se joue ici n'est pas une addition mais une **convention de
 * comptage** : une personne compte sur chacune des journées qu'elle a cochées,
 * les non-déclarants ne sont répartis nulle part, et une déclaration n'engage
 * personne — le badge d'un validé ouvre les trois jours. Ces tests fixent la
 * convention ; la requête, elle, n'a rien à décider.
 */

const JOURS = [
  { value: "2026-11-23", label: "lundi 23 novembre" },
  { value: "2026-11-24", label: "mardi 24 novembre" },
  { value: "2026-11-25", label: "mercredi 25 novembre" },
];

function ligne(
  status: ParticipantStatus,
  participationDays: unknown,
  extra: Partial<LigneAffluence> = {},
): LigneAffluence {
  return {
    status,
    participationDays,
    categorieLabel: "Délégué national",
    attendsOpening: false,
    attendsClosing: false,
    attendsAwards: false,
    ...extra,
  };
}

function calculer(lignes: LigneAffluence[], jauges: Record<string, number> = {}) {
  return calculerAffluence({ jours: JOURS, jauges, lignes });
}

describe("journées déclarées, lues sans rien supposer", () => {
  const connus = new Set(JOURS.map((jour) => jour.value));

  it("ignore ce qui n'est pas un tableau de chaînes", () => {
    expect(joursDeclares(null, connus)).toEqual([]);
    expect(joursDeclares({ "2026-11-23": true }, connus)).toEqual([]);
    expect(joursDeclares([42, null], connus)).toEqual([]);
  });

  /*
   * Les dates de l'édition se modifient dans les paramètres. Une journée
   * déclarée avant un tel changement ne correspond plus à rien, et la compter
   * ferait apparaître une quatrième colonne dans un Forum qui en a trois.
   */
  it("écarte une journée qui n'est plus au programme", () => {
    expect(joursDeclares(["2026-11-23", "2026-11-30"], connus)).toEqual(["2026-11-23"]);
  });

  it("ne compte pas deux fois la même journée", () => {
    expect(joursDeclares(["2026-11-24", "2026-11-24"], connus)).toEqual(["2026-11-24"]);
  });
});

describe("affluence par journée", () => {
  it("compte une personne sur chacune des journées qu'elle a cochées", () => {
    const affluence = calculer([
      ligne("CONFIRMED", ["2026-11-23", "2026-11-24"]),
      ligne("BADGED", ["2026-11-23"]),
      ligne("REGISTERED", ["2026-11-25"]),
    ]);

    expect(affluence.journees.map((jour) => jour.confirmes)).toEqual([2, 1, 0]);
    expect(affluence.journees.map((jour) => jour.enAttente)).toEqual([0, 0, 1]);
    // Des personnes, pas des présences : les deux journées du premier ne font
    // pas de lui deux confirmés.
    expect(affluence.totaux).toEqual({ confirmes: 2, enAttente: 1 });
  });

  /*
   * Import par fichier et inscription au comptoir n'ont pas de case à cocher :
   * ces dossiers n'ont aucune journée. Les répartir d'office sur les trois
   * journées serait inventer une déclaration ; les passer sous silence
   * sous-estimerait la salle. Ils sont donc comptés à part, et visibles.
   */
  it("met à part ceux qui n'ont déclaré aucune journée", () => {
    const affluence = calculer([
      ligne("CONFIRMED", null),
      ligne("CONFIRMED", []),
      ligne("REGISTERED", undefined),
      ligne("CONFIRMED", ["2026-11-23"]),
    ]);

    expect(affluence.sansJour).toEqual({ confirmes: 2, enAttente: 1 });
    expect(affluence.journees[0]!.confirmes).toBe(1);
    expect(affluence.journees[1]!.confirmes).toBe(0);
    expect(affluence.totaux.confirmes).toBe(3);
  });

  it("laisse de côté les dossiers qui n'occupent aucune place", () => {
    const affluence = calculer([
      ligne("CANCELLED", ["2026-11-23"]),
      ligne("DECLINED", ["2026-11-23"]),
      ligne("INVITED", null),
      ligne("REGISTRATION_STARTED", null),
    ]);

    expect(affluence.totaux).toEqual({ confirmes: 0, enAttente: 0 });
    expect(affluence.journees[0]!.confirmes).toBe(0);
    expect(affluence.sansJour).toEqual({ confirmes: 0, enAttente: 0 });
  });

  it("rapporte les confirmés à la jauge, et dit ce qu'il reste", () => {
    const affluence = calculer(
      [
        ligne("CONFIRMED", ["2026-11-23"]),
        ligne("CONFIRMED", ["2026-11-23"]),
        ligne("CONFIRMED", ["2026-11-23"]),
        ligne("REGISTERED", ["2026-11-23"]),
      ],
      { "2026-11-23": 10 },
    );

    const premier = affluence.journees[0]!;
    expect(premier.jauge).toBe(10);
    // Les en attente ne prennent pas de place : c'est précisément la question
    // qu'on pose à cet écran — y en a-t-il pour eux ?
    expect(premier.placesRestantes).toBe(7);
    expect(premier.occupation).toBe(30);
    expect(premier.enAttente).toBe(1);
  });

  it("annonce un dépassement plutôt que de le masquer à zéro", () => {
    const affluence = calculer(
      [ligne("CONFIRMED", ["2026-11-23"]), ligne("CONFIRMED", ["2026-11-23"])],
      { "2026-11-23": 1 },
    );

    expect(affluence.journees[0]!.placesRestantes).toBe(-1);
    expect(affluence.journees[0]!.occupation).toBe(200);
  });

  /*
   * Une jauge absente et une jauge à zéro sont la même chose : personne n'a
   * fixé la capacité. Afficher « 0 place disponible » et une barre pleine
   * ferait croire à une salle comble sur une journée que personne n'a réglée.
   */
  it("ne fabrique ni pourcentage ni places restantes sans jauge", () => {
    const affluence = calculer([ligne("CONFIRMED", ["2026-11-23", "2026-11-24"])], {
      "2026-11-24": 0,
    });

    for (const jour of affluence.journees) {
      expect(jour.jauge).toBeNull();
      expect(jour.occupation).toBeNull();
      expect(jour.placesRestantes).toBeNull();
    }
  });

  it("ventile les confirmés d'une journée par catégorie, les plus nombreux d'abord", () => {
    const affluence = calculer([
      ligne("CONFIRMED", ["2026-11-23"], { categorieLabel: "Presse" }),
      ligne("CONFIRMED", ["2026-11-23"], { categorieLabel: "Délégué national" }),
      ligne("CONFIRMED", ["2026-11-23"], { categorieLabel: "Délégué national" }),
      // Un dossier en attente ne figure pas dans la ventilation : elle décrit
      // la salle telle qu'elle est engagée, pas telle qu'elle pourrait être.
      ligne("REGISTERED", ["2026-11-23"], { categorieLabel: "Presse" }),
    ]);

    expect(affluence.journees[0]!.parCategorie).toEqual([
      { label: "Délégué national", value: 2 },
      { label: "Presse", value: 1 },
    ]);
  });

  /*
   * Le chiffre qui décide si tout le reste sert à quelque chose : si presque
   * tous les confirmés ont coché les trois journées, il n'y a aucune place à
   * récupérer, et aucune validation supplémentaire à espérer.
   */
  it("dit combien de journées les confirmés ont déclarées", () => {
    const affluence = calculer([
      ligne("CONFIRMED", ["2026-11-23"]),
      ligne("CONFIRMED", ["2026-11-24"]),
      ligne("CONFIRMED", ["2026-11-23", "2026-11-25"]),
      ligne("CONFIRMED", ["2026-11-23", "2026-11-24", "2026-11-25"]),
      // Sans déclaration : compté dans `sansJour`, pas ici — il n'a pas
      // « déclaré zéro journée », il n'a pas répondu.
      ligne("CONFIRMED", null),
      ligne("REGISTERED", ["2026-11-23"]),
    ]);

    expect(affluence.parNombreDeJours).toEqual([
      { jours: 1, valeur: 2 },
      { jours: 2, valeur: 1 },
      { jours: 3, valeur: 1 },
    ]);
  });

  it("compte les cérémonies à part des journées", () => {
    const affluence = calculer([
      ligne("CONFIRMED", ["2026-11-23"], { attendsOpening: true, attendsAwards: true }),
      ligne("REGISTERED", ["2026-11-25"], { attendsClosing: true }),
    ]);

    expect(affluence.ceremonies).toEqual([
      { libelle: "Cérémonie d'ouverture", confirmes: 1, enAttente: 0 },
      { libelle: "Cérémonie de clôture", confirmes: 0, enAttente: 1 },
      { libelle: "Remise des prix", confirmes: 1, enAttente: 0 },
    ]);
  });

  it("rend une ligne par journée du Forum, même vide", () => {
    const affluence = calculer([]);
    expect(affluence.journees.map((jour) => jour.jour)).toEqual(JOURS.map((jour) => jour.value));
    expect(affluence.journees.map((jour) => jour.libelle)).toEqual(JOURS.map((jour) => jour.label));
  });
});
