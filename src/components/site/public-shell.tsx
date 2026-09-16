import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Ticker } from "./ticker";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export async function PublicShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("nav");

  return (
    <>
      {/*
       * Lien d'évitement (WCAG 2.4.1). L'en-tête colle en haut de page et porte
       * jusqu'à une douzaine de liens : sans ce raccourci, atteindre le contenu
       * au clavier demande de les traverser tous, sur chaque page.
       *
       * Invisible tant qu'il n'a pas le focus, puis posé au-dessus du bandeau
       * défilant, qui monte à z-50.
       */}
      <a
        href="#contenu"
        className="bg-primary text-primary-text focus:ring-ansd-or sr-only rounded-b-lg px-4 py-2.5 text-sm font-semibold focus:not-sr-only focus:absolute focus:top-0 focus:left-4 focus:z-[60] focus:ring-2"
      >
        {t("skipToContent")}
      </a>
      <Ticker />
      <SiteHeader />
      <main id="contenu">{children}</main>
      <SiteFooter />
    </>
  );
}
