import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lireTexteRiche, texteBrut } from "@/lib/texte-riche";
import { besoinsDe, CATALOGUE, CLES_TYPES, reglagesParDefaut, typeSection } from "./catalogue";
import {
  ContenuSectionError,
  normaliserAncre,
  normaliserSection,
  type SectionInput,
} from "./schema";

const RENDU = readFileSync(
  join(process.cwd(), "src/modules/sections/components/rendu-section.tsx"),
  "utf8",
);

describe("catalogue des sections", () => {
  it("n'a ni clé ni variante en double", () => {
    expect(new Set(CLES_TYPES).size).toBe(CLES_TYPES.length);
    for (const type of CATALOGUE) {
      const cles = type.variantes.map((variante) => variante.cle);
      expect(new Set(cles).size, `variantes de ${type.cle}`).toBe(cles.length);
    }
  });

  it("donne au moins une variante à chaque type", () => {
    // `normaliserSection` retombe sur la première : sans elle, une variante
    // inconnue laisserait la section sans présentation.
    for (const type of CATALOGUE) {
      expect(type.variantes.length, type.cle).toBeGreaterThan(0);
    }
  });

  it("déclare un rendu pour chaque type", () => {
    // Le défaut que ce test ferme : ajouter une entrée au catalogue sans écrire
    // son rendu. La section serait proposée à l'ajout, enregistrée, réglée…
    // puis n'afficherait rien, sans la moindre erreur.
    for (const type of CATALOGUE) {
      expect(RENDU, `rendu manquant pour ${type.cle}`).toContain(`case "${type.cle}"`);
    }
  });

  it("produit des réglages par défaut complets", () => {
    for (const type of CATALOGUE) {
      const defauts = reglagesParDefaut(type.cle);
      for (const champ of type.reglages) {
        expect(defauts, `${type.cle}.${champ.cle}`).toHaveProperty(champ.cle);
      }
    }
  });

  it("ne charge que les données réellement nécessaires", () => {
    expect([...besoinsDe(["texte"])]).toEqual([]);
    expect([...besoinsDe(["actualites"])]).toEqual(["actualites"]);
    // Deux sections qui réclament la même donnée ne la chargent qu'une fois.
    expect([...besoinsDe(["hero", "chiffres"])]).toEqual(["stats"]);
  });
});

function sectionBrute(partiel: Partial<SectionInput> = {}): SectionInput {
  return {
    page: "accueil",
    type: "actualites",
    variant: "cartes",
    sortOrder: 10,
    isVisible: true,
    contentFr: { titre: "Actualités" },
    contentEn: {},
    settings: { nombre: 3 },
    ...partiel,
  };
}

function blocTexte(partiel: Partial<SectionInput> = {}): SectionInput {
  return sectionBrute({
    type: "texte",
    variant: "clair",
    contentFr: { titre: "", corps: "Un texte", imageAlt: "" },
    contentEn: { titre: "", corps: "", imageAlt: "" },
    settings: {},
    ...partiel,
  });
}

describe("normalisation d'une section", () => {
  it("retombe sur la première variante si celle demandée n'existe pas", () => {
    const normalise = normaliserSection(sectionBrute({ variant: "inventee" }));
    expect(normalise.variant).toBe(typeSection("actualites")!.variantes[0]!.cle);
  });

  it("ramène un nombre hors bornes dans l'intervalle du catalogue", () => {
    // Une Server Action s'appelle sans passer par le formulaire : « 900 articles »
    // doit être ramené à 6, pas exécuté.
    expect(normaliserSection(sectionBrute({ settings: { nombre: 900 } })).settings.nombre).toBe(6);
    expect(normaliserSection(sectionBrute({ settings: { nombre: -4 } })).settings.nombre).toBe(1);
  });

  it("remplace un nombre illisible par la valeur par défaut", () => {
    expect(
      normaliserSection(sectionBrute({ settings: { nombre: "beaucoup" } })).settings.nombre,
    ).toBe(3);
  });

  it("écarte les champs de contenu que le type ne déclare pas", () => {
    const normalise = normaliserSection(
      sectionBrute({ contentFr: { titre: "Actualités", intrus: "à jeter" } }),
    );
    expect(normalise.contentFr).toEqual({ titre: "Actualités" });
  });

  it("complète les champs déclarés mais absents", () => {
    const normalise = normaliserSection(sectionBrute({ contentFr: {} }));
    expect(normalise.contentFr).toEqual({ titre: "" });
  });

  it("écarte un bouton sans adresse ni libellé", () => {
    const normalise = normaliserSection(
      sectionBrute({
        type: "appel",
        variant: "clair",
        contentFr: { titre: "Rejoignez-nous", corps: "" },
        settings: {
          boutons: [
            { href: "/inscription", labelFr: "S'inscrire", labelEn: "", style: "principal" },
            { href: "", labelFr: "", labelEn: "", style: "secondaire" },
          ],
        },
      }),
    );
    // Un bouton incomplet ferait un lien mort sur la page publique.
    expect(normalise.settings.boutons).toEqual([]);
  });

  it("conserve une liste de boutons entièrement valide", () => {
    const boutons = [
      { href: "/inscription", labelFr: "S'inscrire", labelEn: "Register", style: "principal" },
    ];
    const normalise = normaliserSection(
      sectionBrute({
        type: "appel",
        variant: "clair",
        contentFr: { titre: "Rejoignez-nous", corps: "" },
        settings: { boutons },
      }),
    );
    expect(normalise.settings.boutons).toEqual(boutons);
  });

  it("refuse un type absent du catalogue", () => {
    expect(() => normaliserSection(sectionBrute({ type: "carrousel-3d" }))).toThrow(
      /Type de section inconnu/,
    );
  });
});

describe("ancre de section", () => {
  it("est proposée par tous les types, y compris ceux ajoutés plus tard", () => {
    /*
     * L'ancre est ajoutée au catalogue en une seule fois plutôt que recopiée
     * dans chaque type. Ce test dit pourquoi c'est important : un type ajouté
     * demain la reçoit sans que personne ait à y penser, et cette assertion
     * échouerait si quelqu'un revenait à des listes de réglages écrites à la
     * main.
     */
    for (const type of CATALOGUE) {
      const ancre = type.reglages.find((reglage) => reglage.cle === "ancre");
      expect(ancre, type.cle).toBeDefined();
      expect(ancre?.type, type.cle).toBe("ancre");
    }
  });

  it("réduit une ancre saisie à ce qui tient dans une URL", () => {
    expect(normaliserAncre("À propos")).toBe("a-propos");
    expect(normaliserAncre("  Nos Partenaires !  ")).toBe("nos-partenaires");
    expect(normaliserAncre("déjà-écrit")).toBe("deja-ecrit");
    expect(normaliserAncre("")).toBe("");
    expect(normaliserAncre(undefined)).toBe("");
  });

  it("survit à un enregistrement de la section", () => {
    /*
     * La normalisation ne garde que les réglages déclarés par le type. Une
     * ancre posée dans les données sans être déclarée disparaîtrait à la
     * première modification en BackOffice — silencieusement, ce qui casserait
     * la redirection de l'ancienne page « À propos » sans que rien ne l'annonce.
     */
    const normalisee = normaliserSection({
      page: "accueil",
      type: "texte",
      variant: "adouci",
      sortOrder: 15,
      isVisible: true,
      settings: { ancre: "À propos" },
      contentFr: { titre: "À propos du Forum", corps: "…" },
      contentEn: { titre: "About", corps: "…" },
    });
    expect(normalisee.settings.ancre).toBe("a-propos");
  });
});

describe("illustration de section", () => {
  it("n'est proposée qu'aux types qui ont une place pour elle", () => {
    /*
     * Une illustration sur les actualités, les intervenants ou les partenaires
     * n'aurait nulle part où aller : ces types portent déjà leurs propres
     * visuels. Le réglage est donc réservé, et ce test dit lesquels.
     */
    const illustrables = CATALOGUE.filter((type) =>
      type.reglages.some((reglage) => reglage.cle === "image"),
    ).map((type) => type.cle);

    expect(illustrables.sort()).toEqual(["appel", "hero", "texte"]);
  });

  it("donne un texte alternatif à chaque type illustrable", () => {
    // Une image sans texte alternatif est muette pour qui ne la voit pas, et le
    // champ doit exister par langue — d'où sa place dans le contenu.
    for (const cle of ["hero", "texte", "appel"]) {
      const type = typeSection(cle);
      expect(
        type?.champs.some((champ) => champ.cle === "imageAlt"),
        cle,
      ).toBe(true);
    }
  });

  it("conserve le chemin de l'illustration à l'enregistrement", () => {
    /*
     * Le chemin n'est pas saisi : il est produit par le dépôt du fichier. La
     * normalisation ne doit donc ni l'inventer ni le perdre — le perdre
     * détacherait l'image à chaque modification d'un autre champ.
     */
    const normalisee = normaliserSection({
      page: "accueil",
      type: "texte",
      variant: "clair",
      sortOrder: 10,
      isVisible: true,
      settings: { image: "sections/abc-123.jpg", ancre: "" },
      contentFr: { titre: "T", corps: "C", imageAlt: "Un histogramme" },
      contentEn: { titre: "T", corps: "C", imageAlt: "A bar chart" },
    });

    expect(normalisee.settings.image).toBe("sections/abc-123.jpg");
    expect(normalisee.contentFr.imageAlt).toBe("Un histogramme");
  });

  it("accepte le retrait de l'illustration", () => {
    const normalisee = normaliserSection({
      page: "accueil",
      type: "texte",
      variant: "clair",
      sortOrder: 10,
      isVisible: true,
      settings: { image: "" },
      contentFr: { titre: "", corps: "C" },
      contentEn: { titre: "", corps: "C" },
    });
    expect(normalisee.settings.image).toBe("");
  });
});

describe("fond sombre", () => {
  it("est proposé partout où un fond est proposé", () => {
    for (const cle of ["texte", "appel"]) {
      const variantes = typeSection(cle)!.variantes.map((variante) => variante.cle);
      expect(variantes, cle).toEqual(["clair", "adouci", "sombre"]);
    }
  });

  it("survit à l'enregistrement", () => {
    expect(normaliserSection(blocTexte({ variant: "sombre" })).variant).toBe("sombre");
  });

  it("fait passer la section dans le thème sombre du site plutôt que de poser des couleurs", () => {
    /*
     * Des couleurs claires posées une à une auraient oublié un lien ou un
     * bouton. Le rendu bascule la section entière dans le thème sombre, dont
     * chaque couple de couleurs est mesuré par `palette.test.ts`.
     */
    expect(RENDU).toContain('variant === "sombre"');
    expect(RENDU).toContain('theme: "dark"');
    expect(RENDU).toContain("data-theme={fond.theme}");
  });
});

describe("position de l'illustration", () => {
  it("accompagne l'illustration, et elle seule", () => {
    for (const type of CATALOGUE) {
      const aImage = type.reglages.some((reglage) => reglage.cle === "image");
      const aPosition = type.reglages.some((reglage) => reglage.cle === "positionImage");
      expect(aPosition, type.cle).toBe(aImage);
    }
  });

  it("vaut « à droite » par défaut, la disposition d'avant", () => {
    expect(reglagesParDefaut("texte").positionImage).toBe("droite");
    expect(normaliserSection(blocTexte()).settings.positionImage).toBe("droite");
  });

  it("garde une position connue et ramène une valeur inconnue au défaut", () => {
    expect(
      normaliserSection(blocTexte({ settings: { positionImage: "gauche" } })).settings
        .positionImage,
    ).toBe("gauche");
    expect(
      normaliserSection(blocTexte({ settings: { positionImage: "au-plafond" } })).settings
        .positionImage,
    ).toBe("droite");
  });
});

describe("texte mis en forme dans les sections", () => {
  it("équipe les textes longs de l'éditeur, et laisse les titres en texte simple", () => {
    expect(typeSection("texte")!.champs.find((champ) => champ.cle === "corps")?.type).toBe("riche");
    expect(typeSection("appel")!.champs.find((champ) => champ.cle === "corps")?.type).toBe("riche");
    expect(typeSection("hero")!.champs.find((champ) => champ.cle === "chapo")?.type).toBe("riche");
    for (const type of CATALOGUE) {
      expect(type.champs.find((champ) => champ.cle === "titre")?.type, type.cle).not.toBe("riche");
    }
  });

  it("enregistre un document structuré, jamais du HTML", () => {
    const saisi = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Important", marks: [{ type: "bold" }] },
            { type: "text", text: " <script>alert(1)</script>" },
          ],
        },
      ],
    });
    const corps = normaliserSection(blocTexte({ contentFr: { corps: saisi } })).contentFr.corps!;
    expect(corps.startsWith('{"type":"doc"')).toBe(true);
    // La balise est du texte dans le document ; elle ne sera jamais rendue en HTML.
    expect(texteBrut(lireTexteRiche(corps))).toBe("Important <script>alert(1)</script>");
  });

  it("convertit un texte brut ancien au premier enregistrement, sans rien perdre", () => {
    const corps = normaliserSection(blocTexte({ contentFr: { corps: "Ligne un\nLigne deux" } }))
      .contentFr.corps!;
    expect(texteBrut(lireTexteRiche(corps))).toBe("Ligne un\nLigne deux");
  });

  it("enregistre un champ vidé comme une chaîne vide, pour que le repli de langue joue", () => {
    const vide = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
    expect(normaliserSection(blocTexte({ contentEn: { corps: vide } })).contentEn.corps).toBe("");
  });

  it("refuse un texte plus long que prévu, en caractères visibles", () => {
    expect(() => normaliserSection(blocTexte({ contentFr: { corps: "a".repeat(3001) } }))).toThrow(
      ContenuSectionError,
    );
    expect(() => normaliserSection(blocTexte({ contentFr: { corps: "a".repeat(3001) } }))).toThrow(
      /Texte.*dépasse 3000 caractères/,
    );
  });

  it("ne compte pas la mise en forme dans la longueur", () => {
    const texte = "a".repeat(3000);
    const enGras = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: texte, marks: [{ type: "bold" }] }] },
      ],
    });
    expect(() => normaliserSection(blocTexte({ contentFr: { corps: enGras } }))).not.toThrow();
  });

  it("refuse aussi un titre trop long, que le formulaire ait été contourné ou non", () => {
    expect(() =>
      normaliserSection(blocTexte({ contentFr: { titre: "t".repeat(121), corps: "C" } })),
    ).toThrow(/Titre.*dépasse 120 caractères/);
  });
});
