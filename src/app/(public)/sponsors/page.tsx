import { lireLangue, selon } from "@/lib/langue";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, Handshake, Store } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { resolveLocaleValue } from "@/modules/content/service";
import { urlVersionnee } from "@/lib/url-fichier";
import { listerSponsorsPublies } from "@/modules/sponsors/service";
import { tonDuNiveau } from "@/modules/sponsors/palette";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LienSite } from "@/components/site/bouton-site";
import { Reveal } from "@/components/site/reveal";
import { Reveal as RevealMotion } from "@/components/motion/Reveal";
import { PartnersMarquee } from "@/components/home/PartnersMarquee";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("sponsors") };
}

/**
 * Partenaires du Forum (§32).
 *
 * Une seule grille, dans l'ordre décidé en BackOffice. Le site les groupait par
 * niveau, ce qui imposait l'ordre du barème : un partenaire institutionnel
 * décisif passait après trois sponsors d'un échelon supérieur. Le comité décide
 * lui-même de la succession.
 *
 * Le **nom** du niveau (Gold, Silver…) n'est plus affiché (demande du
 * commanditaire, 28 septembre 2026) : seule sa couleur (`palette.ts`) reste
 * sur la carte, en filet et en fond. Le niveau, sa couleur et l'ordre se
 * gèrent en BackOffice.
 */
export default async function SponsorsPage() {
  const t = await getTranslations("nav");
  const tPage = await getTranslations("sponsorsPage");
  const locale = lireLangue(await getLocale());
  const edition = await getActiveEdition();

  const sponsors = await listerSponsorsPublies(edition.id);
  const total = sponsors.length;
  /*
   * Mosaïque (brief « Constellation » §6) : les partenaires du premier niveau
   * — le plus petit rang, en général le sponsor principal — occupent une
   * grande tuile ; les autres, une tuile simple. L'ordre reste celui du
   * BackOffice, et aucun nom de niveau n'est affiché (arbitrage du
   * 28 septembre 2026).
   */
  const premierRang = Math.min(...sponsors.map((sponsor) => sponsor.level.sortOrder));
  const pluriel = total > 1;

  return (
    <>
      <BandeauPage>
        <EnteteSection
          bandeau
          niveau="h1"
          surtitre={selon(locale, {
            fr: "Ils soutiennent le Forum",
            en: "They support the Forum",
            pt: "Apoiam o Fórum",
          })}
          titre={t("sponsors")}
          icone={Handshake}
          description={
            total > 0
              ? selon(locale, {
                  fr: `${total} partenaire${pluriel ? "s" : ""} engagé${pluriel ? "s" : ""} auprès de cette édition.`,
                  en: `${total} partner${pluriel ? "s" : ""} committed to this edition.`,
                  pt: `${total} parceiro${pluriel ? "s" : ""} empenhado${pluriel ? "s" : ""} nesta edição.`,
                })
              : undefined
          }
        />
      </BandeauPage>

      <CorpsPage>
        {total === 0 ? (
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            {tPage("empty")}
          </p>
        ) : (
          <div className="grid grid-flow-dense grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {sponsors.map((sponsor, rang) => {
              const grand = sponsor.level.sortOrder === premierRang;
              const description = resolveLocaleValue(
                sponsor.descriptionFr,
                sponsor.descriptionEn,
                locale,
                sponsor.descriptionPt,
              );
              const ton = tonDuNiveau(sponsor.level);

              const contenu = (
                <>
                  {/* Filet coloré en tête : c'est lui qui porte la couleur du
                      niveau sur toute la largeur, sans teinter le logo. */}
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ton.filet}`}
                  />

                  <span
                    className={`grid flex-1 place-items-center bg-gradient-to-b to-transparent px-5 py-9 ${ton.fond}`}
                  >
                    {sponsor.logoPath ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- servi par une route contrôlée, dimensions variables */
                      <img
                        src={urlVersionnee(
                          `/api/v1/sponsors/${sponsor.id}/logo`,
                          sponsor.logoPath ?? "",
                        )}
                        alt={sponsor.name}
                        style={
                          sponsor.level.logoMaxWidth
                            ? { maxWidth: `${sponsor.level.logoMaxWidth}px` }
                            : undefined
                        }
                        className={`object-contain transition-transform duration-300 group-hover:scale-105 ${grand ? "max-h-32" : "max-h-20"}`}
                      />
                    ) : (
                      <span className="font-display text-heading text-center text-lg leading-snug font-bold text-balance">
                        {sponsor.name}
                      </span>
                    )}
                  </span>

                  {/*
                    Pied de carte : le nom, le stand et le site. Le nom n'est
                    écrit qu'une fois — sans logo, il tient déjà la place de
                    celui-ci au-dessus. Sans rien à y mettre, pas de pied.
                  */}
                  {(sponsor.logoPath || sponsor.standNumber || sponsor.website) && (
                    <span className="border-border block border-t px-4 py-3">
                      {sponsor.logoPath && (
                        <span className="text-heading block truncate text-sm font-semibold">
                          {sponsor.name}
                        </span>
                      )}
                      {sponsor.standNumber && (
                        <span className="text-text-3 mt-0.5 flex items-center gap-1 text-xs">
                          {/*
                           * Le mot « Stand » reste écrit. L'avoir remplacé par
                           * la seule icône laissait une pastille marquée
                           * « A12 », que rien ne rattachait à un emplacement
                           * d'exposition.
                           */}
                          <Store aria-hidden size={11} />
                          Stand {sponsor.standNumber}
                        </span>
                      )}
                      {sponsor.website && (
                        <span className="text-link mt-0.5 flex items-center gap-1 text-xs">
                          <ExternalLink aria-hidden size={11} />
                          {selon(locale, { fr: "Site web", en: "Website", pt: "Sítio web" })}
                        </span>
                      )}
                    </span>
                  )}
                </>
              );

              /*
               * Le cadre est identique avec ou sans lien : une grille où les
               * partenaires sans site occupaient une tuile plus courte se
               * lisait comme une grille cassée.
               */
              const classes =
                "group tuile-projecteur border-border bg-surface relative flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm";

              // Entrée en cascade ; la grande tuile porte l'étendue dans la grille.
              const tuile = sponsor.website ? (
                <a
                  data-projecteur
                  href={sponsor.website}
                  target="_blank"
                  // `noopener` : la page ouverte ne doit pas pouvoir manipuler
                  // celle du Forum via `window.opener`.
                  rel="noopener noreferrer"
                  title={description || sponsor.name}
                  className={`${classes} carte-lien transition-tout hover:-translate-y-1 hover:shadow-lg`}
                >
                  {contenu}
                </a>
              ) : (
                <div data-projecteur title={description || undefined} className={classes}>
                  {contenu}
                </div>
              );

              return (
                <RevealMotion
                  key={sponsor.id}
                  variant="up"
                  delay={Math.min(rang, 12) * 0.06}
                  className={grand ? "sm:col-span-2 sm:row-span-2" : undefined}
                >
                  {tuile}
                </RevealMotion>
              );
            })}
          </div>
        )}

        {total > 0 && (
          <div className="mt-16">
            <PartnersMarquee
              libelle={selon(locale, { fr: "Partenaires", en: "Partners", pt: "Parceiros" })}
              partenaires={sponsors.map((sponsor) => ({
                id: sponsor.id,
                nom: sponsor.name,
                logo: sponsor.logoPath
                  ? urlVersionnee(`/api/v1/sponsors/${sponsor.id}/logo`, sponsor.logoPath)
                  : null,
                site: sponsor.website,
                filet: tonDuNiveau(sponsor.level).filet,
              }))}
            />
          </div>
        )}

        <Reveal delai={150}>
          <div className="filet-haut border-border bg-surface relative mt-14 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border p-7">
            <div className="max-w-[52ch]">
              <h2 className="text-lg">
                {selon(locale, {
                  fr: "Devenir partenaire du Forum",
                  en: "Become a partner of the Forum",
                  pt: "Tornar-se parceiro do Fórum",
                })}
              </h2>
              <p className="text-text-2 mt-1.5 text-sm">
                {selon(locale, {
                  fr: "Stands, visibilité et formules de soutien : le comité d'organisation vous transmet le dossier.",
                  en: "Stands, visibility and support packages: the organising committee will send you the file.",
                  pt: "Stands, visibilidade e modalidades de apoio: o comité organizador envia-lhe o dossiê.",
                })}
              </p>
            </div>
            <LienSite href="/infos-pratiques" ton="principal">
              {selon(locale, {
                fr: "Contacter le comité",
                en: "Contact the committee",
                pt: "Contactar o comité",
              })}
            </LienSite>
          </div>
        </Reveal>
      </CorpsPage>
    </>
  );
}
