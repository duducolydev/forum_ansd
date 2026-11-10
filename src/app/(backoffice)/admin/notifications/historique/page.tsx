import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { historiqueSearchSchema } from "@/modules/notifications/schema";
import {
  listerEnvois,
  modelesJournalises,
  type EnvoiHistorique,
} from "@/modules/notifications/historique";
import { FiltresHistorique } from "@/modules/notifications/components/filtres-historique";
import { LogStatusBadge } from "@/modules/notifications/components/log-status-badge";
import { Pagination } from "@/modules/participants/components/pagination";
import { BoutonRebonds } from "@/modules/notifications/components/bouton-rebonds";
import { configImap } from "@/modules/notifications/rebonds";

export const metadata = { title: "Historique d'envoi" };
export const dynamic = "force-dynamic";

const dateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Africa/Dakar",
});

/**
 * Historique complet des e-mails (10 novembre 2026) : la page Notifications
 * n'en montrait que les 25 derniers, sans moyen de retrouver un échec précis.
 */
export default async function HistoriqueEnvoisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "notifications.manage")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const search = historiqueSearchSchema.parse(sp);
  const edition = await getActiveEdition();

  const [{ items, total }, modeles] = await Promise.all([
    listerEnvois(edition.id, search),
    modelesJournalises(),
  ]);
  const voirFiche = can(session, "participants.read");
  const corrigerInvitation = can(session, "invitations.write");

  return (
    <div>
      <Link
        href="/admin/notifications"
        className="text-text-3 hover:text-blue-text mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Notifications
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl">Historique d&apos;envoi</h2>
          <span className="text-text-3 text-sm">
            {total} e-mail{total > 1 ? "s" : ""} · heures de Dakar
          </span>
        </div>
        {configImap() && <BoutonRebonds />}
      </div>

      <p className="text-text-3 mb-4 text-xs">
        « Rebond » : le message est parti, mais le serveur du destinataire l&apos;a refusé (adresse
        introuvable, boîte pleine…). Ces refus arrivent après coup dans la boîte d&apos;envoi ; ils
        sont relevés toutes les quinze minutes.
      </p>

      <FiltresHistorique modeles={modeles} />

      {items.length === 0 ? (
        <p className="text-text-2 text-sm">Aucun envoi ne correspond à ces filtres.</p>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface text-text-3">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date et heure</th>
                <th className="px-3 py-2 text-left font-medium">Destinataire</th>
                <th className="px-3 py-2 text-left font-medium">E-mail</th>
                <th className="px-3 py-2 text-left font-medium">État</th>
              </tr>
            </thead>
            <tbody>
              {items.map((envoi) => (
                <tr key={envoi.id} className="border-border border-t align-top">
                  <td className="text-text-2 px-3 py-2 whitespace-nowrap">
                    {dateHeure.format(envoi.createdAt)}
                    {envoi.sentAt &&
                      Math.abs(envoi.sentAt.getTime() - envoi.createdAt.getTime()) >= 60_000 && (
                        <div className="text-text-3 text-xs">
                          parti le {dateHeure.format(envoi.sentAt)}
                        </div>
                      )}
                  </td>
                  <td className="px-3 py-2">
                    <Destinataire
                      envoi={envoi}
                      voirFiche={voirFiche}
                      corrigerInvitation={corrigerInvitation}
                    />
                    <div className="text-text-3 break-all">{envoi.to}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-text">{envoi.objet ?? "—"}</div>
                    <code className="text-text-3 text-xs">{envoi.templateKey}</code>
                  </td>
                  <td className="px-3 py-2">
                    <LogStatusBadge status={envoi.status} />
                    {envoi.bouncedAt && (
                      <div className="text-text-3 mt-1 text-xs">
                        signalé le {dateHeure.format(envoi.bouncedAt)}
                      </div>
                    )}
                    {envoi.error && (
                      <div className="text-danger-text mt-1 max-w-sm text-xs break-words">
                        {envoi.error}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={search.page}
        pageSize={search.pageSize}
        total={total}
        basePath="/admin/notifications/historique"
        searchParams={sp}
      />
    </div>
  );
}

function Destinataire({
  envoi,
  voirFiche,
  corrigerInvitation,
}: {
  envoi: EnvoiHistorique;
  voirFiche: boolean;
  corrigerInvitation: boolean;
}) {
  const cible = envoi.destinataire;
  if (!cible) {
    return <span className="text-text-3 italic">Destinataire non retrouvé</span>;
  }
  if (cible.genre === "participant") {
    return voirFiche ? (
      <Link
        href={`/admin/participants/${cible.id}`}
        className="text-heading hover:text-blue-text font-medium"
      >
        {cible.nom}
      </Link>
    ) : (
      <span className="text-heading font-medium">{cible.nom}</span>
    );
  }
  return (
    <span>
      <span className="text-heading font-medium">{cible.nom}</span>
      <span className="bg-bg-3 text-text-2 ml-1.5 rounded px-1.5 py-0.5 text-xs">invité</span>
      {corrigerInvitation && envoi.status === "BOUNCED" && (
        <Link
          href={`/admin/invitations/${cible.id}/modifier`}
          className="text-blue-text ml-2 text-xs font-medium hover:underline"
        >
          Corriger l&apos;adresse
        </Link>
      )}
    </span>
  );
}
