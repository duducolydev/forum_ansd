import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { headers } from "next/headers";
import { getServerTheme } from "@/lib/theme";
import { parametresPourGabarit } from "@/modules/settings/service";
import { cssDuTheme } from "@/modules/settings/theme-css";
import { CLASSES_POLICE, inter, outfit, sora, spaceGrotesk } from "./polices";
import "./globals.css";

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
