import { headers } from "next/headers";
import { ScanLine, ShieldCheck } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { verifyBadgePublicly } from "@/modules/badges/public-verify";
import { VerificationResult } from "@/modules/badges/components/verification-result";
import { formatEventLabel } from "@/modules/badges/event-label";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LienSite } from "@/components/site/bouton-site";
import { adresseClient } from "@/lib/adresse-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vérification d'un badge",
  robots: { index: false, follow: false },
};

// Jamais le premier élément de X-Forwarded-For, que le client choisit (§18).
async function clientIp(): Promise<string> {
  return adresseClient(await headers());
}

/**
 * Cible des QR codes imprimés sur les badges. L'appareil photo d'un téléphone
 * ouvre directement cette page : le résultat est rendu côté serveur, sans
 * étape intermédiaire ni JavaScript.
 */
export default async function VerifyTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const edition = await getActiveEdition();
  const result = await verifyBadgePublicly(decodeURIComponent(token), await clientIp());

  return (
    <>
      <BandeauPage largeur="etroit">
        <div className="text-center">
          <h1 className="mb-1 flex items-center justify-center gap-3">
            <span
              aria-hidden
              className="bg-accent-soft text-accent-text inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            >
              <ShieldCheck size={20} strokeWidth={2.1} />
            </span>
            Vérification d&apos;un badge
          </h1>
          <p className="text-text-2">{formatEventLabel(edition)}</p>
        </div>
      </BandeauPage>

      <CorpsPage largeur="etroit" className="text-center">
        <VerificationResult result={result} eventLabel={formatEventLabel(edition)} />

        <div className="mt-8 flex justify-center">
          <LienSite href="/verifier" taille="compact" icone={ScanLine}>
            Vérifier un autre badge
          </LienSite>
        </div>
      </CorpsPage>
    </>
  );
}
