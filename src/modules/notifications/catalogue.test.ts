import { describe, expect, it } from "vitest";
import {
  CATALOGUE,
  declenchement,
  EXEMPLES,
  variablesDeclarees,
  variablesResolues,
  VARIABLES_PARTICIPANT,
} from "./catalogue";
import { undeclaredVariables } from "./service";

describe("catalogue des modèles de courriel", () => {
  it("complète les modèles adressés à un participant par les variables communes", () => {
    // `reminder_j7` n'en déclarait que deux en base, et l'écran reprochait les
    // autres à un modèle pourtant juste (17 novembre 2026).
    for (const nom of VARIABLES_PARTICIPANT) {
      expect(variablesDeclarees("reminder_j7")).toContain(nom);
    }
  });

  it("ne promet rien d'un participant quand le destinataire n'en est pas un", () => {
    // Le second facteur part vers un compte BackOffice : ni prénom ni espace.
    expect(variablesDeclarees("admin_login_code")).toEqual([
      "nom",
      "code6",
      "lien_validation",
      "minutes",
    ]);
  });

  it("déclare ce que l'émetteur fournit vraiment", () => {
    // Les trois émetteurs de `session_promoted` ne passent que `{{session}}` :
    // le reste vient des variables communes, et doit être déclaré quand même.
    expect(variablesDeclarees("session_promoted")).toContain("session");
    expect(variablesDeclarees("session_promoted")).toContain("prenom");
    expect(variablesDeclarees("session_promoted")).toContain("lien_espace");
  });

  it("retombe sur la colonne pour un modèle absent du catalogue", () => {
    expect(variablesDeclarees("modele_ajoute_en_base", ["prenom", "prenom", "truc"])).toEqual([
      "prenom",
      "truc",
    ]);
    expect(declenchement("modele_ajoute_en_base")).toBeNull();
  });

  it("ajoute le programme aux variables résolues, dans n'importe quel modèle", () => {
    expect(variablesResolues("admin_login_code")).toContain("programme");
    expect(variablesResolues("admin_login_code")).toContain("mes_panels");
    // Mais sans l'afficher comme variable propre au modèle.
    expect(variablesDeclarees("admin_login_code")).not.toContain("programme");
  });
});

describe("avertissement « variable non déclarée »", () => {
  it("se tait sur le programme, qui part bien rempli", () => {
    const undeclared = undeclaredVariables({
      bodyFr: "Bonjour {{prenom}},\n\nLe programme :\n{{programme}}\n{{mes_panels}}",
      bodyEn: "",
      declared: variablesResolues("reminder_j7"),
    });
    expect(undeclared).toEqual([]);
  });

  it("signale toujours une faute de frappe", () => {
    const undeclared = undeclaredVariables({
      bodyFr: "Bonjour {{prenon}},",
      bodyEn: "",
      declared: variablesResolues("reminder_j7"),
    });
    expect(undeclared).toEqual(["prenon"]);
  });
});

describe("prévisualisation du BackOffice", () => {
  it("a une valeur d'exemple pour chaque variable du catalogue", () => {
    // Sans valeur, l'aperçu affiche « {{programme}} » tel quel et laisse croire
    // à un modèle cassé — ce que l'écran du 17 novembre 2026 montrait.
    const manquantes = Object.keys(CATALOGUE)
      .flatMap((cle) => variablesResolues(cle))
      .filter((nom) => !EXEMPLES[nom]);
    expect([...new Set(manquantes)]).toEqual([]);
  });

  it("décrit le déclenchement de chaque modèle du catalogue", () => {
    const muets = Object.keys(CATALOGUE).filter((cle) => !declenchement(cle)?.trim());
    expect(muets).toEqual([]);
  });
});
