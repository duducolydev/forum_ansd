import { getLocale, getTranslations } from "next-intl/server";
import { Building2, Mic } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { Reveal } from "@/components/site/reveal";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("speakers") };
}

export default async function SpeakersPage() {
  const t = await getTranslations("nav");
  const tPage = await getTranslations("speakersPage");
  const locale = (await getLocale()) as "fr" | "en";
  const edition = await getActiveEdition();
  const en = locale === "en";

  const speakers = await prisma.speaker.findMany({
    where: { editionId: edition.id, isPublished: true, deletedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

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
        {speakers.length === 0 ? (
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            {tPage("empty")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {speakers.map((speaker, rang) => {
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
