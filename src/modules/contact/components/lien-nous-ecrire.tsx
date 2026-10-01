import type { ComponentProps } from "react";

/*
 * Constantes ici et non dans `fenetre-contact.tsx` : exportée d'un module
 * client, une valeur n'arrive dans un composant serveur que comme référence
 * opaque — l'attribut rendu n'aurait pas été `data-nous-ecrire`.
 */

/** Attribut qui fait d'un lien un déclencheur de la fenêtre « Nous écrire ». */
export const ATTRIBUT_NOUS_ECRIRE = "data-nous-ecrire";

export const HREF_NOUS_ECRIRE = "/infos-pratiques/contacts#ecrire-comite";

/**
 * Déclencheur de la fenêtre « Nous écrire » (`FenetreContact`). Lien simple,
 * utilisable dans un composant serveur : sans JavaScript, il mène au
 * formulaire de la rubrique Contacts.
 *
 * `objet` : pré-remplit le champ Objet (« Devenir partenaire du Forum » depuis
 * la page Partenaires), porté par la valeur de l'attribut.
 */
export function LienNousEcrire({
  objet,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { objet?: string }) {
  return <a href={HREF_NOUS_ECRIRE} {...{ [ATTRIBUT_NOUS_ECRIRE]: objet ?? "" }} {...props} />;
}
