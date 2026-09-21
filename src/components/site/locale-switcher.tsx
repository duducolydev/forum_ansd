"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setUserLocale } from "@/i18n/locale";
import { locales, type Locale } from "@/i18n/config";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

/**
 * `entete` : posé sur la barre de navigation bleu clair (PLAN.md §20) — texte et
 * contour de focus bleu nuit, langue active en pastille bleu nuit. `panneau` :
 * dans le menu mobile.
 */
export function LocaleSwitcher({ variante = "panneau" }: { variante?: "entete" | "panneau" }) {
  const surEntete = variante === "entete";
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setUserLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      className={`flex items-center overflow-hidden rounded-lg border ${
        surEntete ? "border-ansd-bleu-nuit/25" : "border-border"
      }`}
      aria-label={t("switchTo", { locale: "" })}
    >
      <Languages
        aria-hidden
        size={15}
        className={`ml-2 shrink-0 ${surEntete ? "text-ansd-bleu-nuit" : "text-text-3"}`}
      />
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          disabled={isPending}
          aria-pressed={locale === l}
          className={`transition-tout px-2.5 py-1.5 text-xs font-semibold ${
            surEntete
              ? `focus-visible:outline-ansd-bleu-nuit focus-visible:-outline-offset-4 ${
                  locale === l
                    ? "bg-ansd-bleu-nuit text-white"
                    : "text-ansd-bleu-nuit hover:bg-white/60"
                }`
              : locale === l
                ? "bg-blue-soft text-blue-text"
                : "text-text-2"
          }`}
        >
          {t(l)}
        </button>
      ))}
    </div>
  );
}
