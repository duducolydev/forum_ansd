import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { ETAT_LABELS, getSession } from "@/modules/sessions/service";
import { listerInscriptions } from "@/modules/sessions/registration";
import { RegistrationsTable } from "@/modules/sessions/components/registrations-table";

export const dynamic = "force-dynamic";

const jourLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function heure(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}h${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export default async function InscriptionsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "registrations.manage")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne permet pas de gérer les inscriptions aux sessions.
      </div>
    );
  }

  const { id } = await params;
  const [courante, lignes] = await Promise.all([getSession(id), listerInscriptions(id)]);
  if (!courante) notFound();

  const presents = lignes.filter((ligne) => ligne.statut === "ATTENDED").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/sessions" className="text-text-3 text-sm">
          Programme
        </Link>
        <h2 className="mt-2 text-2xl">{courante.titleFr}</h2>
        <p className="text-text-3 text-sm">
          {jourLong.format(courante.day)} · {heure(courante.startTime)} – {heure(courante.endTime)}
          {courante.room ? ` · ${courante.room.name}` : ""} · {ETAT_LABELS[courante.places.etat]}
        </p>
      </div>

      <div className="border-border bg-surface flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border p-4 text-sm">
        <span className="text-heading font-semibold">
          {courante.places.inscrits}
          {courante.places.capacite !== null && ` / ${courante.places.capacite}`} inscrits
        </span>
        {courante.places.attente > 0 && (
          <span className="text-text-2">{courante.places.attente} en liste d&apos;attente</span>
        )}
        <span className="text-text-2">{presents} présent(s)</span>
        {courante.vipQuota ? (
          <span className="text-text-3 text-xs">
            {courante.vipQuota} place(s) réservée(s) au placement manuel
          </span>
        ) : null}

        <span className="ml-auto flex gap-3">
          <a
            href={`/api/v1/sessions/${id}/registrations?format=csv`}
            className="text-link font-semibold"
          >
            Export CSV
          </a>
          <a
            href={`/api/v1/sessions/${id}/registrations?format=pdf`}
            target="_blank"
            rel="noopener"
            className="text-link font-semibold"
          >
            Feuille d&apos;émargement
          </a>
        </span>
      </div>

      <RegistrationsTable sessionId={id} lignes={lignes} />
    </div>
  );
}
