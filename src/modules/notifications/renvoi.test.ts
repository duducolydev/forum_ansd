import { describe, expect, it } from "vitest";
import { CATALOGUE } from "./catalogue";
import { adresseMorte, estRenvoyable } from "./renvoi";

/**
 * Ce qui est vérifié ici n'est pas le renvoi lui-même, mais le **tri** : quels
 * modèles le rattrapage sait reproduire sans les variables que le journal n'a
 * pas gardées. Se tromper de ce côté-là envoie un message où `{{code6}}`
 * apparaît en clair, à de vraies personnes.
 */
describe("tri des modèles renvoyables", () => {
  it("renvoie les rappels, qui ne portent que les variables communes", () => {
    expect(estRenvoyable("reminder_j7")).toBe(true);
    expect(estRenvoyable("reminder_j1")).toBe(true);
  });

  it("renvoie le badge et la confirmation, dont les liens signés sont refabriqués", () => {
    // Les deux modèles tombés le 18 novembre 2026.
    expect(estRenvoyable("badge_ready")).toBe(true);
    expect(estRenvoyable("registration_confirmed")).toBe(true);
  });

  it("ne renvoie jamais un accès : code de connexion, lien magique, lien intervenant", () => {
    expect(estRenvoyable("admin_login_code")).toBe(false);
    expect(estRenvoyable("magic_link")).toBe(false);
    expect(estRenvoyable("speaker_link")).toBe(false);
  });

  it("écarte un modèle à variable propre que le journal ne conserve pas", () => {
    // `invitation` porte `lien_inscription` : le renvoyer à vide produirait un
    // message avec « {{lien_inscription}} » dans le corps.
    expect(estRenvoyable("invitation")).toBe(false);
    expect(estRenvoyable("invitation_reminder")).toBe(false);
  });

  it("écarte un modèle inconnu du catalogue plutôt que de deviner", () => {
    expect(estRenvoyable("modele_ajoute_a_la_main")).toBe(false);
  });

  it("n'accepte aucun modèle du catalogue dont une variable propre resterait vide", () => {
    // Garde-fou général : le jour où un modèle gagne une variable propre, il
    // sort du renvoi tout seul — sauf à être explicitement pris en charge.
    const prisEnCharge = new Set([
      "badge_ready",
      "registration_confirmed",
      "registration_imported",
      "accreditation_granted",
    ]);
    const communes = new Set(["prenom", "nom", "identifiant", "lien_espace", "lien_badge"]);

    for (const [cle, entree] of Object.entries(CATALOGUE)) {
      if (prisEnCharge.has(cle)) continue;
      const propres = entree.variables.filter((nom) => !communes.has(nom));
      if (propres.length > 0) {
        expect(estRenvoyable(cle), `${cle} porte ${propres.join(", ")}`).toBe(false);
      }
    }
  });
});

/**
 * Le tri entre « l'envoi a échoué » et « l'adresse n'existe pas ». Les deux
 * laissent la même ligne « Échec » au journal, et seule la seconde demande une
 * correction humaine : la renvoyer échouerait à l'identique, en consommant du
 * quota.
 */
describe("adresses inexistantes", () => {
  it("reconnaît le refus de destinataire de Gmail", () => {
    // Relevé le 18 novembre 2026 dans l'historique, au milieu des refus de quota.
    expect(
      adresseMorte(
        "Data command failed: 550-5.1.1 The email account that you tried to reach " +
          "does not exist. Please try double-checking the recipient's email address " +
          "for typos. 550 5.1.1 https://support.google.com/mail/?p=NoSuchUser",
      ),
    ).toBe(true);
  });

  it("ne confond pas un refus de quota avec une adresse morte", () => {
    // Celui-ci se renvoie, et c'est tout l'intérêt du bouton.
    expect(adresseMorte("Data command failed: 550-5.4.5 Daily user sending limit exceeded")).toBe(
      false,
    );
  });

  it("ne confond pas une panne d'envoi avec une adresse morte", () => {
    expect(adresseMorte("connect ECONNREFUSED 127.0.0.1:587")).toBe(false);
    expect(adresseMorte("454-4.7.0 Too many login attempts")).toBe(false);
    expect(adresseMorte(null)).toBe(false);
  });
});
