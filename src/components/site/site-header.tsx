import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getServerTheme } from "@/lib/theme";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav } from "./mobile-nav";

const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/programme", key: "program" },
  { href: "/intervenants", key: "speakers" },
  { href: "/sponsors", key: "sponsors" },
  { href: "/infos-pratiques", key: "practicalInfo" },
  { href: "/verifier", key: "verifyBadge" },
  { href: "/admin", key: "admin" },
] as const;

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const theme = await getServerTheme();

  const links = NAV_ITEMS.map((item) => ({ href: item.href, label: t(item.key) }));

  return (
    <header className="border-border bg-bg/90 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-5 px-6">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="bg-ansd-bleu-nuit grid h-10 w-10 grid-cols-3 items-end gap-[3px] rounded-[10px] p-[5px]"
          >
            <i className="block h-[40%] rounded-sm bg-[#7FB3E6]" />
            <i className="bg-ansd-vert-vif block h-[70%] rounded-sm" />
            <i className="block h-full rounded-sm bg-white" />
          </span>
          <span className="leading-tight">
            <b className="font-display text-heading block text-[0.95rem]">
              Forum international sur les données
            </b>
            <small className="text-text-3 block text-[0.72rem]">
              ANSD · Dakar · 23–25 novembre 2026
            </small>
          </span>
        </Link>

        <nav className="hidden gap-0.5 md:flex" aria-label={t("menu")}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-text-2 hover:bg-blue-soft hover:text-blue-text rounded-lg px-3 py-2 text-sm font-medium"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LocaleSwitcher />
          <ThemeToggle initialTheme={theme} />
          <Link
            href="/mon-espace"
            className="border-border bg-surface text-heading inline-flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[0.84rem] font-semibold"
          >
            {t("myRegistrations")}
          </Link>
          <Link
            href="/inscription"
            className="bg-primary text-primary-text hover:bg-primary-hover inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[0.84rem] font-semibold"
          >
            {t("register")}
          </Link>
        </div>

        <MobileNav links={links} theme={theme} />
      </div>
    </header>
  );
}
