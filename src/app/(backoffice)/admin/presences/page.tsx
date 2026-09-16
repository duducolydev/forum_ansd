import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { StatTile } from "@/modules/dashboard/components/stat-tile";
import { BarList } from "@/modules/dashboard/components/bar-list";
import { getFluxRecent, getPresenceDuJour, listerJours } from "@/modules/attendance/service";
import { LiveFeed } from "@/modules/attendance/components/live-feed";
import { ExportPanel } from "@/modules/attendance/components/export-panel";

export const dynamic = "force-dynamic";

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function enIso(jour: Date): string {
  return jour.toISOString().slice(0, 10);
}

export default async function PresencesPage({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "presences.read")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne donne pas accès aux présences.
      </div>
    );
  }

  const edition = await getActiveEdition();
  const { jour: jourDemande } = await searchParams;

  const jours = await listerJours(edition.id);
  // Aucun scan encore enregistré : on retombe sur aujourd'hui plutôt que sur un
  // écran vide sans date, pour que l'export reste utilisable en préparation.
  const disponibles = jours.length > 0 ? jours : [new Date(enIso(new Date()) + "T00:00:00.000Z")];
  const choisi = disponibles.find((jour) => enIso(jour) === jourDemande) ?? disponibles[0]!;

  const [presence, flux, categories, zones] = await Promise.all([
    getPresenceDuJour(edition.id, choisi),
    getFluxRecent(edition.id),
    prisma.participantCategory.findMany({
      where: { editionId: edition.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, labelFr: true },
    }),
    prisma.zone.findMany({
      where: { editionId: edition.id },
      orderBy: { code: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl">Présences</h2>
          <p className="text-text-3 text-sm">
            Ce que les points de contrôle ont enregistré, jour par jour.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {disponibles.map((jour) => {
            const iso = enIso(jour);
            const actif = iso === enIso(choisi);
            return (
              <Link
                key={iso}
                href={`/admin/presences?jour=${iso}`}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                  actif
                    ? "border-primary bg-primary text-primary-text"
                    : "border-border text-heading"
                }`}
              >
                {dateLongue.format(jour)}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Présents"
          value={presence.kpis.presents}
          hint="Personnes distinctes entrées ce jour"
          emphasis
        />
        <StatTile
          label="Taux de présence"
          value={presence.kpis.taux === null ? "—" : `${presence.kpis.taux} %`}
          hint="Présents / confirmés attendus"
          emphasis
        />
        <StatTile label="Attendus" value={presence.kpis.attendus} hint="Participants confirmés" />
        <StatTile
          label="Scans · refus"
          value={`${presence.kpis.scans} · ${presence.kpis.refus}`}
          hint="Tous passages, dont refusés"
        />
      </div>

      <ExportPanel jour={enIso(choisi)} categories={categories} zones={zones} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="border-border bg-surface rounded-xl border p-5">
          <h3 className="text-heading mb-1 text-sm font-semibold">Par point de contrôle</h3>
          <p className="text-text-3 mb-3 text-xs">
            Les refus ne sont pas des incidents en soi : une mauvaise salle est un refus normal.
          </p>
          {presence.parPoint.length === 0 ? (
            <p className="text-text-2 text-sm">Aucun passage ce jour.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-text-3 text-xs">
                    <th scope="col" className="px-2 py-2 text-left font-semibold">
                      Point
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">
                      Autorisés
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">
                      Déjà scannés
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">
                      Refusés
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {presence.parPoint.map((ligne) => (
                    <tr key={ligne.checkpointId} className="border-border border-t">
                      <td className="px-2 py-2">
                        <span className="text-heading block font-medium">{ligne.nom}</span>
                        <span className="text-text-3 text-xs">{ligne.zone}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{ligne.autorises}</td>
                      <td className="text-text-3 px-2 py-2 text-right tabular-nums">
                        {ligne.dejaScannes}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{ligne.refuses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="border-border bg-surface rounded-xl border p-5">
          <h3 className="text-heading mb-1 text-sm font-semibold">Affluence par zone</h3>
          <p className="text-text-3 mb-3 text-xs">
            Personnes distinctes passées dans la journée — pas le nombre de personnes présentes à
            l&apos;instant t, que le scan de sortie seul permettrait de connaître.
          </p>
          <BarList
            data={presence.parZone.map((ligne) => ({ label: ligne.zone, value: ligne.affluence }))}
            emptyLabel="Aucun passage ce jour."
          />
        </section>

        <section className="border-border bg-surface rounded-xl border p-5">
          <h3 className="text-heading mb-3 text-sm font-semibold">Taux par catégorie</h3>
          <TableauTaux lignes={presence.parCategorie} />
        </section>

        <section className="border-border bg-surface rounded-xl border p-5">
          <h3 className="text-heading mb-3 text-sm font-semibold">Taux par pays</h3>
          <TableauTaux lignes={presence.parPays.slice(0, 12)} />
        </section>
      </div>

      <LiveFeed initial={flux} />
    </div>
  );
}

function TableauTaux({
  lignes,
}: {
  lignes: { libelle: string; presents: number; attendus: number; taux: number }[];
}) {
  if (lignes.length === 0) {
    return <p className="text-text-2 text-sm">Aucune donnée.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-text-3 text-xs">
            <th scope="col" className="px-2 py-1.5 text-left font-semibold">
              Libellé
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-semibold">
              Présents
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-semibold">
              Attendus
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-semibold">
              Taux
            </th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne.libelle} className="border-border border-t">
              <td className="text-heading px-2 py-1.5">{ligne.libelle}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{ligne.presents}</td>
              <td className="text-text-3 px-2 py-1.5 text-right tabular-nums">{ligne.attendus}</td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{ligne.taux} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
