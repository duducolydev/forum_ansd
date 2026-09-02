import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("nav");

  return (
    <footer className="border-dark-panel-line bg-dark-panel text-dark-panel-muted mt-10 border-t py-12">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span
              aria-hidden
              className="bg-ansd-bleu-nuit grid h-10 w-10 grid-cols-3 items-end gap-[3px] rounded-[10px] p-[5px]"
            >
              <i className="block h-[40%] rounded-sm bg-[#7FB3E6]" />
              <i className="bg-ansd-vert-vif block h-[70%] rounded-sm" />
              <i className="block h-full rounded-sm bg-white" />
            </span>
            <span>
              <b className="block text-white">Forum international sur les données</b>
              <small>Une initiative de l&apos;ANSD</small>
            </span>
          </div>
          <p className="max-w-[40ch] text-sm">
            Agence nationale de la Statistique et de la Démographie, Rocade Fann – Bel-Air –
            Cerf-volant, Dakar.
          </p>
        </div>
        <div>
          <h4 className="mb-2.5 text-[0.92rem] text-white">{t("home")}</h4>
          <Link href="/a-propos" className="block py-0.5 text-sm">
            {t("about")}
          </Link>
          <Link href="/programme" className="block py-0.5 text-sm">
            {t("program")}
          </Link>
          <Link href="/intervenants" className="block py-0.5 text-sm">
            {t("speakers")}
          </Link>
          <Link href="/sponsors" className="block py-0.5 text-sm">
            {t("sponsors")}
          </Link>
        </div>
        <div>
          <h4 className="mb-2.5 text-[0.92rem] text-white">{t("register")}</h4>
          <Link href="/inscription" className="block py-0.5 text-sm">
            {t("register")}
          </Link>
          <Link href="/mon-espace" className="block py-0.5 text-sm">
            {t("myRegistrations")}
          </Link>
          <Link href="/verifier" className="block py-0.5 text-sm">
            {t("verifyBadge")}
          </Link>
          <Link href="/infos-pratiques" className="block py-0.5 text-sm">
            {t("practicalInfo")}
          </Link>
        </div>
        <div>
          <h4 className="mb-2.5 text-[0.92rem] text-white">Suivre</h4>
          <span className="block py-0.5 text-sm">LinkedIn</span>
          <span className="block py-0.5 text-sm">X / Twitter</span>
          <span className="block py-0.5 text-sm">Facebook</span>
        </div>
        <div className="border-dark-panel-line col-span-full flex flex-wrap justify-between gap-2.5 border-t pt-4.5 text-sm md:col-span-4">
          <span>© 2026 ANSD</span>
          <span>Politique de confidentialité · Mentions légales</span>
        </div>
      </div>
    </footer>
  );
}
