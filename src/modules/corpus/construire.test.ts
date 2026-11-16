import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CLES_ACCUEIL_PAR_DEFAUT,
  documentActualite,
  documentBloc,
  documentHotel,
  documentIntervenant,
  documentSection,
  documentSession,
  documentsReperes,
  type LigneArticle,
  type LigneHotel,
  type LigneSession,
} from "./construire";
import { REPERES } from "./reperes";

/**
 * Ce que ces tests protègent (16 novembre 2026).
 *
 * Trois choses peuvent mal tourner dans un export destiné à un assistant de
 * recherche, et aucune ne se voit à la lecture du code :
 *
 * 1. livrer un contenu non publié — un panéliste encore pressenti, un hôtel
 *    sans tarifs validés ;
 * 2. livrer du balisage au lieu d'une phrase, parce que les textes longs sont
 *    stockés en document structuré et non en HTML ;
 * 3. livrer une donnée personnelle, par une jointure ajoutée un jour sans y
 *    penser.
 *
 * Les deux premières se vérifient sur des objets écrits à la main. La
 * troisième se vérifie sur le **code** de `service.ts` : c'est la liste de ses
 * requêtes qui garantit la règle, et une table interdite y serait visible.
 */

const DOC_RICHE = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Le Forum se tient à l'hôtel " },
        { type: "text", text: "King Fahd Palace", marks: [{ type: "bold" }] },
        { type: "text", text: ", à Dakar." },
      ],
    },
  ],
});

function seance(ajustements: Partial<LigneSession> = {}): LigneSession {
  return {
    id: "ses1",
    slug: "panel-donnees-ouvertes",
    number: 4,
    type: "PANEL",
    titleFr: "Panel sur les données ouvertes",
    titleEn: "Panel on open data",
    titlePt: null,
    descriptionFr: "Trois experts débattent de l'ouverture des données publiques.",
    descriptionEn: "Three experts discuss opening up public data.",
    descriptionPt: null,
    objectives: "Identifier trois obstacles à l'ouverture.",
    theme: "Gouvernance",
    day: new Date("2026-11-24T00:00:00.000Z"),
    startTime: new Date("2026-11-24T09:30:00.000Z"),
    endTime: new Date("2026-11-24T11:00:00.000Z"),
    liveStreamUrl: null,
    tdrPath: "tdr/ses1.pdf",
    updatedAt: new Date("2026-11-10T08:00:00.000Z"),
    room: { name: "Salle A" },
    speakers: [
      {
        role: "MODERATOR",
        speaker: {
          firstName: "Aminata",
          lastName: "Diallo",
          jobTitle: "Directrice des statistiques",
          organization: "ANSD",
          country: "Sénégal",
          isPublished: true,
        },
      },
      {
        role: "PANELIST",
        speaker: {
          firstName: "Pressenti",
          lastName: "Nonpublie",
          jobTitle: null,
          organization: null,
          country: null,
          isPublished: false,
        },
      },
    ],
    ...ajustements,
  };
}

describe("documentSession", () => {
  it("n'annonce pas un intervenant non publié", () => {
    const document = documentSession(seance(), "fr");
    expect(document.texte).toContain("Aminata Diallo");
    expect(document.texte).not.toContain("Nonpublie");
  });

  it("donne l'adresse de la fiche de la séance", () => {
    expect(documentSession(seance(), "fr").url).toBe("/programme/panel-donnees-ouvertes");
  });

  it("livre l'horaire en données citables, lues en UTC comme le site", () => {
    const document = documentSession(seance(), "fr");
    expect(document.donnees).toMatchObject({
      jour: "2026-11-24",
      debut: "09:30",
      fin: "11:00",
      salle: "Salle A",
      numero: 4,
    });
  });

  it("joint les termes de référence quand la séance en porte", () => {
    expect(documentSession(seance(), "fr").donnees?.tdr).toBe("/api/v1/sessions/ses1/tdr");
    expect(documentSession(seance({ tdrPath: null }), "fr").donnees?.tdr).toBeUndefined();
  });

  it("retombe sur le français quand le portugais manque", () => {
    const document = documentSession(seance(), "pt");
    // Titre absent en portugais : l'anglais d'abord, puis le français.
    expect(document.titre).toBe("Panel on open data");
  });

  it("écarte un type de séance inconnu sans tomber", () => {
    const document = documentSession(seance({ type: "ATELIER_NOUVEAU" }), "fr");
    expect(document.resume).toContain("ATELIER_NOUVEAU");
  });
});

describe("documentIntervenant", () => {
  it("renvoie vers l'ancre de sa carte dans l'annuaire", () => {
    const document = documentIntervenant(
      {
        id: "spk1",
        firstName: "Aminata",
        lastName: "Diallo",
        jobTitle: "Directrice",
        organization: "ANSD",
        country: "Sénégal",
        bioFr: "Statisticienne, vingt ans de terrain.",
        bioEn: null,
        bioPt: null,
        updatedAt: new Date("2026-11-01T00:00:00.000Z"),
        sessions: [
          {
            role: "MODERATOR",
            session: {
              titleFr: "Panel sur les données ouvertes",
              titleEn: "Panel on open data",
              titlePt: null,
              theme: "Gouvernance",
            },
          },
        ],
      },
      "fr",
    );

    expect(document.url).toBe("/intervenants#intervenant-spk1");
    expect(document.texte).toContain("Statisticienne");
    expect(document.texte).toContain("Panel sur les données ouvertes");
  });
});

describe("aplatissement des textes mis en forme", () => {
  function article(ajustements: Partial<LigneArticle> = {}): LigneArticle {
    return {
      id: "post1",
      slug: "ouverture-du-forum",
      titleFr: "Ouverture du Forum",
      titleEn: "Forum opening",
      titlePt: null,
      excerptFr: null,
      excerptEn: null,
      excerptPt: null,
      bodyFr: DOC_RICHE,
      bodyEn: "",
      bodyPt: null,
      publishedAt: new Date("2026-11-05T00:00:00.000Z"),
      updatedAt: new Date("2026-11-05T10:00:00.000Z"),
      ...ajustements,
    };
  }

  it("livre une phrase, et pas le document structuré", () => {
    const document = documentActualite(article(), "fr");
    expect(document.texte).toBe("Le Forum se tient à l'hôtel King Fahd Palace, à Dakar.");
    expect(document.texte).not.toContain("paragraph");
    expect(document.texte).not.toContain("{");
  });

  it("lit aussi un texte brut saisi avant l'éditeur", () => {
    const document = documentActualite(
      article({ bodyFr: "Première ligne\n\nSeconde ligne" }),
      "fr",
    );
    expect(document.texte).toBe("Première ligne\nSeconde ligne");
  });

  it("aplatit un bloc éditorial riche et laisse un titre tel quel", () => {
    const riche = documentBloc(
      {
        key: "legal.terms",
        valueFr: DOC_RICHE,
        valueEn: null,
        valuePt: null,
        updatedAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      "fr",
    );
    expect(riche?.url).toBe("/mentions-legales");
    expect(riche?.texte).toContain("King Fahd Palace");
    expect(riche?.texte).not.toContain("marks");

    const titre = documentBloc(
      {
        key: "home.hero.title",
        valueFr: "Forum international sur les données",
        valueEn: null,
        valuePt: null,
        updatedAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      "fr",
    );
    expect(titre?.texte).toBe("Forum international sur les données");
  });

  it("ignore un bloc sans page de destination", () => {
    expect(
      documentBloc(
        {
          key: "cle.inconnue",
          valueFr: "Texte",
          valueEn: null,
          valuePt: null,
          updatedAt: new Date(),
        },
        "fr",
      ),
    ).toBeNull();
  });
});

describe("documentSection", () => {
  it("mène à l'ancre de la section quand elle en porte une", () => {
    const document = documentSection(
      {
        id: "sec1",
        page: "accueil",
        type: "texte",
        contentFr: { titre: "À propos du Forum", corps: DOC_RICHE, imageAlt: "Un histogramme" },
        contentEn: {},
        contentPt: null,
        settings: { ancre: "a-propos" },
        updatedAt: new Date("2026-10-20T00:00:00.000Z"),
      },
      "fr",
    );

    expect(document?.url).toBe("/#a-propos");
    expect(document?.titre).toBe("À propos du Forum");
    expect(document?.texte).toContain("King Fahd Palace");
    // Le texte alternatif décrit une image : il n'est pas du contenu.
    expect(document?.texte).not.toContain("histogramme");
  });

  it("ignore une section d'un type absent du catalogue", () => {
    expect(
      documentSection(
        {
          id: "sec2",
          page: "accueil",
          type: "type-inexistant",
          contentFr: { titre: "T" },
          contentEn: {},
          contentPt: null,
          settings: {},
          updatedAt: new Date(),
        },
        "fr",
      ),
    ).toBeNull();
  });
});

describe("documentHotel", () => {
  const hotel: LigneHotel = {
    id: "hot1",
    name: "King Fahd Palace",
    category: "5 étoiles",
    address: "Route des Almadies",
    district: "Almadies",
    distanceKm: "0.00" as unknown as { toString(): string },
    phone: "+221 33 869 69 69",
    email: null,
    website: "https://example.org",
    mapUrl: null,
    descriptionFr: "Lieu du Forum.",
    descriptionEn: null,
    descriptionPt: null,
    amenities: ["navette", "wifi"],
    bookingCode: "FORUM2026-SECRET",
    bookingUrl: "https://example.org/reserver",
    updatedAt: new Date("2026-11-02T00:00:00.000Z"),
    rates: [
      {
        roomType: "Chambre simple",
        price: 95000,
        currency: "XOF",
        conditions: "Petit-déjeuner inclus",
      },
    ],
  };

  it("livre les tarifs et les prestations", () => {
    const document = documentHotel(hotel, "fr");
    expect(document.texte).toContain("Chambre simple");
    expect(document.texte).toContain("XOF");
    expect(document.texte).toContain("navette");
  });

  it("ne livre pas le code de réservation négocié", () => {
    const document = documentHotel(hotel, "fr");
    expect(JSON.stringify(document)).not.toContain("FORUM2026-SECRET");
  });
});

describe("blocs de la composition d'origine de l'accueil", () => {
  const defaut = readFileSync(
    fileURLToPath(new URL("../sections/defaut.ts", import.meta.url)),
    "utf8",
  );
  const service = readFileSync(fileURLToPath(new URL("./service.ts", import.meta.url)), "utf8");

  it("ne recense que des blocs réellement lus par cette composition", () => {
    for (const cle of CLES_ACCUEIL_PAR_DEFAUT) {
      expect(defaut, cle).toContain(`"${cle}"`);
    }
  });

  it("n'y range pas les pages légales, qui ont leur propre page", () => {
    expect(CLES_ACCUEIL_PAR_DEFAUT.has("legal.terms")).toBe(false);
    expect(CLES_ACCUEIL_PAR_DEFAUT.has("legal.privacy")).toBe(false);
  });

  it("les écarte quand le comité a composé l'accueil", () => {
    // La condition vit dans `service.ts`, qui connaît seul le nombre de
    // sections visibles : c'est là qu'elle doit rester lisible.
    expect(service).toContain("accueilCompose && CLES_ACCUEIL_PAR_DEFAUT.has(bloc.key)");
    expect(service).toContain("const accueilCompose = sections.length > 0");
  });
});

describe("repères", () => {
  it("marque les pages personnelles comme exigeant une connexion", () => {
    const documents = documentsReperes("fr");
    const espace = documents.find((document) => document.url === "/mon-espace");
    expect(espace?.connexionRequise).toBe(true);

    const programme = documents.find((document) => document.url === "/programme");
    expect(programme?.connexionRequise).toBeUndefined();
  });

  it("donne un identifiant unique à chaque repère, dans chaque langue", () => {
    const identifiants = ["fr", "en", "pt"].flatMap((langue) =>
      documentsReperes(langue as "fr").map((document) => document.id),
    );
    expect(new Set(identifiants).size).toBe(identifiants.length);
  });

  it("est écrit dans les trois langues", () => {
    for (const repere of REPERES) {
      expect(repere.titre.fr.trim().length, repere.cle).toBeGreaterThan(0);
      expect(repere.titre.en.trim().length, repere.cle).toBeGreaterThan(0);
      expect(repere.titre.pt.trim().length, repere.cle).toBeGreaterThan(0);
      expect(repere.texte.fr.trim().length, repere.cle).toBeGreaterThan(0);
      expect(repere.texte.en.trim().length, repere.cle).toBeGreaterThan(0);
      expect(repere.texte.pt.trim().length, repere.cle).toBeGreaterThan(0);
    }
  });
});

describe("garde : aucune table de personnes dans l'export", () => {
  const source = readFileSync(fileURLToPath(new URL("./service.ts", import.meta.url)), "utf8");

  /**
   * Tables dont une seule ligne lue ici ferait sortir une donnée personnelle du
   * portail. `prisma.speaker` n'y est pas : les intervenants publiés sont déjà
   * sur le site, et la requête les restreint à `isPublished`.
   */
  const INTERDITES = [
    "participant",
    "invitation",
    "delegation",
    "referent",
    "badge",
    "scanLog",
    "sessionRegistration",
    "user",
    "magicLink",
    "notificationLog",
    "auditLog",
    "adminLoginChallenge",
  ];

  for (const table of INTERDITES) {
    it(`ne lit pas prisma.${table}`, () => {
      expect(source).not.toContain(`prisma.${table}.`);
    });
  }

  it("ne lit les intervenants que publiés", () => {
    expect(source).toContain("prisma.speaker.findMany");
    expect(source).toMatch(/editionId: edition\.id, isPublished: true, deletedAt: null/);
  });
});
