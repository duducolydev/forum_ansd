import { describe, expect, it } from "vitest";
import {
  docDepuisTexteBrut,
  lienAutorise,
  lireTexteRiche,
  nettoyerDoc,
  normaliserTexteRiche,
  serialiserTexteRiche,
  texteBrut,
} from "./texte-riche";

describe("texte mis en forme — lecture", () => {
  it("lit un texte brut ancien comme l'affichage d'avant : ligne vide = paragraphe", () => {
    const doc = docDepuisTexteBrut("Premier paragraphe\nsuite\n\nSecond paragraphe");
    expect(doc.content).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Premier paragraphe" },
          { type: "hardBreak" },
          { type: "text", text: "suite" },
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "Second paragraphe" }] },
    ]);
  });

  it("lit un document structuré enregistré par l'éditeur", () => {
    const stocke = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Important", marks: [{ type: "bold" }] }],
        },
      ],
    });
    expect(texteBrut(lireTexteRiche(stocke))).toBe("Important");
  });

  it("lit comme du texte un contenu qui commence par une accolade sans être un document", () => {
    expect(texteBrut(lireTexteRiche("{ceci est du texte}"))).toBe("{ceci est du texte}");
  });

  it("donne un document vide pour une valeur absente", () => {
    expect(lireTexteRiche("").content).toEqual([]);
    expect(lireTexteRiche(undefined).content).toEqual([]);
  });
});

describe("texte mis en forme — nettoyage", () => {
  it("ne garde que les marques permises, une fois chacune", () => {
    const doc = nettoyerDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Mot",
              marks: [
                { type: "bold" },
                { type: "bold" },
                { type: "textStyle", attrs: { color: "red" } },
                { type: "underline" },
              ],
            },
          ],
        },
      ],
    });
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Mot", marks: [{ type: "bold" }, { type: "underline" }] }],
    });
  });

  it("retire un lien dangereux sans perdre son texte", () => {
    const doc = nettoyerDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "cliquez",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    });
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "cliquez" }],
    });
  });

  it("écarte les nœuds inconnus et change un titre en paragraphe", () => {
    const doc = nettoyerDoc({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Titre collé" }] },
        { type: "image", attrs: { src: "https://exemple.test/x.png" } },
        { type: "codeBlock", content: [{ type: "text", text: "<script>" }] },
      ],
    });
    expect(doc.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Titre collé" }] },
    ]);
  });

  it("garde les listes et leurs éléments non vides", () => {
    const doc = nettoyerDoc({
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Un" }] }],
            },
            { type: "listItem", content: [] },
          ],
        },
      ],
    });
    expect(doc.content).toEqual([
      {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Un" }] }],
          },
        ],
      },
    ]);
  });

  it("rejette un document qui n'en est pas un", () => {
    expect(nettoyerDoc({ type: "paragraph" }).content).toEqual([]);
    expect(nettoyerDoc("<p>html</p>").content).toEqual([]);
    expect(nettoyerDoc(null).content).toEqual([]);
  });
});

describe("texte mis en forme — liens", () => {
  it("accepte le web, le courriel et les chemins internes", () => {
    expect(lienAutorise("https://www.ansd.sn")).toBe("https://www.ansd.sn");
    expect(lienAutorise("mailto:forum@ansd.sn")).toBe("mailto:forum@ansd.sn");
    expect(lienAutorise("/programme")).toBe("/programme");
  });

  it("refuse ce qui exécuterait du code ou sortirait du site en ayant l'air interne", () => {
    for (const refuse of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "//site-tiers.example",
      "/\\site-tiers.example",
      "programme",
      "",
    ]) {
      expect(lienAutorise(refuse), refuse).toBeNull();
    }
  });
});

describe("texte mis en forme — enregistrement", () => {
  it("stocke un document sans texte comme une chaîne vide, pour que le repli de langue joue", () => {
    expect(serialiserTexteRiche({ type: "doc", content: [{ type: "paragraph" }] })).toBe("");
    expect(normaliserTexteRiche("   ").valeur).toBe("");
  });

  it("compte les caractères visibles, pas le balisage", () => {
    const stocke = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bonjour", marks: [{ type: "bold" }, { type: "italic" }] },
          ],
        },
      ],
    });
    expect(normaliserTexteRiche(stocke).longueur).toBe("Bonjour".length);
  });

  it("convertit un texte brut en document à l'enregistrement, sans rien perdre", () => {
    const { valeur } = normaliserTexteRiche("Ligne une\nLigne deux");
    expect(texteBrut(lireTexteRiche(valeur))).toBe("Ligne une\nLigne deux");
  });
});
