"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setServerTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ initialTheme }: { initialTheme: Theme | null }) {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState<Theme | null>(initialTheme);
  const [, startTransition] = useTransition();

  // Pas de cookie explicite : on aligne l'état local sur la préférence système,
  // sans jamais poser l'attribut nous-mêmes (c'est `prefers-color-scheme` dans
  // globals.css qui gouverne tant que l'utilisateur n'a pas choisi).
  useEffect(() => {
    if (theme === null) {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, [theme]);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    startTransition(() => {
      void setServerTheme(next);
    });
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className="border-border bg-surface text-text-2 hover:border-text-3 grid h-[38px] w-[38px] place-items-center rounded-lg border transition-colors"
      aria-label={isDark ? t("toggleToLight") : t("toggleToDark")}
      title={isDark ? t("toggleToLight") : t("toggleToDark")}
    >
      {isDark ? "☀" : "☾"}
    </button>
  );
}
