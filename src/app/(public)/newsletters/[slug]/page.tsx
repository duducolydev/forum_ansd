import { lireLangue, localeIntl, selon, traduire } from "@/lib/langue";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { ArrowLeft, Download, Mails } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { resolveLocaleValue } from "@/modules/content/service";
import {
  aUnCorps,
  trouverParSlug,
  urlApercu,
  urlFichier,
  urlImage,
} from "@/modules/newsletters/service";
import { nomFichierPropre, poidsLisible } from "@/modules/newsletters/schema";
import { ApercuPdf } from "@/modules/newsletters/components/apercu-pdf";
import { EnteteSection } from "@/components/site/entete-section";
import { TexteRiche } from "@/components/site/texte-riche";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LienSite } from "@/components/site/bouton-site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const edition = await getActiveEdition();
  const newsletter = await trouverParSlug(edition.id, slug);
  return newsletter ? { title: newsletter.titleFr, description: newsletter.excerptFr } : {};
}

/**
 * Page d'une newsletter (§34) : celle où mène le courriel d'annonce.
 *
 * Depuis le 25 novembre 2026, une newsletter est un fichier de synthèse : la
 * page en donne la description et le bouton de téléchargement. Les premières
 * newsletters, rédigées en texte mis en forme, gardent leur corps ; ses images
 * sont résolues par leur **rang**, et leur PDF se produit à la demande.
 */
export default async function NewsletterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = lireLangue(await getLocale());
  const dateLongue = new Intl.DateTimeFormat(localeIntl(locale), {
    dateStyle: "long",
    timeZone: "Africa/Dakar",
  });
  const edition = await getActiveEdition();

  const newsletter = await trouverParSlug(edition.id, slug);
  // Une newsletter en préparation n'existe pas pour le public : 404, et non un
  // message d'accès refusé qui confirmerait qu'elle existe.
  if (!newsletter?.isPublished) notFound();

  const titre = resolveLocaleValue(
    newsletter.titleFr,
    newsletter.titleEn,
    locale,
    newsletter.titlePt,
  );
  const corps = traduire(locale, {
    fr: newsletter.bodyFr,
    en: newsletter.bodyEn,
    pt: newsletter.bodyPt,
  });
  // L'ancien corps mis en forme ne s'affiche que faute de fichier : dès qu'une
  // synthèse PDF est déposée, c'est elle la newsletter, et le texte d'avant —
  // qui ne se corrige plus depuis le BackOffice — ferait double emploi
  // (26 novembre 2026). Il reste en base, intact.
  const ancienne = !newsletter.filePath && aUnCorps(newsletter);
  const libelleTelecharger = selon(locale, {
    fr: "Télécharger le PDF",
    en: "Download the PDF",
    pt: "Descarregar o PDF",
  });

  return (
    <>
      <BandeauPage largeur="moyen" filCourant={titre}>
        <EnteteSection bandeau niveau="h1" titre={titre} icone={Mails} />
      </BandeauPage>

      <CorpsPage largeur="moyen">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/newsletters" className="text-link inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft aria-hidden size={15} />
            {selon(locale, {
              fr: "Toutes les newsletters",
              en: "All newsletters",
              pt: "Todas as newsletters",
            })}
          </Link>
          {newsletter.publishedAt && (
            <span className="text-text-3 text-sm">{dateLongue.format(newsletter.publishedAt)}</span>
          )}
        </div>

        <p className="text-text-2 mb-8 text-lg leading-relaxed whitespace-pre-line">
          {resolveLocaleValue(
            newsletter.excerptFr,
            newsletter.excerptEn,
            locale,
            newsletter.excerptPt,
          )}
        </p>

        {newsletter.filePath && (
          <ApercuPdf
            urlApercu={urlApercu(newsletter.id)}
            urlTelechargement={urlFichier(newsletter.id)}
            nomFichier={nomFichierPropre(newsletter.fileName, newsletter.titleFr)}
            poids={poidsLisible(newsletter.fileSize, localeIntl(locale))}
            textes={{
              titre: selon(locale, {
                fr: "Aperçu du document",
                en: "Document preview",
                pt: "Pré-visualização do documento",
              }),
              telecharger: selon(locale, { fr: "Télécharger", en: "Download", pt: "Descarregar" }),
              agrandir: selon(locale, { fr: "Plein écran", en: "Full screen", pt: "Ecrã inteiro" }),
              reduire: selon(locale, {
                fr: "Quitter le plein écran",
                en: "Exit full screen",
                pt: "Sair do ecrã inteiro",
              }),
              ouvrir: selon(locale, {
                fr: "Ouvrir dans un onglet",
                en: "Open in a new tab",
                pt: "Abrir num separador",
              }),
              fermer: selon(locale, {
                fr: "Fermer l'aperçu",
                en: "Close preview",
                pt: "Fechar a pré-visualização",
              }),
              afficher: selon(locale, {
                fr: "Afficher l'aperçu",
                en: "Show preview",
                pt: "Mostrar a pré-visualização",
              }),
              mobile: selon(locale, {
                fr: "L'aperçu ne s'affiche pas sur téléphone : téléchargez le fichier pour le lire.",
                en: "The preview is not shown on phones: download the file to read it.",
                pt: "A pré-visualização não aparece no telemóvel: descarregue o ficheiro para o ler.",
              }),
              cadre: titre,
            }}
          />
        )}

        {ancienne && (
          <>
            <TexteRiche
              valeur={corps}
              className="text-text mt-8 leading-relaxed"
              urlImage={(cle) => urlImage(newsletter.id, cle)}
            />
            <div className="border-border mt-10 border-t pt-6">
              <LienSite href={`/api/v1/newsletters/${newsletter.id}/pdf`} icone={Download}>
                {libelleTelecharger}
              </LienSite>
            </div>
          </>
        )}
      </CorpsPage>
    </>
  );
}
