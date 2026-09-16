import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, FileStack } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { sessionsCapitalisees } from "@/modules/contributions/service";
import { MODELES, type TypeContribution } from "@/modules/contributions/schema";
import { iconeDeType } from "@/modules/contributions/components/bloc-public";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { EnteteSection } from "@/components/site/entete-section";
import { LienSite } from "@/components/site/bouton-site";
import { RevealListe } from "@/components/site/reveal-liste";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("contributions") };
}

const jourLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/**
 * Contributions & Actes (brief §5.10).
 *
 * La page liste les **sessions capitalisées**, pas les contributions une à une :
 * une contribution isolée de sa séance perd son sens, et la compilation des
 * Actes se fera elle aussi session par session.
 *
 * Tant qu'aucune session n'a de contribution publiée, la page le dit sans
 * détour plutôt que d'afficher un cadre vide.
 */
export default async function ContributionsPage() {
  const t = await getTranslations("nav");
  const edition = await getActiveEdition();
  const sessions = await sessionsCapitalisees(edition.id);

  const total = sessions.reduce((somme, session) => somme + session.contributions.length, 0);

  return (
    <>
      <BandeauPage>
        <EnteteSection
          marge={false}
          niveau="h1"
          surtitre="Capitalisation"
          titre={t("contributions")}
          icone={FileStack}
          description={
            total > 0
              ? `${total} contribution${total > 1 ? "s" : ""} publiée${total > 1 ? "s" : ""} sur ${sessions.length} session${sessions.length > 1 ? "s" : ""}.`
              : "Problématiques, synthèses, recommandations, présentations et photos, session par session."
          }
        />
      </BandeauPage>

      <CorpsPage>
        {sessions.length === 0 ? (
          <div className="border-border bg-surface rounded-2xl border p-8">
            <p className="text-text-2">
              Les contributions sont publiées au fil du Forum, puis compilées dans les Actes. Rien
              n&apos;est encore en ligne.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <LienSite href="/programme">Voir le programme</LienSite>
              <LienSite href="/actualites">Lire les actualités</LienSite>
            </div>
          </div>
        ) : (
          <RevealListe className="flex flex-col gap-4">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/programme/${session.slug}`}
                className="border-border bg-surface carte-lien rounded-xl border p-6"
              >
                <span className="text-text-3 text-sm">
                  {jourLong.format(session.day)}
                  {session.theme ? ` · ${session.theme}` : ""}
                </span>
                <h2 className="titre-carte mt-1 text-lg leading-snug">{session.titleFr}</h2>

                <span className="mt-3 flex flex-wrap gap-2">
                  {session.contributions.map((contribution) => {
                    const Icone = iconeDeType(contribution.type as TypeContribution);
                    return (
                      <span
                        key={contribution.id}
                        className="border-border text-text-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
                      >
                        <Icone aria-hidden size={12} className="text-accent-text" />
                        {MODELES[contribution.type as TypeContribution].label}
                      </span>
                    );
                  })}
                </span>

                <span className="text-link mt-4 flex items-center gap-1.5 text-sm font-semibold">
                  Lire la session
                  <ArrowRight aria-hidden size={14} />
                </span>
              </Link>
            ))}
          </RevealListe>
        )}
      </CorpsPage>
    </>
  );
}
