import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Ticker } from "./ticker";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { EffetsGlobaux } from "@/components/motion/EffetsGlobaux";
import { FenetreContact } from "@/modules/contact/components/fenetre-contact";

export async function PublicShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("nav");
  const locale = await getLocale();

  /*
   * `.site-public` porte la palette et les polices du site public
   * (constellation.css) ; le BackOffice, qui n'a pas ce cadre, garde les
   * siennes. Le contenu vit dans un « rideau » qui glisse au-dessus du pied de
   * page révélé (brief §3).
   */
  return (
    <div className="site-public">
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
      <div className="rideau">
        <Ticker />
        <SiteHeader />
        <main id="contenu">{children}</main>
      </div>
      <SiteFooter />
      <EffetsGlobaux />
      {/* Formulaire « Nous écrire », ouvert depuis l'accueil et le pied de page. */}
      <FenetreContact en={locale === "en"} />
    </div>
  );
}
