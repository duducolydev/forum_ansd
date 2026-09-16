import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, Handshake, Store } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { resolveLocaleValue } from "@/modules/content/service";
import { urlVersionnee } from "@/lib/url-fichier";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LienSite } from "@/components/site/bouton-site";
import { Reveal } from "@/components/site/reveal";
import { RevealListe } from "@/components/site/reveal-liste";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("sponsors") };
}

export default async function SponsorsPage() {
  const t = await getTranslations("nav");
  const tPage = await getTranslations("sponsorsPage");
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const en = locale === "en";
  const edition = await getActiveEdition();

  const levels = await prisma.sponsorLevel.findMany({
    where: { editionId: edition.id },
    orderBy: { sortOrder: "asc" },
    include: {
      sponsors: {
        where: { isPublished: true, deletedAt: null },
        orderBy: { name: "asc" },
        // Projection explicite : `contactName` et `contactEmail` sont des
        // données internes (§5.9) et ne doivent jamais atteindre cette page,
        // même en passant par le HTML rendu côté serveur.
        select: {
          id: true,
          name: true,
          logoPath: true,
          website: true,
          standNumber: true,
          descriptionFr: true,
          descriptionEn: true,
        },
      },
    },
  });

  const niveauxServis = levels.filter((level) => level.sponsors.length > 0);
  const total = niveauxServis.reduce((somme, level) => somme + level.sponsors.length, 0);
  const pluriel = total > 1;

  return (
    <>
      <BandeauPage>
        <EnteteSection
          marge={false}
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
        {niveauxServis.length === 0 ? (
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            {tPage("empty")}
          </p>
        ) : (
          niveauxServis.map((level) => (
            <div key={level.id} className="mb-12 last:mb-0">
              {/* `h2` : la page n'a qu'un `h1` au-dessus, sauter au `h3` désoriente
                  la navigation par titres. Le niveau est sémantique, pas visuel —
                  la taille reste donnée par les classes. */}
              <h2 className="mb-5 flex items-center gap-3 text-base">
                <span className="surtitre">{level.name}</span>
                <span className="text-text-3 border-border rounded-full border px-2 py-0.5 text-xs font-normal">
                  {level.sponsors.length}
                </span>
                <span className="from-border h-px flex-1 bg-gradient-to-r to-transparent" />
              </h2>

              <RevealListe className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {level.sponsors.map((sponsor) => {
                  const description = resolveLocaleValue(
                    sponsor.descriptionFr,
                    sponsor.descriptionEn,
                    locale,
                  );

                  /*
                   * Le nom n'est écrit qu'une fois.
                   *
                   * Avec logo, il va dans le bandeau du bas. Sans logo, il tient
                   * la place du logo et le bandeau ne sert plus qu'au stand et
                   * au lien — s'il n'y a ni l'un ni l'autre, il disparaît, au
                   * lieu de laisser une bande grise vide.
                   */
                  const bandeauUtile = Boolean(
                    sponsor.logoPath || sponsor.standNumber || sponsor.website,
                  );

                  const contenu = (
                    <>
                      <span className="grid flex-1 place-items-center px-4 py-7">
                        {sponsor.logoPath ? (
                          /* eslint-disable-next-line @next/next/no-img-element -- servi par une route contrôlée, dimensions variables */
                          <img
                            src={urlVersionnee(
                              `/api/v1/sponsors/${sponsor.id}/logo`,
                              sponsor.logoPath ?? "",
                            )}
                            alt={sponsor.name}
                            style={
                              level.logoMaxWidth
                                ? { maxWidth: `${level.logoMaxWidth}px` }
                                : undefined
                            }
                            className="max-h-16 object-contain"
                          />
                        ) : (
                          <span className="font-display text-heading titre-carte text-center leading-snug font-bold text-balance">
                            {sponsor.name}
                          </span>
                        )}
                      </span>

                      {bandeauUtile && (
                        <span className="border-border bg-bg-2/60 flex items-center gap-2 border-t px-4 py-2.5">
                          {sponsor.logoPath && (
                            <span className="text-text-2 flex-1 truncate text-xs font-semibold">
                              {sponsor.name}
                            </span>
                          )}
                          {sponsor.standNumber && (
                            <span className="text-accent-text bg-accent-soft inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
                              {/*
                               * Le mot « Stand » reste écrit. L'avoir remplacé
                               * par la seule icône laissait une pastille verte
                               * marquée « A12 », que rien ne rattachait à un
                               * emplacement d'exposition.
                               */}
                              <Store aria-hidden size={11} />
                              Stand {sponsor.standNumber}
                            </span>
                          )}
                          {sponsor.website && (
                            <ExternalLink
                              aria-hidden
                              size={13}
                              className="text-link ml-auto shrink-0"
                            />
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
                    "border-border bg-surface flex h-full flex-col overflow-hidden rounded-xl border";

                  return sponsor.website ? (
                    <a
                      key={sponsor.id}
                      href={sponsor.website}
                      target="_blank"
                      // `noopener` : la page ouverte ne doit pas pouvoir manipuler
                      // celle du Forum via `window.opener`.
                      rel="noopener noreferrer"
                      title={description || sponsor.name}
                      className={`${classes} carte-lien`}
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
            </div>
          ))
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
