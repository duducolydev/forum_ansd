import { describe, expect, it } from "vitest";
import { detecterDocument } from "./fichier";
import { MODELES, reconnaitreVideo, TYPES_CONTRIBUTION, urlIntegration } from "./schema";

/**
 * Deux surfaces d'entrée, deux jeux de tests.
 *
 * Le lien vidéo et le fichier déposé sont les seuls endroits où une
 * contribution fait entrer sur le site public quelque chose que l'ANSD n'a pas
 * écrit. C'est là que se concentrent les vérifications.
 */

describe("catalogue des types", () => {
  it("décrit chacun des dix types du brief", () => {
    expect(TYPES_CONTRIBUTION).toHaveLength(10);
    for (const type of TYPES_CONTRIBUTION) {
      expect(MODELES[type], type).toBeDefined();
      expect(MODELES[type].label.length, type).toBeGreaterThan(0);
    }
  });

  it("réserve les Actes aux blocs de fond", () => {
    /*
     * Les Actes du Forum compilent ce qui s'est dit, pas les pièces jointes.
     * Cette liste est ce qui permettra de les générer sans demander à personne
     * de trier après coup.
     */
    const retenus = TYPES_CONTRIBUTION.filter((type) => MODELES[type].dansLesActes);
    expect(retenus.sort()).toEqual([
      "CONCLUSION",
      "KEY_QUESTIONS",
      "OBJECTIVES",
      "PROBLEM",
      "RECOMMENDATION",
      "SYNTHESIS",
    ]);
  });

  it("n'ouvre le lien externe qu'à la vidéo", () => {
    const avecLien = TYPES_CONTRIBUTION.filter((type) => MODELES[type].lien);
    expect(avecLien).toEqual(["VIDEO"]);
  });
});

describe("lien vidéo", () => {
  it("reconnaît les formes courantes de YouTube et Vimeo", () => {
    expect(reconnaitreVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      hebergeur: "youtube",
      identifiant: "dQw4w9WgXcQ",
    });
    expect(reconnaitreVideo("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      hebergeur: "youtube",
      identifiant: "dQw4w9WgXcQ",
    });
    expect(reconnaitreVideo("https://vimeo.com/123456789")).toEqual({
      hebergeur: "vimeo",
      identifiant: "123456789",
    });
  });

  const refuses: [string, string][] = [
    ["un autre hébergeur", "https://exemple.test/video/1"],
    ["du HTTP en clair", "http://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["une URL javascript", "javascript:alert(1)"],
    ["un domaine qui imite YouTube", "https://youtube.com.exemple.test/watch?v=abcdef"],
    ["une adresse sans identifiant", "https://www.youtube.com/watch"],
    ["un texte quelconque", "regardez cette vidéo"],
  ];

  it.each(refuses)("refuse : %s", (_nom, url) => {
    expect(reconnaitreVideo(url)).toBeNull();
  });

  it("reconstruit l'adresse d'intégration au lieu de reprendre celle saisie", () => {
    /*
     * C'est la garantie qui compte : ce qui finit dans une `<iframe>` du site
     * public est fabriqué par le code à partir d'un identifiant validé, jamais
     * l'URL telle qu'elle a été collée.
     */
    const video = reconnaitreVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&list=PLxyz");
    expect(urlIntegration(video!)).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
});

describe("document déposé", () => {
  const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64, 0x20)]);
  const zip = (contenu: string) =>
    Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(contenu, "latin1")]);

  it("reconnaît un PDF à ses octets", () => {
    expect(detecterDocument(pdf)?.extension).toBe("pdf");
  });

  it("reconnaît un PPTX à la trace de sa structure", () => {
    expect(detecterDocument(zip("[Content_Types].xml ppt/slides/slide1.xml"))?.extension).toBe(
      "pptx",
    );
  });

  it("refuse un DOCX, qui est pourtant un ZIP Office", () => {
    // La signature ZIP ne distingue pas les formats Office entre eux : c'est la
    // mention `ppt/` qui tranche, et elle est absente ici.
    expect(detecterDocument(zip("[Content_Types].xml word/document.xml"))).toBeNull();
  });

  it("refuse une archive quelconque", () => {
    expect(detecterDocument(zip("photos/vacances.jpg"))).toBeNull();
  });

  it("ne se laisse pas tromper par un exécutable renommé", () => {
    /*
     * Le risque n'est pas l'exécution sur le serveur, qui n'ouvre rien : c'est
     * la **distribution**. Un exécutable nommé `presentation.pdf` deviendrait
     * un téléchargement proposé par l'ANSD sur son site.
     */
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64, 0)]);
    expect(detecterDocument(exe)).toBeNull();
  });

  it("refuse un fichier vide ou tronqué", () => {
    expect(detecterDocument(Buffer.alloc(0))).toBeNull();
    expect(detecterDocument(Buffer.from("%PD"))).toBeNull();
  });
});
