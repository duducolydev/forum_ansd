import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Mail, MapPin, Phone, Send, ShieldCheck } from "lucide-react";
import { parametresPourGabarit } from "@/modules/settings/service";
import { RESEAUX_LABELS, type Reseau } from "@/modules/settings/schema";
import { IconeReseau } from "./icone-reseau";
import { LienNousEcrire } from "@/modules/contact/components/lien-nous-ecrire";

/**
 * Pied de page (§8.6), habillage « Constellation » (brief §3) : grand titre
 * « Rendez-vous à Dakar. », quatre colonnes, liens soulignés d'or au survol.
 * Collé sous le rideau du contenu (`pied-revele`) quand il tient dans la
 * fenêtre — c'est `EffetsGlobaux` qui en décide.
 *
 * Les coordonnées, les réseaux et les liens supplémentaires viennent des
 * paramètres de l'édition. Les colonnes de navigation, elles, restent tenues
 * par le code : ce sont les pages du portail lui-même, et une colonne qui
 * pointerait vers une page inexistante reproduirait exactement le défaut des
 * quatre 404 du BackOffice.
 */

const LIEN = "pied-lien text-[#b8c9e2] flex w-fit items-center gap-2 py-1 text-sm";

export async function SiteFooter() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("constellation.footer");
  const { piedDePage } = await parametresPourGabarit();

  const reseaux = piedDePage.reseaux.filter((entree) => entree.url.trim().length > 0);

  return (
    <footer className="pied-revele relative bg-[var(--deep)] pt-24 pb-10 text-[#b8c9e2]">
      <div className="mx-auto max-w-[1200px] px-6">
        {/* Titre décoratif : le texte reste lisible (blanc sur bleu nuit,
            dégradé animé sur « Dakar. » seulement). */}
        {/*
         * Logo des 20 ans de l'ANSD en face du titre (29 septembre 2026).
         *
         * Sur grand écran, il est ancré en bas à droite du titre, dans la place
         * que laisse « à Dakar. », plus court que « Rendez-vous » : les deux ne
         * tiennent pas côte à côte dans le flux, le titre occupant déjà les
         * trois quarts de la largeur. Sa largeur (16 vw, 14 rem au plus) reste
         * sous l'espace libre à droite de la première ligne, à toute taille
         * d'écran. Sous 1 024 px, il passe sous le titre.
         */}
        <div className="relative mb-12">
          <p className="pied-titre">
            {tc("seeYou")}
            <br />
            {tc("preposition")} <span>{tc("city")}</span>
          </p>
          <Image
            src="/images/logo-ansd-20-ans.webp"
            alt={tc("anniversaryLogo")}
            width={800}
            height={646}
            unoptimized
            className="mt-8 block h-auto w-[clamp(9rem,42vw,13rem)] drop-shadow-[0_0_28px_rgba(120,170,220,0.25)] lg:absolute lg:right-0 lg:bottom-0 lg:mt-0 lg:w-[clamp(9rem,16vw,14rem)]"
          />
        </div>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <p className="font-bold text-white">{tc("initiative")}</p>
            {piedDePage.organisation && (
              <p className="mt-3 flex max-w-[40ch] items-start gap-2 text-sm">
                <MapPin aria-hidden size={15} className="mt-0.5 shrink-0 opacity-70" />
                <span>
                  {piedDePage.organisation}
                  {piedDePage.adresse ? `, ${piedDePage.adresse}` : ""}
                </span>
              </p>
            )}
            {piedDePage.email && (
              <a href={`mailto:${piedDePage.email}`} className={`${LIEN} mt-2`}>
                <Mail aria-hidden size={15} className="shrink-0 opacity-70" />
                {piedDePage.email}
              </a>
            )}
            {piedDePage.telephone && (
              <a href={`tel:${piedDePage.telephone.replace(/\s/g, "")}`} className={LIEN}>
                <Phone aria-hidden size={15} className="shrink-0 opacity-70" />
                {piedDePage.telephone}
              </a>
            )}
            <LienNousEcrire
              data-magnetic
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-[var(--gold)] hover:bg-white/10"
            >
              <Send aria-hidden size={15} />
              {tc("writeToUs")}
            </LienNousEcrire>
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-white">{t("home")}</h2>
            <ul>
              <li>
                <Link href="/#a-propos" className={LIEN}>
                  {t("about")}
                </Link>
              </li>
              <li>
                <Link href="/programme" className={LIEN}>
                  {t("program")}
                </Link>
              </li>
              <li>
                <Link href="/intervenants" className={LIEN}>
                  {t("speakers")}
                </Link>
              </li>
              <li>
                <Link href="/sponsors" className={LIEN}>
                  {t("sponsors")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-white">{t("register")}</h2>
            <ul>
              <li>
                <Link href="/inscription" className={LIEN}>
                  {t("register")}
                </Link>
              </li>
              <li>
                <Link href="/mon-espace" className={LIEN}>
                  {t("myRegistrations")}
                </Link>
              </li>
              <li>
                <Link href="/verifier" className={LIEN}>
                  {t("verifyBadge")}
                </Link>
              </li>
              <li>
                <Link href="/infos-pratiques" className={LIEN}>
                  {t("practicalInfo")}
                </Link>
              </li>
              {piedDePage.liens.map((lien) => (
                <li key={lien.url}>
                  <Link href={lien.url} className={LIEN}>
                    {lien.libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-white">{tc("follow")}</h2>
            {reseaux.length === 0 ? (
              // Rien plutôt qu'une liste de noms sans lien : trois libellés morts
              // donnaient l'impression d'un site inachevé.
              <p className="text-sm">—</p>
            ) : (
              <ul>
                {reseaux.map((entree) => {
                  return (
                    <li key={entree.reseau}>
                      <a
                        href={entree.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={LIEN}
                      >
                        <IconeReseau
                          reseau={entree.reseau}
                          taille={15}
                          className="shrink-0 opacity-80"
                        />
                        {RESEAUX_LABELS[entree.reseau as Reseau] ?? entree.reseau}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-6 text-sm">
          <span>{piedDePage.mentionCopyright}</span>
          <span className="flex flex-wrap items-center gap-x-4">
            <Link href="/confidentialite" className={LIEN}>
              <ShieldCheck aria-hidden size={14} className="opacity-70" />
              {tc("privacy")}
            </Link>
            <Link href="/mentions-legales" className={LIEN}>
              {tc("legal")}
            </Link>
          </span>
          <span className="police-grotesk tracking-wide">{tc("motto")}</span>
        </div>
      </div>
    </footer>
  );
}
