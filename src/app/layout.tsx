import type { Metadata } from "next";
import { Sora, Inter, Source_Sans_3, IBM_Plex_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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

  return (
    <html lang={locale} data-theme={theme ?? undefined}>
      <head>
        {/*
          Apparence de l'édition, injectée avant le premier rendu pour éviter
          le clignotement d'une page repeinte après coup. La CSP autorise les
          styles en ligne (`style-src 'self' 'unsafe-inline'`), ce que Next
          impose de toute façon pour ses styles calculés.
        */}
        <style id="theme-edition">{cssDuTheme(parametres.theme)}</style>
      </head>
      <body className={`${sora.variable} ${classePolice} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
