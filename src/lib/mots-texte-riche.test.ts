import { describe, expect, it } from "vitest";
import { motsDeTexteRiche } from "./mots-texte-riche";
import { graineDe } from "@/components/home/NewsCanvas";

const doc = (contenu: unknown[]) => JSON.stringify({ type: "doc", content: contenu });

describe("texte révélé mot à mot", () => {
  it("fait des mots en gras ou en italique les mots clés", () => {
    const paragraphes = motsDeTexteRiche(
      doc([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Une initiative de l'" },
            { type: "text", text: "ANSD", marks: [{ type: "bold" }] },
            { type: "text", text: " sur la " },
            { type: "text", text: "production", marks: [{ type: "italic" }] },
          ],
        },
      ]),
    );
    expect(paragraphes).toHaveLength(1);
    const cles = paragraphes[0]!.filter((mot) => mot.cle).map((mot) => mot.mot);
    expect(cles).toEqual(["ANSD", "production"]);
  });

  it("garde les liens, mot par mot", () => {
    const [mots] = motsDeTexteRiche(
      doc([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "voir le programme",
              marks: [{ type: "link", attrs: { href: "/programme" } }],
            },
          ],
        },
      ]),
    );
    expect(mots!.every((mot) => mot.lien === "/programme")).toBe(true);
  });

  it("aplatit les listes en paragraphes", () => {
    const paragraphes = motsDeTexteRiche(
      doc([
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Produire" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Partager" }] }],
            },
          ],
        },
      ]),
    );
    expect(paragraphes.map((p) => p.map((m) => m.mot).join(" "))).toEqual(["Produire", "Partager"]);
  });
});

describe("visuel génératif d'une actualité", () => {
  it("tire toujours la même graine du même article", () => {
    expect(graineDe("article-1")).toBe(graineDe("article-1"));
    expect(graineDe("article-1")).not.toBe(graineDe("article-2"));
  });
});
