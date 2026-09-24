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
import { RevealListe } from "@/components/site/reveal-liste";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("sponsors") };
}

/**
 * Partenaires du Forum (§32).
 *
 * Une seule grille, dans l'ordre décidé en BackOffice. Le site les groupait par
 * niveau, ce qui imposait l'ordre du barème : un partenaire institutionnel
 * décisif passait après trois sponsors d'un échelon supérieur. Le niveau
 * redevient une mention sur la carte, en bas à droite, et le comité décide
 * lui-même de la succession.
 *
 * La couleur vient du rang du niveau (`palette.ts`) : elle distingue les
 * échelons d'un coup d'œil sans réintroduire le groupement, et reste un rappel
 * — la pastille porte le nom du niveau, la couleur ne le dit jamais seule.
 */
export default async function SponsorsPage() {
  const t = await getTranslations("nav");
  const tPage = await getTranslations("sponsorsPage");
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const en = locale === "en";
  const edition = await getActiveEdition();

  const sponsors = await listerSponsorsPublies(edition.id);
  const total = sponsors.length;
  const pluriel = total > 1;

  return (
    <>
      <BandeauPage>
        <EnteteSection
          bandeau
          niveau="h1"
          surtitre={en ? "They support the Forum" : "Ils soutiennent le Forum"}
          titre={t("sponsors")}
          icone={Handshake}
          description={
            total > 0
              ? en
                ? `${total} partner${pluriel ? "s" : ""} committed to this edition.`
                : `${total} partenaire${pluriel ? "s" : ""} engagé${pluriel ? "s" : ""} auprès de cette édition.`
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
          <RevealListe className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sponsors.map((sponsor) => {
              const description = resolveLocaleValue(
                sponsor.descriptionFr,
                sponsor.descriptionEn,
                locale,
              );
              const ton = tonDuNiveau(sponsor.level.sortOrder);

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
                        className="max-h-20 object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="font-display text-heading text-center text-lg leading-snug font-bold text-balance">
                        {sponsor.name}
                      </span>
                    )}
                  </span>

                  {/*
                    Pied de carte : le nom à gauche, le niveau en bas à droite.
                    Le nom n'est écrit qu'une fois — sans logo, il tient déjà la
                    place de celui-ci au-dessus.
                  */}
                  <span className="border-border flex items-end justify-between gap-3 border-t px-4 py-3">
                    <span className="min-w-0 flex-1">
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
                          {en ? "Website" : "Site web"}
                        </span>
                      )}
                    </span>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold whitespace-nowrap ${ton.pastille}`}
                    >
                      {sponsor.level.name}
                    </span>
                  </span>
                </>
              );

              /*
               * Le cadre est identique avec ou sans lien : une grille où les
               * partenaires sans site occupaient une tuile plus courte se
               * lisait comme une grille cassée.
               */
              const classes =
                "group border-border bg-surface relative flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm";

              return sponsor.website ? (
                <a
                  key={sponsor.id}
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
                <div key={sponsor.id} title={description || undefined} className={classes}>
                  {contenu}
                </div>
              );
            })}
          </RevealListe>
        )}

        <Reveal delai={150}>
          <div className="filet-haut border-border bg-surface relative mt-14 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border p-7">
            <div className="max-w-[52ch]">
              <h2 className="text-lg">
                {en ? "Become a partner of the Forum" : "Devenir partenaire du Forum"}
              </h2>
              <p className="text-text-2 mt-1.5 text-sm">
                {en
                  ? "Stands, visibility and support packages: the organising committee will send you the file."
                  : "Stands, visibilité et formules de soutien : le comité d'organisation vous transmet le dossier."}
              </p>
            </div>
            <LienSite href="/infos-pratiques" ton="principal">
              {en ? "Contact the committee" : "Contacter le comité"}
            </LienSite>
          </div>
        </Reveal>
      </CorpsPage>
    </>
  );
}
