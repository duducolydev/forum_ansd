import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { ArrowLeft, Download, Mails } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { resolveLocaleValue } from "@/modules/content/service";
import { trouverParSlug, urlImage } from "@/modules/newsletters/service";
import { EnteteSection } from "@/components/site/entete-section";
import { TexteRiche } from "@/components/site/texte-riche";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LienSite } from "@/components/site/bouton-site";

export const dynamic = "force-dynamic";

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Africa/Dakar",
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const edition = await getActiveEdition();
  const newsletter = await trouverParSlug(edition.id, slug);
  return newsletter ? { title: newsletter.titleFr, description: newsletter.excerptFr } : {};
}

/**
 * Texte intégral d'une newsletter (§34).
 *
 * Les images du corps sont résolues par leur **rang** : le document n'en porte
 * jamais le chemin, et c'est le serveur qui fabrique l'URL. Le PDF se produit à
 * la demande, sur la même donnée — ce qui est lu ici est ce qui est téléchargé.
 */
export default async function NewsletterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const en = locale === "en";
  const edition = await getActiveEdition();

  const newsletter = await trouverParSlug(edition.id, slug);
  // Une newsletter en préparation n'existe pas pour le public : 404, et non un
  // message d'accès refusé qui confirmerait qu'elle existe.
  if (!newsletter?.isPublished) notFound();

  const titre = resolveLocaleValue(newsletter.titleFr, newsletter.titleEn, locale);
  const corps = locale === "en" && newsletter.bodyEn ? newsletter.bodyEn : newsletter.bodyFr;

  return (
    <>
      <BandeauPage largeur="moyen">
        <EnteteSection bandeau niveau="h1" titre={titre} icone={Mails} />
      </BandeauPage>

      <CorpsPage largeur="moyen">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/newsletters" className="text-link inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft aria-hidden size={15} />
            {en ? "All newsletters" : "Toutes les newsletters"}
          </Link>
          {newsletter.publishedAt && (
            <span className="text-text-3 text-sm">{dateLongue.format(newsletter.publishedAt)}</span>
          )}
        </div>

        <p className="text-text-2 mb-8 text-lg leading-relaxed">
          {resolveLocaleValue(newsletter.excerptFr, newsletter.excerptEn, locale)}
        </p>

        <TexteRiche
          valeur={corps}
          className="text-text leading-relaxed"
          urlImage={(cle) => urlImage(newsletter.id, cle)}
        />

        <div className="border-border mt-10 border-t pt-6">
          <LienSite href={`/api/v1/newsletters/${newsletter.id}/pdf`} icone={Download}>
            {en ? "Download as PDF" : "Télécharger en PDF"}
          </LienSite>
        </div>
      </CorpsPage>
    </>
  );
}
