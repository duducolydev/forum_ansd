import localFont from "next/font/local";

/**
 * Les polices de l'interface, **embarquées** (22 novembre 2026).
 *
 * ## Pourquoi plus de `next/font/google`
 *
 * `next/font/google` ne télécharge pas les polices chez le visiteur : il les
 * récupère **à la construction** et les sert ensuite depuis notre domaine
 * (c'est ce qu'exige le §7 du brief, qui proscrit les appels tiers). Mais cette
 * récupération fait du build un appel réseau sortant vers Google, et le serveur
 * de l'ANSD sort par un Fortinet : le 22 novembre, le déploiement a échoué sur
 * `TypeError: Cannot read properties of null (reading '1')`, c'est-à-dire sur
 * l'extension manquante des URL trouvées dans la feuille de style reçue — une
 * réponse qui n'était pas celle de Google. Veille de l'ouverture du Forum, et
 * rien dans notre code n'avait changé.
 *
 * Les fichiers sont donc dans le dépôt (`src/fonts/ui/`, 272 Ko pour six
 * familles) et `next/font/local` les traite exactement comme avant : mêmes
 * variables CSS, même repli métrique, même service depuis notre domaine. Le
 * build ne sort plus du réseau pour se terminer — il ne dépend plus que de ce
 * qui est versionné.
 *
 * ## Ce que les fichiers contiennent
 *
 * Les **variables** de chaque famille (un seul fichier par famille, toute la
 * plage de graisses), sous-ensemble **latin**, tels que Google les sert. D'où
 * les `weight` en plage — « 100 900 » et non une graisse à la fois — et
 * l'`unicode-range` recopié : sans lui, le navigateur n'irait plus chercher sa
 * police système pour un caractère absent du latin, il afficherait un carré.
 *
 * Chaque famille est sous SIL Open Font License 1.1 ; le texte accompagne les
 * fichiers (`src/fonts/ui/OFL-*.txt`), comme le prévoit la licence.
 *
 * ## Pourquoi un module à part
 *
 * `next/font` est transformé à la compilation : ses arguments doivent être des
 * littéraux, et aucune fonction d'aide ne peut les factoriser — c'est aussi
 * pourquoi l'`unicode-range` du latin est réécrit six fois au lieu d'être posé
 * dans une constante. Six déclarations presque identiques encombraient le
 * gabarit racine, qui a d'autres choses à dire.
 */

export const sora = localFont({
  src: "../fonts/ui/sora-latin-variable.woff2",
  variable: "--font-sora",
  weight: "100 800",
  style: "normal",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

export const inter = localFont({
  src: "../fonts/ui/inter-latin-variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

/*
 * Polices du site public (brief « Constellation », 28 septembre 2026) : Outfit
 * pour les titres et le texte, Space Grotesk pour les dates et les étiquettes.
 * Elles ne remplacent Sora et Inter que sous `.site-public`
 * (constellation.css) : le BackOffice garde les siennes.
 */
export const outfit = localFont({
  src: "../fonts/ui/outfit-latin-variable.woff2",
  variable: "--font-outfit",
  weight: "100 900",
  style: "normal",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

export const spaceGrotesk = localFont({
  src: "../fonts/ui/space-grotesk-latin-variable.woff2",
  variable: "--font-grotesk",
  weight: "300 700",
  style: "normal",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

/*
 * Polices proposées au paramétrage (§8.3). `preload: false` : seule celle qui
 * est réellement choisie voit sa classe appliquée, et le navigateur ne
 * télécharge donc que celle-là. Sans ce réglage, chaque visiteur paierait le
 * préchargement de trois familles inutilisées.
 */
export const sourceSans = localFont({
  src: "../fonts/ui/source-sans-3-latin-variable.woff2",
  variable: "--font-source-sans",
  weight: "200 900",
  style: "normal",
  display: "swap",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

export const ibmPlex = localFont({
  src: "../fonts/ui/ibm-plex-sans-latin-variable.woff2",
  variable: "--font-ibm-plex",
  weight: "100 700",
  style: "normal",
  display: "swap",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

/** « Système » n'a pas de classe : c'est la pile du poste, sans téléchargement. */
export const CLASSES_POLICE: Record<string, string> = {
  inter: inter.variable,
  systeme: "",
  "source-sans": sourceSans.variable,
  "ibm-plex": ibmPlex.variable,
};
