import type { Metadata } from "next";
import { Sora, Inter, Outfit, Space_Grotesk, Source_Sans_3, IBM_Plex_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { headers } from "next/headers";
import { getServerTheme } from "@/lib/theme";
import { parametresPourGabarit } from "@/modules/settings/service";
import { cssDuTheme } from "@/modules/settings/theme-css";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/*
 * Polices du site public (brief « Constellation », 28 septembre 2026) : Outfit
 * pour les titres et le texte, Space Grotesk pour les dates et les étiquettes.
 * Elles ne remplacent Sora et Inter que sous `.site-public` (constellation.css)
 * : le BackOffice garde les siennes.
 */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

/*
 * Polices proposées au paramétrage (§8.3). `preload: false` : seule celle qui
 * est réellement choisie voit sa classe appliquée, et le navigateur ne
 * télécharge donc que celle-là. Sans ce réglage, chaque visiteur paierait le
 * préchargement de trois familles inutilisées.
 */
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

const ibmPlex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

/** « Système » n'a pas de classe : c'est la pile du poste, sans téléchargement. */
const CLASSES_POLICE: Record<string, string> = {
  inter: inter.variable,
  systeme: "",
  "source-sans": sourceSans.variable,
  "ibm-plex": ibmPlex.variable,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_BASE_URL ?? "http://localhost:3000"),
  title: {
    default: "Forum international sur les données — ANSD",
    template: "%s — Forum international sur les données",
  },
  description:
    "Portail du Forum international sur les données de l'ANSD, 23–25 novembre 2026, Dakar.",
  openGraph: {
    type: "website",
    siteName: "Forum international sur les données — ANSD",
    locale: "fr_FR",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const theme = await getServerTheme();
  const parametres = await parametresPourGabarit();

  const classePolice = CLASSES_POLICE[parametres.theme.police] ?? inter.variable;
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      data-theme={theme ?? undefined}
      // « Animations : aucune » (§8.3) coupe aussi les animations en JavaScript,
      // qui lisent cet attribut comme un `prefers-reduced-motion`.
      data-animations={parametres.theme.animation}
      // `data-motion` est posé par le script ci-dessous, avant l'hydratation.
      suppressHydrationWarning
    >
      <head>
        {/*
          Animations autorisées ? La réponse est posée sur `<html>` avant le
          premier affichage : les blocs animés partent masqués d'emblée, au lieu
          d'apparaître, disparaître puis réapparaître à l'hydratation. Sans
          JavaScript, le script ne tourne pas et tout reste visible.
        */}
        <script
          nonce={nonce}
          // Le navigateur masque la valeur du nonce une fois lu (sécurité) : le
          // client voit un attribut vide, React signalerait un écart à tort.
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&d.getAttribute("data-animations")!=="aucune")d.setAttribute("data-motion","")}catch(e){}})();`,
          }}
        />
        {/*
          Apparence de l'édition, injectée avant le premier rendu pour éviter
          le clignotement d'une page repeinte après coup. La CSP autorise les
          styles en ligne (`style-src 'self' 'unsafe-inline'`), ce que Next
          impose de toute façon pour ses styles calculés.
        */}
        <style id="theme-edition">{cssDuTheme(parametres.theme)}</style>
      </head>
      <body
        className={`${sora.variable} ${outfit.variable} ${spaceGrotesk.variable} ${classePolice} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
