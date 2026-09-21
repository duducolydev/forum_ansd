import { getLocale } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { getContentText } from "@/modules/content/service";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { EnteteSection } from "@/components/site/entete-section";
import { TexteRiche } from "@/components/site/texte-riche";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Politique de confidentialité",
  description:
    "Traitement des données personnelles collectées par le portail du Forum international sur les données (loi n° 2008-12).",
};

/**
 * Page obligatoire : le formulaire d'inscription recueille un consentement qui
 * y renvoie, et la loi n° 2008-12 impose une information accessible. Le texte
 * est un `ContentBlock`, donc **modifiable en BackOffice** sans redéploiement —
 * une politique de confidentialité figée dans le code finit toujours par être
 * périmée.
 */
export default async function PrivacyPage() {
  const locale = await getLocale();
  const edition = await getActiveEdition();
  const body = await getContentText(edition.id, "legal.privacy", locale as "fr" | "en");

  return (
    <>
      <BandeauPage largeur="etroit">
        <EnteteSection
          bandeau
          niveau="h1"
          surtitre="Vos données"
          titre="Politique de confidentialité"
          icone={ShieldCheck}
          description="Loi n° 2008-12 sur la protection des données à caractère personnel."
        />
      </BandeauPage>

      <CorpsPage largeur="etroit">
        {body ? (
          <TexteRiche valeur={body} className="text-text-2 text-lg leading-relaxed" />
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
