"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Home } from "lucide-react";
import { selon } from "@/lib/langue";

/**
 * Fil d'Ariane des pages intérieures (demande du 30 septembre 2026).
 *
 * Calculé depuis l'adresse, avec les libellés du menu : aucune page n'a à le
 * déclarer. Une page de détail (article, séance, album…) transmet seulement
 * son titre, qui devient le dernier maillon. Un segment inconnu — page
 * technique, lien à jeton — masque le fil plutôt que d'afficher un maillon
 * incompréhensible.
 *
 * Les rubriques « Le Forum » et « Infos & services » du menu ne sont pas des
 * pages : elles n'apparaissent pas dans le fil.
 */
const CLES_MENU: Record<string, string> = {
  programme: "program",
  intervenants: "speakers",
  contributions: "contributions",
  "infos-pratiques": "practicalInfo",
  actualites: "news",
  mediatheque: "mediaLibrary",
  newsletters: "newsletters",
  verifier: "verifyBadge",
  sponsors: "sponsors",
  inscription: "register",
  "mon-espace": "myRegistrations",
};

const AUTRES: Record<string, { fr: string; en: string; pt: string }> = {
  confidentialite: {
    fr: "Politique de confidentialité",
    en: "Privacy policy",
    pt: "Política de privacidade",
  },
  "mentions-legales": { fr: "Mentions légales", en: "Legal notice", pt: "Aviso legal" },
  "espace-intervenant": { fr: "Espace intervenant", en: "Speaker space", pt: "Espaço do orador" },
  connexion: { fr: "Connexion", en: "Sign in", pt: "Iniciar sessão" },
};

export function FilAriane({ courant }: { courant?: string }) {
  const chemin = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");

  const segments = chemin.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const maillons: { libelle: string; href: string }[] = [];
  for (const [rang, segment] of segments.entries()) {
    const dernier = rang === segments.length - 1;
    const cle = CLES_MENU[segment];
    const libelle = cle
      ? t(cle)
      : AUTRES[segment]
        ? selon(locale, AUTRES[segment])
        : dernier && courant
          ? courant
          : null;
    if (!libelle) return null;
    maillons.push({ libelle, href: `/${segments.slice(0, rang + 1).join("/")}` });
  }

  return (
    <nav
      aria-label={selon(locale, {
        fr: "Fil d'Ariane",
        en: "Breadcrumb",
        pt: "Trilho de navegação",
      })}
      className="fil-ariane"
    >
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        <li className="flex items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded text-[var(--muted)] hover:text-[var(--title)] hover:underline"
          >
            <Home aria-hidden size={14} />
            {t("home")}
          </Link>
        </li>
        {maillons.map((maillon, rang) => {
          const dernier = rang === maillons.length - 1;
          return (
            <li key={maillon.href} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight
                aria-hidden
                size={14}
                className="shrink-0 text-[var(--muted)] opacity-60"
              />
              {dernier ? (
                <span
                  aria-current="page"
                  className="max-w-[48ch] truncate font-semibold text-[var(--title)]"
                >
                  {maillon.libelle}
                </span>
              ) : (
                <Link
                  href={maillon.href}
                  className="rounded text-[var(--muted)] hover:text-[var(--title)] hover:underline"
                >
                  {maillon.libelle}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
