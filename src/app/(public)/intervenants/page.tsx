import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Building2, Check, Mic, Tag } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { Reveal } from "@/components/site/reveal";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("speakers") };
}

/*
 * Les thèmes viennent des sessions retenues : la page se recalcule à chaque
 * filtre, et un rendu figé à la construction servirait la liste d'hier.
 */
export const dynamic = "force-dynamic";

interface Filtres {
  theme?: string;
}

/** Un filtre actif se retire en le rappuyant : la même pastille sert d'aller et de retour. */
function lienFiltre(filtres: Filtres, valeur: string): string {
  if (filtres.theme === valeur) return "/intervenants";
  return `/intervenants?theme=${encodeURIComponent(valeur)}`;
}

/**
 * Intervenants du Forum, filtrables par thème (§31).
 *
 * Un intervenant n'a pas de thème en propre : il tient le sien de la ou des
 * sessions où il intervient. La liste des thèmes est donc calculée à partir
 * des sessions **publiées** auxquelles il est rattaché, et non d'un champ à
 * saisir — qui aurait divergé du programme au premier changement de panel.
 *
 * Conséquence assumée : un intervenant annoncé mais pas encore placé au
 * programme n'a aucun thème, et disparaît dès qu'un filtre est posé. C'est le
 * comportement juste — filtrer par thème, c'est demander qui parle de quoi.
 */
export default async function SpeakersPage({ searchParams }: { searchParams: Promise<Filtres> }) {
  const t = await getTranslations("nav");
  const tPage = await getTranslations("speakersPage");
  const locale = (await getLocale()) as "fr" | "en";
  const edition = await getActiveEdition();
  const en = locale === "en";
  const filtres = await searchParams;

  const speakers = await prisma.speaker.findMany({
    where: { editionId: edition.id, isPublished: true, deletedAt: null },
    include: {
      /*
       * Seules les sessions publiées comptent : un panel encore en brouillon
       * révélerait par la bande un thème que le comité n'a pas annoncé.
       */
      sessions: {
        where: { session: { isPublished: true, deletedAt: null } },
        select: { session: { select: { theme: true } } },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const avecThemes = speakers.map((speaker) => ({
    ...speaker,
    themes: [
      ...new Set(
        speaker.sessions
          .map((lien) => lien.session.theme)
          .filter((theme): theme is string => Boolean(theme)),
      ),
    ].sort((a, b) => a.localeCompare(b, "fr")),
  }));

  const themes = [...new Set(avecThemes.flatMap((speaker) => speaker.themes))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );

  const retenus = filtres.theme
    ? avecThemes.filter((speaker) => speaker.themes.includes(filtres.theme!))
    : avecThemes;

  return (
    <>
      <BandeauPage>
        <EnteteSection
          bandeau
          niveau="h1"
          surtitre={en ? "They speak" : "Ils interviennent"}
          titre={t("speakers")}
          icone={Mic}
          description={
            speakers.length > 0
              ? `${speakers.length} ${en ? "speakers announced" : "intervenants annoncés"}`
              : undefined
          }
        />
      </BandeauPage>

      <CorpsPage>
        {/*
          Le panneau de filtres reprend celui du programme, à l'identique : ce
          sont les mêmes thèmes, et deux présentations différentes du même
          choix obligeraient le visiteur à réapprendre le geste en changeant de
          page.
        */}
        {themes.length > 0 && (
          <div className="border-border bg-surface mb-8 rounded-2xl border p-4">
            <nav
              aria-label={en ? "Themes" : "Thèmes"}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-text-2 flex w-20 shrink-0 items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
                <Tag aria-hidden size={13} />
                {en ? "Themes" : "Thèmes"}
              </span>
              {themes.map((theme) => {
                const actif = filtres.theme === theme;
                return (
                  <Link
                    key={theme}
                    href={lienFiltre(filtres, theme)}
                    aria-current={actif ? "true" : undefined}
                    className={`transition-tout inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm no-underline ${
                      actif
                        ? "border-primary bg-primary text-primary-text shadow-sm"
                        : "border-border bg-surface text-text-2 hover:border-link hover:text-heading hover:-translate-y-0.5 hover:shadow-sm"
                    }`}
                  >
                    {/* Une coche sur le filtre actif : l'état ne repose alors
                        pas sur la seule couleur, que tout le monde ne distingue
                        pas également. */}
                    {actif && <Check aria-hidden size={13} strokeWidth={3} />}
                    {theme}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {speakers.length === 0 ? (
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            {tPage("empty")}
          </p>
        ) : retenus.length === 0 ? (
          /*
            Filtre sans résultat : on le dit, et on offre le retour. Une grille
            vide se lit comme une panne, et rien n'indiquerait qu'il suffit de
            relâcher le filtre.
          */
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            {en
              ? "No speaker announced on this theme yet."
              : "Aucun intervenant annoncé sur ce thème pour l'instant."}{" "}
            <Link href="/intervenants" className="text-link underline">
              {en ? "See all speakers" : "Voir tous les intervenants"}
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {retenus.map((speaker, rang) => {
              const bio = en ? speaker.bioEn : speaker.bioFr;
              return (
                <Reveal key={speaker.id} delai={rang * 55} className="h-full">
                  <div className="border-border bg-surface carte-relief flex h-full flex-col rounded-xl border p-6 text-center">
                    {/* La photo si l'intervenant en a déposé une dans son espace ;
                        les initiales sinon, plutôt qu'un cadre vide. */}
                    {speaker.photoPath ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- servie par une route dédiée, hors optimiseur */
                      <img
                        src={`/api/v1/speakers/${speaker.id}/photo`}
                        alt=""
                        className="ring-border bg-bg-2 mx-auto mb-4 h-24 w-24 rounded-full object-cover ring-2 ring-offset-2 ring-offset-[var(--surface)]"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="from-ansd-bleu-vif to-ansd-vert-vif font-display mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br text-2xl font-bold text-white"
                      >
                        {speaker.firstName[0]}
                        {speaker.lastName[0]}
                      </span>
                    )}

                    {/* `h2` : la page n'a qu'un `h1`, sauter un palier
                        désoriente la navigation par titres. */}
                    <h2 className="font-display text-heading text-base leading-snug">
                      {speaker.firstName} {speaker.lastName}
                    </h2>

                    {speaker.jobTitle && (
                      <span className="text-text-2 mt-1 block text-sm">{speaker.jobTitle}</span>
                    )}
                    {speaker.organization && (
                      <span className="text-text-3 mt-1.5 flex items-center justify-center gap-1.5 text-xs">
                        <Building2 aria-hidden size={12} />
                        {speaker.organization}
                        {speaker.country ? ` · ${speaker.country}` : ""}
                      </span>
                    )}

                    {/* Les thèmes de l'intervenant, cliquables : depuis une
                        fiche, on cherche souvent qui d'autre parle du même
                        sujet. */}
                    {speaker.themes.length > 0 && (
                      <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                        {speaker.themes.map((theme) => (
                          <li key={theme}>
                            <Link
                              href={lienFiltre(filtres, theme)}
                              className="bg-bg-2 text-text-2 hover:text-heading rounded-full px-2.5 py-1 text-xs no-underline"
                            >
                              {theme}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    {bio && (
                      <p className="border-border text-text-3 mt-4 border-t pt-3 text-left text-xs leading-relaxed">
                        {bio}
                      </p>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </CorpsPage>
    </>
  );
}
