import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Polices du badge (maquette du 26 octobre 2026), en `@font-face` à URI `data:`.
 *
 * La maquette de l'infographe compose le nom, la fonction et le bandeau dans une
 * linéale proche de Roboto (Acumin, police Adobe que sa licence ne permet pas
 * d'installer sur le serveur), et les dates en Baloo Thambi. Roboto et Baloo
 * Thambi 2 sont libres (licence OFL, jointe dans `public/fonts/badge/`).
 *
 * Embarquées dans le HTML plutôt qu'installées : le rendu se fait dans le
 * Chromium de l'image Docker, qui n'a que les polices du système Alpine, et le
 * gabarit ne charge rien par le réseau (`template.ts`). Lues une fois et gardées
 * en mémoire, comme le logo (`logo.ts`) : 500 badges ne doivent pas coûter
 * 1 500 lectures disque des mêmes fichiers.
 */
const DOSSIER = join(process.cwd(), "public", "fonts", "badge");

/** Plages de Google Fonts : le latin, et le latin étendu des noms d'Europe de l'Est ou du Vietnam. */
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_ETENDU =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF";

const POLICES = [
  { famille: "Roboto", graisses: "100 900", fichier: "roboto-latin.woff2", plage: LATIN },
  {
    famille: "Roboto",
    graisses: "100 900",
    fichier: "roboto-latin-ext.woff2",
    plage: LATIN_ETENDU,
  },
  {
    famille: "Baloo Thambi 2",
    graisses: "400 800",
    fichier: "baloo-thambi-2-latin.woff2",
    plage: LATIN,
  },
] as const;

let lecture: Promise<string> | null = null;

async function lire(): Promise<string> {
  const regles = await Promise.all(
    POLICES.map(async (police) => {
      const octets = await readFile(join(DOSSIER, police.fichier));
      return `@font-face { font-family: "${police.famille}"; font-weight: ${police.graisses}; font-display: block; src: url(data:font/woff2;base64,${octets.toString("base64")}) format("woff2"); unicode-range: ${police.plage}; }`;
    }),
  );
  return regles.join("\n");
}

export async function policesBadgeCss(): Promise<string> {
  lecture ??= lire();
  try {
    return await lecture;
  } catch (error) {
    /*
     * Comme pour le logo : un badge composé dans la police du système reste un
     * badge valable. La lecture sera retentée au badge suivant.
     */
    lecture = null;
    console.error("[badge] polices introuvables, badge composé en police système :", error);
    return "";
  }
}
