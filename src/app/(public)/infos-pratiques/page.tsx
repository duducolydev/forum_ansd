import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Info } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { getContentText } from "@/modules/content/service";
import { RUBRIQUES, libelle } from "@/modules/hotels/rubriques";
import { EnteteSection } from "@/components/site/entete-section";
import { TexteRiche } from "@/components/site/texte-riche";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { Reveal } from "@/components/site/reveal";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("practicalInfo") };
}

/**
 * Les six rubriques pratiques, chacune menant à sa page de détail (§29).
 *
 * L'encart entier est le lien, et non un « en savoir plus » en bas : sur
 * téléphone, une cible de la taille de la carte se touche sans viser, et rien
 * n'indique mieux qu'une carte est cliquable que le fait qu'elle le soit
 * partout.
 *
 * La liste des rubriques vit dans `modules/hotels/rubriques.ts`, partagée avec
 * les pages de détail : un encart ne peut donc pas mener à une page qui
 * n'existe pas.
 */
export default async function PracticalInfoPage() {
  const t = await getTranslations("nav");
  const locale = (await getLocale()) as "fr" | "en";
  const edition = await getActiveEdition();

  const valeurs = await Promise.all(
    RUBRIQUES.map((rubrique) => getContentText(edition.id, rubrique.cle, locale)),
  );

  return (
    <>
      <BandeauPage>
        <EnteteSection
          bandeau
          niveau="h1"
          surtitre={locale === "en" ? "Before you come" : "Avant de venir"}
          titre={t("practicalInfo")}
          icone={Info}
          description={`${edition.venue} · ${edition.city}`}
        />
      </BandeauPage>

      <CorpsPage>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {RUBRIQUES.map((rubrique, index) => {
            const Icone = rubrique.icone;
            return (
              <Reveal key={rubrique.segment} delai={index * 60} className="h-full">
                <Link
                  href={`/infos-pratiques/${rubrique.segment}`}
                  className="border-border bg-surface carte-relief hover:border-link focus-visible:outline-ansd-or group flex h-full flex-col rounded-xl border p-5.5 transition-colors"
                >
                  <span
                    className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${rubrique.ton}`}
                  >
                    <Icone aria-hidden size={19} strokeWidth={2.2} />
                  </span>
                  {/* `h2` : la page n'a qu'un `h1`, sauter au `h3` désoriente la
                      navigation par titres. */}
                  <h2 className="text-heading font-display mb-1.5 text-base font-semibold">
                    {libelle(rubrique, locale)}
                  </h2>
                  {valeurs[index] ? (
                    <TexteRiche
                      valeur={valeurs[index]}
                      className="text-text-2 text-sm leading-relaxed"
                    />
                  ) : (
                    <p className="text-text-2 text-sm leading-relaxed">—</p>
                  )}
                  <span className="text-link mt-auto flex items-center gap-1.5 pt-3 text-sm font-semibold">
                    {locale === "en" ? "Read more" : "En savoir plus"}
                    <ArrowRight
                      aria-hidden
                      size={15}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </CorpsPage>
    </>
  );
}
