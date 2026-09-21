"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { setServerTheme, type Theme } from "@/lib/theme";

/** `entete` : sur la barre de navigation bleu clair (PLAN.md §20) ; `panneau` : menu mobile. */
export function ThemeToggle({
  initialTheme,
  variante = "panneau",
}: {
  initialTheme: Theme | null;
  variante?: "entete" | "panneau";
}) {
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
      className={`transition-tout grid h-[38px] w-[38px] place-items-center rounded-lg border ${
        variante === "entete"
          ? "border-ansd-bleu-nuit/25 text-ansd-bleu-nuit focus-visible:outline-ansd-bleu-nuit hover:bg-white/60"
          : "border-border bg-surface text-text-2 hover:border-link hover:text-blue-text"
      }`}
      aria-label={isDark ? t("toggleToLight") : t("toggleToDark")}
      title={isDark ? t("toggleToLight") : t("toggleToDark")}
    >
      {isDark ? <Sun aria-hidden size={17} /> : <Moon aria-hidden size={17} />}
    </button>
  );
}
