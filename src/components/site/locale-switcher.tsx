"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setUserLocale } from "@/i18n/locale";
import { locales, type Locale } from "@/i18n/config";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

export function LocaleSwitcher() {
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
      className="border-border flex items-center overflow-hidden rounded-lg border"
      aria-label={t("switchTo", { locale: "" })}
    >
      <Languages aria-hidden size={15} className="text-text-3 ml-2 shrink-0" />
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          disabled={isPending}
          aria-pressed={locale === l}
          className={`transition-tout px-2.5 py-1.5 text-xs font-semibold ${
            locale === l ? "bg-blue-soft text-blue-text" : "text-text-2"
          }`}
        >
          {t(l)}
        </button>
      ))}
    </div>
  );
}
