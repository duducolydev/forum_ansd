"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu, Ticket, UserPlus, X } from "lucide-react";
import type { Theme } from "@/lib/theme";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import type { ResolvedNavEntry } from "./site-header";

/**
 * Menu mobile. Les groupes sont **dépliés en sections** plutôt que rendus en
 * menus déroulants imbriqués : dans un panneau plein écran, la place ne manque
 * pas, et un second niveau à ouvrir n'ajouterait qu'un clic.
 */
export function MobileNav({
  entries,
  theme,
}: {
  entries: ResolvedNavEntry[];
  theme: Theme | null;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("menu")}
        aria-expanded={open}
        className="transition-tout border-ansd-bleu-nuit/25 text-ansd-bleu-nuit focus-visible:outline-ansd-bleu-nuit grid h-[42px] w-[42px] place-items-center rounded-lg border hover:bg-white/60"
      >
        {open ? <X aria-hidden size={19} /> : <Menu aria-hidden size={19} />}
      </button>
      {open && (
        <nav
          className="border-border bg-bg absolute inset-x-0 top-[72px] flex max-h-[calc(100vh-72px)] flex-col gap-1 overflow-y-auto border-b p-3"
          aria-label={t("menu")}
        >
          {entries.map((entry) =>
            entry.kind === "group" ? (
              <div key={entry.label} className="mt-1.5 first:mt-0">
                <p className="text-text-3 px-3 pt-1 pb-1 text-xs font-semibold tracking-wide uppercase">
                  {entry.label}
                </p>
                {entry.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => setOpen(false)}
                    className="text-text-2 hover:bg-blue-soft hover:text-blue-text transition-tout block rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={() => setOpen(false)}
                className="text-text-2 hover:bg-blue-soft hover:text-blue-text transition-tout rounded-lg px-3 py-2 text-sm font-medium"
              >
                {entry.label}
              </Link>
            ),
          )}

          <div className="border-border mt-2 flex flex-col gap-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <LocaleSwitcher />
              <ThemeToggle initialTheme={theme} />
            </div>
            <Link
              href="/mon-espace"
              onClick={() => setOpen(false)}
              className="border-border bg-surface text-heading hover:border-link transition-tout inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              <Ticket aria-hidden size={15} strokeWidth={2.2} />
              {t("myRegistrations")}
            </Link>
            <Link
              href="/inscription"
              onClick={() => setOpen(false)}
              className="bg-primary text-primary-text hover:bg-primary-hover transition-tout inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm"
            >
              <UserPlus aria-hidden size={15} strokeWidth={2.2} />
              {t("register")}
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
