import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Ticket, UserPlus } from "lucide-react";
import { getServerTheme } from "@/lib/theme";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav } from "./mobile-nav";
import { NavDropdown } from "./nav-dropdown";
import { NAV_ENTRIES, isGroup } from "./nav-items";

export type ResolvedNavEntry =
  | { kind: "link"; href: string; label: string }
  | { kind: "group"; label: string; children: { href: string; label: string }[] };

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
    <header className="border-border bg-bg/90 sticky top-0 z-50 border-b backdrop-blur-md">
      {/* Le regroupement thématique du menu ramène la barre à cinq entrées, ce
          qui laisse la place à la marque complète dès xl. En dessous, seule la
          pastille reste : le bloc de texte est incompressible et le tronquer
          donnait un résultat illisible. */}
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-3 px-6">
        {/* Nom accessible explicite : en dessous de 2xl le libellé textuel est masqué
            et il ne reste que la pastille, décorative — le lien devenait alors muet
            pour un lecteur d'écran. */}
        <Link
          href="/"
          aria-label="Forum international sur les données — accueil"
          className="flex shrink-0 items-center gap-3"
        >
          <span
            aria-hidden
            className="bg-ansd-bleu-nuit grid h-10 w-10 grid-cols-3 items-end gap-[3px] rounded-[10px] p-[5px]"
          >
            <i className="block h-[40%] rounded-sm bg-[#7FB3E6]" />
            <i className="bg-ansd-vert-vif block h-[70%] rounded-sm" />
            <i className="block h-full rounded-sm bg-white" />
          </span>
          <span className="hidden leading-tight xl:block">
            <b className="font-display text-heading block text-[0.95rem]">
              Forum international sur les données
            </b>
            <small className="text-text-3 block text-[0.72rem]">
              ANSD · Dakar · 23–25 novembre 2026
            </small>
          </span>
        </Link>

        <nav className="hidden shrink-0 items-center gap-0.5 lg:flex" aria-label={t("menu")}>
          {entries.map((entry) =>
            entry.kind === "group" ? (
              <NavDropdown key={entry.label} label={entry.label} links={entry.children} />
            ) : (
              <Link
                key={entry.href}
                href={entry.href}
                className="text-text-2 hover:bg-blue-soft hover:text-blue-text transition-tout rounded-lg px-2 py-2 text-sm font-medium whitespace-nowrap"
              >
                {entry.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <LocaleSwitcher />
          <ThemeToggle initialTheme={theme} />
          <Link
            href="/mon-espace"
            className="border-border bg-surface text-heading hover:border-link transition-tout hidden items-center gap-2 rounded-[10px] border px-3 py-2 text-[0.84rem] font-semibold whitespace-nowrap hover:-translate-y-0.5 hover:shadow-md xl:inline-flex"
          >
            <Ticket aria-hidden size={15} strokeWidth={2.2} />
            {t("myRegistrations")}
          </Link>
          <Link
            href="/inscription"
            className="bg-primary text-primary-text hover:bg-primary-hover transition-tout inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[0.84rem] font-semibold whitespace-nowrap shadow-sm hover:-translate-y-0.5 hover:shadow-lg"
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
