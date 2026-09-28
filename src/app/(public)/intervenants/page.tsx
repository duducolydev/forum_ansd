import { getLocale, getTranslations } from "next-intl/server";
import { Mic } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import {
  AnnuaireIntervenants,
  type IntervenantAnnuaire,
} from "@/components/home/AnnuaireIntervenants";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("speakers") };
}

/*
 * Les thèmes et les panels viennent des sessions retenues : la page se
 * recalcule à chaque visite, et un rendu figé à la construction servirait la
 * liste d'hier.
 */
export const dynamic = "force-dynamic";

interface Filtres {
  theme?: string;
  pays?: string;
  organisation?: string;
  panel?: string;
}

/**
 * Intervenants du Forum (§31), habillage « Constellation » (brief §6).
 *
 * Un intervenant n'a pas de thème en propre : il tient le sien — et ses
 * panels — des sessions **publiées** auxquelles il est rattaché. Un panel
 * encore en brouillon révélerait par la bande un thème que le comité n'a pas
 * annoncé.
 *
 * Chaque carte est la fiche de l'intervenant : son verso porte la biographie,
 * et l'ancre `#intervenant-…` (lien « Voir le profil » de l'accueil) la
 * présente retournée. Filtres et chargement progressif :
 * `AnnuaireIntervenants`.
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
      sessions: {
        where: { session: { isPublished: true, deletedAt: null } },
        select: { session: { select: { theme: true, titleFr: true, titleEn: true } } },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const unique = (liste: (string | null)[]) =>
    [...new Set(liste.filter((valeur): valeur is string => Boolean(valeur)))].sort((a, b) =>
      a.localeCompare(b, "fr"),
    );

  const intervenants: IntervenantAnnuaire[] = speakers.map((speaker) => ({
    id: speaker.id,
    firstName: speaker.firstName,
    lastName: speaker.lastName,
    jobTitle: speaker.jobTitle,
    organization: speaker.organization,
    country: speaker.country,
    photoPath: speaker.photoPath,
    bio: en ? speaker.bioEn || speaker.bioFr : speaker.bioFr,
    themes: unique(speaker.sessions.map((lien) => lien.session.theme)),
    panels: unique(
      speaker.sessions.map((lien) =>
        en ? lien.session.titleEn || lien.session.titleFr : lien.session.titleFr,
      ),
    ),
  }));

  return (
    <>
      <BandeauPage>
        <EnteteSection
          bandeau
          niveau="h1"
          surtitre={en ? "They speak" : "Ils interviennent"}
          titre={t("speakers")}
          icone={Mic}
        />
      </BandeauPage>

      <CorpsPage>
        {intervenants.length === 0 ? (
          <p className="border-border bg-surface text-text-3 rounded-xl border p-8 text-center">
            {tPage("empty")}
          </p>
        ) : (
          <AnnuaireIntervenants intervenants={intervenants} initial={filtres} en={en} />
        )}
      </CorpsPage>
    </>
  );
}
