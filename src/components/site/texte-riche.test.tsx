import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TexteRiche } from "./texte-riche";

/**
 * Affichage du texte mis en forme, vérifié sur le balisage produit.
 *
 * C'est ici que se joue la sécurité de la fonctionnalité : le document stocké
 * est nettoyé, mais la dernière barrière est que rien de ce qui a été saisi ne
 * devienne jamais du HTML.
 */

const doc = (content: unknown[]) => JSON.stringify({ type: "doc", content });
const rendre = (valeur: string) => renderToStaticMarkup(<TexteRiche valeur={valeur} />);

describe("affichage du texte mis en forme", () => {
  it("rend gras, italique, souligné et saut de ligne en balises sémantiques", () => {
    const html = rendre(
      doc([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "gras", marks: [{ type: "bold" }] },
            { type: "hardBreak" },
            { type: "text", text: "italique", marks: [{ type: "italic" }] },
            { type: "text", text: "souligné", marks: [{ type: "underline" }] },
          ],
        },
      ]),
    );
    expect(html).toContain("<strong>gras</strong>");
    expect(html).toContain("<br/>");
    expect(html).toContain("<em>italique</em>");
    expect(html).toContain("<u>souligné</u>");
  });

  it("échappe le texte : une balise tapée dans l'éditeur reste du texte", () => {
    const html = rendre(
      doc([
        {
          type: "paragraph",
          content: [
            { type: "text", text: '<img src=x onerror="alert(1)"><script>alert(2)</script>' },
          ],
        },
      ]),
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("n'écrit jamais un lien refusé, mais garde son texte", () => {
    const html = rendre(
      doc([
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
      ]),
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a");
    expect(html).toContain("cliquez");
  });

  it("ouvre un lien externe dans un nouvel onglet, sans accès à la page d'origine", () => {
    const html = rendre(
      doc([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "ANSD",
              marks: [{ type: "link", attrs: { href: "https://www.ansd.sn" } }],
            },
          ],
        },
      ]),
    );
    expect(html).toContain('href="https://www.ansd.sn"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("garde un lien interne dans l'onglet courant", () => {
    const html = rendre(
      doc([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "programme",
              marks: [{ type: "link", attrs: { href: "/programme" } }],
            },
          ],
        },
      ]),
    );
    expect(html).toContain('href="/programme"');
    expect(html).not.toContain("target=");
  });

  it("rend les listes à puces et numérotées", () => {
    const html = rendre(
      doc([
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Un" }] }],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Deux" }] }],
            },
          ],
        },
      ]),
    );
    expect(html).toMatch(/<ul[^>]*><li><p>Un<\/p><\/li><\/ul>/);
    expect(html).toMatch(/<ol[^>]*><li><p>Deux<\/p><\/li><\/ol>/);
  });

  it("n'affiche rien pour un champ vide", () => {
    expect(rendre("")).toBe("");
  });

  it("affiche un texte brut ancien en paragraphes, sans perdre ses retours à la ligne", () => {
    expect(rendre("Première\nligne\n\nSecond paragraphe")).toContain(
      "<p>Première<br/>ligne</p><p>Second paragraphe</p>",
    );
  });
});
