import { describe, expect, it } from "vitest";
import { BOITES } from "@/lib/mail";
import { CATALOGUE } from "@/modules/notifications/catalogue";
import {
  BOITE_PAR_MODELE,
  boitePourModele,
  modelesSansBoite,
} from "@/modules/notifications/boites";

/**
 * Le rapprochement des deux listes (20 novembre 2026).
 *
 * `boites.ts` tient la carte `modèle → compte d'envoi` à côté du catalogue
 * plutôt que dedans : les deux changent pour des raisons différentes. Le prix
 * de cette séparation est qu'elles peuvent diverger, et ce fichier est ce
 * qu'on paie en échange — un modèle ajouté au catalogue sans boîte échoue ici,
 * au lieu de partir silencieusement par la transactionnelle et d'y manger le
 * quota des codes de connexion du BackOffice.
 */
describe("carte des boîtes d'envoi", () => {
  it("attribue une boîte à chaque modèle du catalogue", () => {
    expect(modelesSansBoite()).toEqual([]);
  });

  it("ne route aucun modèle inconnu du catalogue", () => {
    const orphelins = Object.keys(BOITE_PAR_MODELE).filter((cle) => !CATALOGUE[cle]);
    expect(orphelins).toEqual([]);
  });

  it("ne nomme que des boîtes déclarées", () => {
    const connues = new Set(Object.keys(BOITES));
    const inconnues = Object.values(BOITE_PAR_MODELE).filter((boite) => !connues.has(boite));
    expect(inconnues).toEqual([]);
  });

  it("retombe sur la transactionnelle pour un modèle créé hors catalogue", () => {
    expect(boitePourModele("modele_ajoute_en_base")).toBe("transactionnel");
  });
});

/**
 * Les deux arbitrages qui ne doivent pas se défaire par inadvertance.
 *
 * Ils tiennent ensemble : mettre `badge_ready` avec les liens de connexion
 * n'est tenable que parce que le code du BackOffice est parti ailleurs. Un
 * jour où l'un des deux serait déplacé sans l'autre, une génération de badges
 * en lot rendrait le BackOffice inaccessible — le défaut du 18 novembre, avec
 * un compte de plus.
 */
describe("l'arbitrage badges / codes de connexion", () => {
  it("met les badges avec les accès des participants", () => {
    expect(boitePourModele("badge_ready")).toBe("acces");
    expect(boitePourModele("magic_link")).toBe("acces");
    expect(boitePourModele("speaker_link")).toBe("acces");
  });

  it("garde le code du BackOffice hors de la boîte des badges", () => {
    expect(boitePourModele("admin_login_code")).toBe("transactionnel");
    expect(boitePourModele("admin_login_code")).not.toBe(boitePourModele("badge_ready"));
  });

  it("sépare les deux familles à un message par inscrit", () => {
    expect(boitePourModele("registration_confirmed")).toBe("participation");
    expect(boitePourModele("registration_confirmed")).not.toBe(boitePourModele("badge_ready"));
  });
});
