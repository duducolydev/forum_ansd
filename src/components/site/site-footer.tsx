import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  AtSign,
  Briefcase,
  Camera,
  CirclePlay,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { parametresPourGabarit } from "@/modules/settings/service";
import { RESEAUX_LABELS, type Reseau } from "@/modules/settings/schema";
import { LogoForum } from "./logo-forum";

/**
 * Pied de page (§8.6, habillage §10).
 *
 * Les coordonnées, les réseaux et les liens supplémentaires viennent des
 * paramètres de l'édition. Les colonnes de navigation, elles, restent tenues
 * par le code : ce sont les pages du portail lui-même, et une colonne qui
 * pointerait vers une page inexistante reproduirait exactement le défaut des
 * quatre 404 du BackOffice.
 */

/**
 * Icône de chaque réseau.
 *
 * lucide a retiré ses pictogrammes de marque en version 1 ; les redessiner de
 * mémoire donnerait des logos approximatifs, ce qui est pire que pas de logo
 * du tout. Chaque réseau reçoit donc une icône qui décrit **le média** — un
 * réseau professionnel, une poignée, une communauté, de la vidéo, de la photo,
 * un site. Le nom du réseau reste écrit à côté : rien ne repose sur l'icône.
 */
const ICONES_RESEAU: Record<Reseau, LucideIcon> = {
  linkedin: Briefcase,
  x: AtSign,
  facebook: Users,
  youtube: CirclePlay,
  instagram: Camera,
  site: Globe,
};

const LIEN =
  "text-dark-panel-muted hover:text-white transition-tout flex w-fit items-center gap-2 py-1 text-sm";

export async function SiteFooter() {
  const t = await getTranslations("nav");
  const { piedDePage } = await parametresPourGabarit();

  const reseaux = piedDePage.reseaux.filter((entree) => entree.url.trim().length > 0);

  return (
    <footer className="border-dark-panel-line bg-dark-panel text-dark-panel-muted relative mt-10 border-t py-14">
      {/* Filet dégradé au ras du bord haut : il rattache le pied de page à la
          charte du site sans poser de texte sur une couleur non vérifiée. */}
      <span
        aria-hidden
        className="from-ansd-bleu-vif to-ansd-vert-vif absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r"
      />

      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          {/* Logo officiel transparent, posé à même le fond, à la demande du
              commanditaire (PLAN.md §20). Il porte le nom du Forum, que son texte
              alternatif restitue. */}
          <div className="mb-4 flex flex-col items-start gap-2">
            <LogoForum alt="Forum international sur les données" taille="h-14" />
            <small>Une initiative de l&apos;ANSD</small>
          </div>

          {piedDePage.organisation && (
            <p className="flex max-w-[40ch] items-start gap-2 text-sm">
              <MapPin aria-hidden size={15} className="mt-0.5 shrink-0 opacity-70" />
              <span>
                {piedDePage.organisation}
                {piedDePage.adresse ? `, ${piedDePage.adresse}` : ""}
              </span>
            </p>
          )}

          {piedDePage.email && (
            <a href={`mailto:${piedDePage.email}`} className={LIEN}>
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
        </div>

        <div>
          <h2 className="font-display mb-3 text-[0.92rem] text-white">{t("home")}</h2>
          <Link href="/#a-propos" className={LIEN}>
            {t("about")}
          </Link>
          <Link href="/programme" className={LIEN}>
            {t("program")}
          </Link>
          <Link href="/intervenants" className={LIEN}>
            {t("speakers")}
          </Link>
          <Link href="/sponsors" className={LIEN}>
            {t("sponsors")}
          </Link>
        </div>

        <div>
          <h2 className="font-display mb-3 text-[0.92rem] text-white">{t("register")}</h2>
          <Link href="/inscription" className={LIEN}>
            {t("register")}
          </Link>
          <Link href="/mon-espace" className={LIEN}>
            {t("myRegistrations")}
          </Link>
          <Link href="/verifier" className={LIEN}>
            {t("verifyBadge")}
          </Link>
          <Link href="/infos-pratiques" className={LIEN}>
            {t("practicalInfo")}
          </Link>
          {piedDePage.liens.map((lien) => (
            <Link key={lien.url} href={lien.url} className={LIEN}>
              {lien.libelle}
            </Link>
          ))}
        </div>

        <div>
          <h2 className="font-display mb-3 text-[0.92rem] text-white">Suivre</h2>
          {reseaux.length === 0 ? (
            // Rien plutôt qu'une liste de noms sans lien : trois libellés morts
            // donnaient l'impression d'un site inachevé.
            <p className="text-sm">—</p>
          ) : (
            reseaux.map((entree) => {
              const Icone = ICONES_RESEAU[entree.reseau as Reseau] ?? Globe;
              return (
                <a
                  key={entree.reseau}
                  href={entree.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LIEN}
                >
                  <Icone aria-hidden size={15} className="shrink-0 opacity-70" />
                  {RESEAUX_LABELS[entree.reseau as Reseau] ?? entree.reseau}
                </a>
              );
            })
          )}
        </div>

        <div className="border-dark-panel-line col-span-full flex flex-wrap justify-between gap-2.5 border-t pt-5 text-sm md:col-span-4">
          <span>{piedDePage.mentionCopyright}</span>
          <span className="flex flex-wrap items-center gap-x-3">
            <Link href="/confidentialite" className={LIEN}>
              <ShieldCheck aria-hidden size={14} className="opacity-70" />
              Politique de confidentialité
            </Link>
            <Link href="/mentions-legales" className={LIEN}>
              Mentions légales
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
