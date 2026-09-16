import { describe, expect, it } from "vitest";
import { detecterImageDeposee, verifierSvg } from "./image-deposee";

/**
 * Le SVG accepté en logo est du code exécutable par nature : ces tests sont la
 * contrepartie de cette décision. Chaque cas refusé correspond à une façon
 * connue de faire passer autre chose qu'une image par un formulaire de dépôt.
 */

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const svg = (interieur: string, attributs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"${attributs}>${interieur}</svg>`;

describe("SVG accepté", () => {
  it("laisse passer un logo ordinaire", () => {
    expect(verifierSvg(svg('<rect width="120" height="60" fill="#0b4f8a"/>')).accepte).toBe(true);
  });

  it("laisse passer les références internes, qui servent aux dégradés", () => {
    const contenu = svg(
      '<defs><linearGradient id="d"><stop offset="0"/></linearGradient></defs>' +
        '<rect width="120" height="60" fill="url(#d)"/><use href="#d"/>',
    );
    expect(verifierSvg(contenu).accepte).toBe(true);
  });

  it("laisse passer un style en ligne", () => {
    expect(verifierSvg(svg("<style>.a{fill:#000}</style><rect class='a'/>")).accepte).toBe(true);
  });
});

describe("SVG refusé", () => {
  const cas: [string, string][] = [
    ["script", svg('<script>fetch("//ailleurs")</script>')],
    ["foreignObject", svg("<foreignObject><body>bonjour</body></foreignObject>")],
    ["document imbriqué", svg('<iframe src="//ailleurs"></iframe>')],
    ["gestionnaire d'événement", svg('<rect onload="alert(1)"/>')],
    ["gestionnaire d'événement sur la racine", svg("<rect/>", ' onload="alert(1)"')],
    ["URL javascript:", svg('<a href="javascript:alert(1)"><rect/></a>')],
    ["data: HTML", svg('<image href="data:text/html,<script>alert(1)</script>"/>')],
    ["référence externe", svg('<image href="https://ailleurs.example/pixel.png"/>')],
    ["référence externe sans protocole", svg('<image xlink:href="//ailleurs.example/p.png"/>')],
    ["entité XML", '<!DOCTYPE svg [<!ENTITY a "aaaa">]>' + svg("<text>&a;</text>")],
  ];

  it.each(cas)("refuse : %s", (_nom, contenu) => {
    expect(verifierSvg(contenu).accepte).toBe(false);
  });

  it("refuse un fichier qui n'est pas un SVG du tout", () => {
    expect(verifierSvg("bonjour").accepte).toBe(false);
  });

  it("donne la raison du refus, pour que l'agent sache quoi corriger", () => {
    const verdict = verifierSvg(svg("<script>1</script>"));
    expect(verdict.raison).toBe("script");
  });
});

describe("détection du type d'image déposée", () => {
  it("reconnaît un PNG par sa signature binaire", () => {
    const resultat = detecterImageDeposee(PNG);
    expect(resultat.type).toEqual({ extension: "png", type: "image/png", vectoriel: false });
  });

  it("reconnaît un SVG et le marque comme vectoriel", () => {
    const resultat = detecterImageDeposee(Buffer.from(svg("<rect/>")));
    expect(resultat.type?.type).toBe("image/svg+xml");
    expect(resultat.type?.vectoriel).toBe(true);
  });

  it("refuse un SVG porteur de script, et le dit", () => {
    const resultat = detecterImageDeposee(Buffer.from(svg("<script>1</script>")));
    expect(resultat.type).toBeUndefined();
    expect(resultat.refus).toContain("script");
  });

  it("refuse un fichier d'un tout autre format", () => {
    const resultat = detecterImageDeposee(Buffer.from("%PDF-1.4\n%test\n"));
    expect(resultat.type).toBeUndefined();
    expect(resultat.refus).toContain("non reconnu");
  });

  it("ne se laisse pas tromper par une extension mensongère", () => {
    /*
     * Le nom du fichier n'entre jamais dans la décision : seuls les octets
     * comptent. Un HTML renommé « logo.svg » ne porte pas de balise <svg> et
     * ne doit pas passer.
     */
    const html = Buffer.from("<html><body><script>alert(1)</script></body></html>");
    expect(detecterImageDeposee(html).type).toBeUndefined();
  });
});
