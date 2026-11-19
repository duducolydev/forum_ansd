import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ExternalLink, Radio } from "lucide-react";
import { selon, type Langue } from "@/lib/langue";
import { LienExterne } from "@/components/ui/bouton";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { parametresEdition } from "@/modules/settings/service";
import { urlPageVideo } from "@/modules/medias/video";
import { creneauxDiffusion } from "@/modules/direct/service";
import { EcranDirect } from "@/modules/direct/components/ecran-direct";

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: selon(locale, { fr: "En direct", en: "Live", pt: "Em direto" }),
    // La page n'a d'intérêt que pendant trois jours et son contenu change
    // d'heure en heure : rien à indexer, et surtout rien à laisser dans les
    // résultats de recherche une fois le Forum terminé.
    robots: { index: false, follow: true },
  };
}

/*
 * Rendu à chaque requête. La page ne peut pas être mise en cache : son contenu
 * dépend de l'heure qu'il est et du lien que la régie vient de coller. Le
 * client réévalue ensuite l'antenne toutes les dix secondes de son côté.
 */
export const dynamic = "force-dynamic";

/**
 * Retransmission du Forum (19 novembre 2026).
 *
 * Le portail n'héberge aucune vidéo — il n'en a ni la bande passante ni le
 * transcodage, et le débit adaptatif d'une plateforme sert bien mieux un
 * public en 4G. La page intègre donc le lecteur du flux réglé en BackOffice,
 * sous « Paramètres → Live », et prend le relais avec un écran d'attente
 * pendant les pauses et les transitions.
 *
 * Fermée en BackOffice, l'adresse répond 404 plutôt qu'une page vide : tant
 * que rien n'est diffusé, cette page n'existe pas.
 */
export default async function DirectPage() {
  const locale = (await getLocale()) as Langue;
  const { edition, parametres } = await parametresEdition();
  const direct = parametres.direct;

  if (!direct.actif) notFound();

  const creneaux = await creneauxDiffusion(edition.id, locale);
  const pageVideo = direct.video
    ? urlPageVideo(direct.video.fournisseur, direct.video.identifiant)
    : null;

  const titre = selon(locale, { fr: "En direct", en: "Live", pt: "Em direto" });

  return (
    <>
      <BandeauPage>
        <EnteteSection bandeau niveau="h1" titre={titre} icone={Radio} />
      </BandeauPage>

      <CorpsPage>
        <EcranDirect
          video={direct.video}
          mode={direct.mode}
          margeMinutes={direct.margeMinutes}
          creneaux={creneaux}
          messages={direct.messages}
          fond={direct.fond}
          secondesParMessage={direct.secondesParMessage}
          instantServeur={new Date().toISOString()}
          langue={locale}
        />

        <div className="text-text-3 mt-6 flex flex-wrap items-center justify-between gap-4 text-sm">
          <p className="max-w-[60ch]">
            {selon(locale, {
              fr: "Le programme complet des trois journées, avec les intervenants de chaque session, est sur la page",
              en: "The full three-day programme, with the speakers of each session, is on the",
              pt: "O programa completo dos três dias, com os oradores de cada sessão, está na página",
            })}{" "}
            <Link href="/programme" className="text-link">
              {selon(locale, { fr: "Programme", en: "Programme page", pt: "Programa" })}
            </Link>
            .{" "}
            {selon(locale, {
              fr: "Les rediffusions rejoindront la médiathèque après le Forum.",
              en: "Replays will join the media library after the Forum.",
              pt: "As repetições juntar-se-ão à mediateca depois do Fórum.",
            })}
          </p>

          {/*
           * Repli indispensable : si l'intégration est refusée — option
           * « autoriser l'intégration » décochée chez la plateforme, flux
           * restreint, réseau d'entreprise qui filtre les `iframe` — le
           * visiteur doit pouvoir rejoindre la diffusion à sa source plutôt
           * que de rester devant un rectangle noir.
           */}
          {pageVideo && (
            <LienExterne
              href={pageVideo}
              target="_blank"
              rel="noopener noreferrer"
              icone={ExternalLink}
            >
              {selon(locale, {
                fr: "Ouvrir sur la plateforme",
                en: "Open on the platform",
                pt: "Abrir na plataforma",
              })}
            </LienExterne>
          )}
        </div>
      </CorpsPage>
    </>
  );
}
