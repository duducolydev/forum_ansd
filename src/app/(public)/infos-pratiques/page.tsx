import { getLocale, getTranslations } from "next-intl/server";
import {
  Bed,
  Building2,
  BusFront,
  Mail,
  PlaneLanding,
  StampIcon,
  type LucideIcon,
} from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { getContentText } from "@/modules/content/service";
import { EnteteSection } from "@/components/site/entete-section";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { Reveal } from "@/components/site/reveal";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("practicalInfo") };
}

/**
 * Chaque rubrique porte son icône : sur une grille de six encarts au texte
 * dense, c'est le repère qui permet de retrouver « Visas » ou « Transports »
 * d'un coup d'œil, sans relire les six intitulés.
 */
const CARDS: { key: string; labelFr: string; labelEn: string; icone: LucideIcon; ton: string }[] = [
  {
    key: "practical.venue",
    labelFr: "Lieu",
    labelEn: "Venue",
    icone: Building2,
    ton: "bg-blue-soft text-blue-text",
  },
  {
    key: "practical.arrival",
    labelFr: "Arrivée",
    labelEn: "Arrival",
    icone: PlaneLanding,
    ton: "bg-accent-soft text-accent-text",
  },
  {
    key: "practical.accommodation",
    labelFr: "Hébergement",
    labelEn: "Accommodation",
    icone: Bed,
    ton: "bg-gold-soft text-gold-text",
  },
  {
    key: "practical.visa",
    labelFr: "Visas",
    labelEn: "Visas",
    icone: StampIcon,
    ton: "bg-warn-soft text-warn-text",
  },
  {
    key: "practical.transport",
    labelFr: "Transports",
    labelEn: "Transport",
    icone: BusFront,
    ton: "bg-blue-soft text-blue-text",
  },
  {
    key: "practical.contacts",
    labelFr: "Contacts",
    labelEn: "Contacts",
    icone: Mail,
    ton: "bg-accent-soft text-accent-text",
  },
];

export default async function PracticalInfoPage() {
  const t = await getTranslations("nav");
  const locale = (await getLocale()) as "fr" | "en";
  const edition = await getActiveEdition();

  const values = await Promise.all(
    CARDS.map((card) => getContentText(edition.id, card.key, locale)),
  );

  return (
    <>
      <BandeauPage>
        <EnteteSection
          marge={false}
          niveau="h1"
          surtitre={locale === "en" ? "Before you come" : "Avant de venir"}
          titre={t("practicalInfo")}
          description={`${edition.venue} · ${edition.city}`}
        />
      </BandeauPage>

      <CorpsPage>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CARDS.map((card, index) => {
            const Icone = card.icone;
            return (
              <Reveal key={card.key} delai={index * 60} className="h-full">
                <div className="border-border bg-surface carte-relief h-full rounded-xl border p-5.5">
                  <span className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${card.ton}`}>
                    <Icone aria-hidden size={19} strokeWidth={2.2} />
                  </span>
                  {/* `h2` : la page n'a qu'un `h1`, sauter au `h3` désoriente la
                      navigation par titres. */}
                  <h2 className="text-heading font-display mb-1.5 text-base font-semibold">
                    {locale === "en" ? card.labelEn : card.labelFr}
                  </h2>
                  <p className="text-text-2 text-sm leading-relaxed whitespace-pre-line">
                    {values[index] || "—"}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </CorpsPage>
    </>
  );
}
