import { getLocale } from "next-intl/server";
import { Scale } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { getContentText } from "@/modules/content/service";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { EnteteSection } from "@/components/site/entete-section";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mentions légales",
  description:
    "Éditeur, hébergeur et conditions d'utilisation du portail du Forum international sur les données.",
};

/** Éditeur, hébergeur, conditions d'utilisation. Texte éditable en BackOffice. */
export default async function LegalNoticePage() {
  const locale = await getLocale();
  const edition = await getActiveEdition();
  const body = await getContentText(edition.id, "legal.terms", locale as "fr" | "en");

  return (
    <>
      <BandeauPage largeur="etroit">
        <EnteteSection
          marge={false}
          niveau="h1"
          surtitre="Le portail"
          titre="Mentions légales"
          icone={Scale}
          description="Éditeur, hébergeur et conditions d'utilisation."
        />
      </BandeauPage>

      <CorpsPage largeur="etroit">
        {body ? (
          <div className="text-text-2 text-lg leading-relaxed whitespace-pre-line">{body}</div>
        ) : (
          <p className="border-border bg-surface text-text-3 rounded-xl border p-6">
            Le texte n&apos;a pas encore été renseigné. Il se saisit dans le BackOffice, rubrique
            Contenus.
          </p>
        )}
      </CorpsPage>
    </>
  );
}
