import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ScanLine, Search, ShieldCheck } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { verifyBadgePublicly } from "@/modules/badges/public-verify";
import { VerificationResult } from "@/modules/badges/components/verification-result";
import { formatEventLabel } from "@/modules/badges/event-label";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { BoutonSite } from "@/components/site/bouton-site";
import { adresseClient } from "@/lib/adresse-client";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("verifyBadge") };
}

// Jamais le premier élément de X-Forwarded-For, que le client choisit (§18).
async function clientIp(): Promise<string> {
  return adresseClient(await headers());
}

/**
 * Contrôle manuel (brief §5.4, reprise du composant `.verify` du template).
 *
 * Formulaire en **GET** plutôt qu'en Server Action : le résultat devient une
 * URL partageable et rejouable, la page fonctionne sans JavaScript, et le
 * contrôle reste utilisable sur un poste d'accueil au réseau capricieux.
 */
export default async function VerifyBadgePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const t = await getTranslations("nav");
  const { id } = await searchParams;
  const edition = await getActiveEdition();
  const query = id?.trim() ?? "";

  const result = query ? await verifyBadgePublicly(query, await clientIp()) : null;

  return (
    <>
      <BandeauPage largeur="etroit">
        <div className="text-center">
          <span
            aria-hidden
            className="bg-accent-soft text-accent-text mb-4 inline-grid h-14 w-14 place-items-center rounded-2xl"
          >
            <ShieldCheck size={26} strokeWidth={2.1} />
          </span>
          <h1 className="mb-2">{t("verifyBadge")}</h1>
          <p className="text-text-2 mx-auto max-w-[46ch]">
            Scannez le QR code d&apos;un badge, ou saisissez l&apos;identifiant imprimé dessus.
          </p>
        </div>
      </BandeauPage>

      <CorpsPage largeur="etroit">
        <form
          method="get"
          className="border-border bg-surface flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row"
        >
          <label htmlFor="id" className="sr-only">
            Identifiant du badge
          </label>
          <span className="relative flex-1">
            <ScanLine
              aria-hidden
              size={17}
              className="text-text-3 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
            />
            <input
              id="id"
              name="id"
              defaultValue={query}
              placeholder="FID26-7K3M2P"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="border-border bg-bg text-text focus:border-link w-full rounded-lg border py-3 pr-3 pl-10 tracking-wider transition-colors"
            />
          </span>
          <BoutonSite type="submit" ton="principal" icone={Search}>
            Vérifier
          </BoutonSite>
        </form>

        {result && (
          <div className="mt-6">
            <VerificationResult result={result} eventLabel={formatEventLabel(edition)} />
          </div>
        )}
      </CorpsPage>
    </>
  );
}
