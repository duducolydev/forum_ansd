import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Ticket, UserPlus } from "lucide-react";
import { getServerTheme } from "@/lib/theme";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { LogoForum } from "./logo-forum";
import { MobileNav } from "./mobile-nav";
import { NavDropdown } from "./nav-dropdown";
import { NAV_ENTRIES, isGroup } from "./nav-items";

export type ResolvedNavEntry =
  | { kind: "link"; href: string; label: string }
  | { kind: "group"; label: string; children: { href: string; label: string }[] };

/**
 * Contrôles posés sur la barre de navigation bleu clair (PLAN.md §20).
 *
 * Couleurs fixes et non jetons de thème : le fond de la barre reste clair en
 * thème sombre, pour le logo transparent, et ses textes doivent rester foncés.
 *
 * - **Texte bleu nuit** : 11,52:1 sur l'arrêt le plus foncé (#d9eaf7).
 * - **Contour de focus bleu nuit** : l'or du reste du site ne tient que 2,73:1
 *   sur ce bleu clair, sous le seuil de 3:1.
 */
export const SUR_ENTETE =
  "text-ansd-bleu-nuit hover:bg-white/60 focus-visible:outline-ansd-bleu-nuit transition-tout";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const theme = await getServerTheme();

  const entries: ResolvedNavEntry[] = NAV_ENTRIES.map((entry) =>
    isGroup(entry)
      ? {
          kind: "group",
          label: t(entry.key),
          children: entry.children.map((child) => ({ href: child.href, label: t(child.key) })),
        }
      : { kind: "link", href: entry.href, label: t(entry.key) },
  );

  return (
    <header className="fond-navbar sticky top-0 z-50 shadow-[0_1px_0_rgb(8_44_78/0.12)]">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-3 px-6">
        {/* Le logo officiel porte déjà le nom du Forum : le lien reçoit un nom
            accessible explicite et l'image, décorative ici, un texte vide. */}
        <Link
          href="/"
          aria-label="Forum international sur les données — accueil"
          className="focus-visible:outline-ansd-bleu-nuit shrink-0 rounded-xl"
        >
          <LogoForum alt="" hauteur="h-11" prioritaire />
        </Link>

        <nav className="hidden shrink-0 items-center gap-0.5 lg:flex" aria-label={t("menu")}>
          {entries.map((entry) =>
            entry.kind === "group" ? (
              <NavDropdown key={entry.label} label={entry.label} links={entry.children} />
            ) : (
              <Link
                key={entry.href}
                href={entry.href}
                className={`${SUR_ENTETE} rounded-lg px-2 py-2 text-sm font-medium whitespace-nowrap`}
              >
                {entry.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <LocaleSwitcher variante="entete" />
          <ThemeToggle initialTheme={theme} variante="entete" />
          <Link
            href="/mon-espace"
            className={`${SUR_ENTETE} border-ansd-bleu-nuit/25 hidden items-center gap-2 rounded-[10px] border px-3 py-2 text-[0.84rem] font-semibold whitespace-nowrap hover:-translate-y-0.5 xl:inline-flex`}
          >
            <Ticket aria-hidden size={15} strokeWidth={2.2} />
            {t("myRegistrations")}
          </Link>
          <Link
            href="/inscription"
            className="bg-primary text-primary-text hover:bg-primary-hover transition-tout focus-visible:outline-ansd-bleu-nuit inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[0.84rem] font-semibold whitespace-nowrap shadow-sm hover:-translate-y-0.5 hover:shadow-lg"
          >
            <UserPlus aria-hidden size={15} strokeWidth={2.2} />
            {t("register")}
          </Link>
        </div>

        <MobileNav entries={entries} theme={theme} />
      </div>
    </header>
  );
}
