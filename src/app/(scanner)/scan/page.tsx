import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { ScannerApp } from "@/modules/scan/components/scanner-app";
import { EnregistrementServiceWorker } from "@/modules/scan/components/service-worker";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/scan");

  if (!can(session, "scan.use")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B1622] px-6 text-center text-white">
        <ShieldAlert aria-hidden size={40} className="text-white/70" />
        <p className="text-lg font-semibold">Votre rôle ne donne pas accès au scanner.</p>
        <p className="text-sm text-white/70">
          Le contrôle d&apos;accès est réservé aux agents d&apos;accueil.
        </p>
        <Link
          href="/admin"
          className="mt-1 inline-flex items-center gap-2 rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10"
        >
          <ArrowLeft aria-hidden size={15} />
          Retour au BackOffice
        </Link>
      </div>
    );
  }

  return (
    <>
      <EnregistrementServiceWorker />
      <ScannerApp nomAgent={session.user.name ?? "Agent"} />
    </>
  );
}
