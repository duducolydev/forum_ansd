"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { NAV_ENTRIES, isGroup } from "./nav-items";

/**
 * Fil d'Ariane des pages intérieures (brief « Constellation » §6).
 *
 * Déduit de l'adresse et de la navigation du site : « Accueil › Le Forum ›
 * Programme ». Sur une page de détail (`/programme/ouverture`), le dernier
 * maillon est la rubrique, en lien : le titre exact de la page est déjà le
 * `h1` juste en dessous.
 *
 * Les pages hors menu (connexion, mentions légales…) n'affichent que
 * « Accueil › » suivi de rien : pas de maillon inventé.
 */
export function FilAriane() {
  const t = useTranslations("nav");
  const chemin = usePathname() ?? "/";

  let groupe: string | null = null;
  let rubrique: { href: string; label: string } | null = null;
  for (const entree of NAV_ENTRIES) {
    const feuilles = isGroup(entree) ? entree.children : [entree];
    for (const feuille of feuilles) {
      if (feuille.href === "/") continue;
      if (chemin === feuille.href || chemin.startsWith(`${feuille.href}/`)) {
        rubrique = { href: feuille.href, label: t(feuille.key) };
        groupe = isGroup(entree) ? t(entree.key) : null;
      }
    }
  }
  const surLaRubrique = rubrique !== null && chemin === rubrique.href;

  return (
    <nav aria-label="Fil d'Ariane" className="fil-ariane">
      <ol>
        <li>
          <Link href="/">{t("home")}</Link>
        </li>
        {groupe && (
          <li>
            <ChevronRight aria-hidden size={13} />
            <span>{groupe}</span>
          </li>
        )}
        {rubrique && (
          <li>
            <ChevronRight aria-hidden size={13} />
            {surLaRubrique ? (
              <span aria-current="page">{rubrique.label}</span>
            ) : (
              <Link href={rubrique.href}>{rubrique.label}</Link>
            )}
          </li>
        )}
      </ol>
    </nav>
  );
}
