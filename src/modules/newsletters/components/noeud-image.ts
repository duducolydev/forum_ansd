import { Node } from "@tiptap/react";

/**
 * Nœud image de l'éditeur des newsletters (§34).
 *
 * Écrit ici plutôt qu'emprunté à `@tiptap/extension-image` : l'extension
 * officielle stocke une **URL** dans le document, exactement ce que ce projet
 * refuse. Le nœud ci-dessous ne retient qu'un rang dans la liste d'images de la
 * newsletter ; le serveur résout ce rang au rendu, et l'éditeur le résout par
 * l'option `urlBase`. Une URL saisie dans le document deviendrait une adresse
 * arbitraire servie depuis la page publique.
 *
 * Il porte trois attributs que l'extension officielle n'a pas — alignement,
 * largeur et alternative textuelle — qui sont précisément ce que le
 * commanditaire demande de pouvoir régler.
 *
 * L'aperçu dans l'éditeur passe par la même route que le site : ce qu'on voit
 * en écrivant est ce que verra le lecteur.
 */
export interface OptionsImageNewsletter {
  /** Préfixe des URL, sans le rang : `/api/v1/newsletters/<id>/image`. */
  urlBase: string;
}

export const ImageNewsletter = Node.create<OptionsImageNewsletter>({
  name: "image",
  group: "block",
  // Atome : l'image n'a pas de contenu éditable à l'intérieur, et le curseur la
  // traite comme un bloc unique plutôt que comme un conteneur où entrer.
  atom: true,
  draggable: true,

  addOptions() {
    return { urlBase: "" };
  },

  addAttributes() {
    return {
      cle: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute("data-cle") ?? 0),
        renderHTML: (attributes) => ({ "data-cle": String(attributes.cle) }),
      },
      alt: { default: "" },
      alignement: {
        default: "centre",
        parseHTML: (element) => element.getAttribute("data-alignement") ?? "centre",
        renderHTML: (attributes) => ({ "data-alignement": String(attributes.alignement) }),
      },
      largeur: {
        default: 100,
        parseHTML: (element) => Number(element.getAttribute("data-largeur") ?? 100),
        renderHTML: (attributes) => ({ "data-largeur": String(attributes.largeur) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-cle]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const cle = Number(node.attrs.cle ?? 0);
    const alignement = String(node.attrs.alignement ?? "centre");
    const largeur = Number(node.attrs.largeur ?? 100);

    const marge =
      alignement === "gauche"
        ? "margin-right:auto"
        : alignement === "droite"
          ? "margin-left:auto"
          : "margin-left:auto;margin-right:auto";

    return [
      "img",
      {
        ...HTMLAttributes,
        alt: String(node.attrs.alt ?? ""),
        src: `${this.options.urlBase}/${cle}`,
        style: `display:block;height:auto;border-radius:0.5rem;width:${largeur}%;${marge}`,
      },
    ];
  },
});
