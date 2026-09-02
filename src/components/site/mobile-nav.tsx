"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Theme } from "@/lib/theme";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";

export function MobileNav({
  links,
  theme,
}: {
  links: { href: string; label: string }[];
  theme: Theme | null;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("menu")}
        aria-expanded={open}
        className="border-border text-text grid h-[42px] w-[42px] place-items-center rounded-lg border"
      >
        ☰
      </button>
      {open && (
        <nav
          className="border-border bg-bg absolute inset-x-0 top-[72px] flex flex-col gap-1 border-b p-3"
          aria-label={t("menu")}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-text-2 hover:bg-blue-soft hover:text-blue-text rounded-lg px-3 py-2 text-sm font-medium"
            >
              {link.label}
            </Link>
          ))}
          <div className="border-border mt-2 flex items-center gap-2 border-t pt-3">
            <LocaleSwitcher />
            <ThemeToggle initialTheme={theme} />
          </div>
        </nav>
      )}
    </div>
  );
}
