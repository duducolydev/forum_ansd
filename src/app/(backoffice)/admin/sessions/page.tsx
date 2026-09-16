import Link from "next/link";
import { CalendarPlus, ClipboardList, FileStack } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { ETAT_LABELS, listRooms, listSessions } from "@/modules/sessions/service";
import { TYPE_LABELS } from "@/modules/sessions/schema";
import { SessionActions } from "@/modules/sessions/components/session-actions";
import { RoomRowForm } from "@/modules/sessions/components/room-row-form";

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

export default async function SessionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "sessions.read")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne donne pas accès au programme.
      </div>
    );
  }

  const edition = await getActiveEdition();
  const [sessions, salles] = await Promise.all([listSessions(edition.id), listRooms(edition.id)]);

  const parJour = new Map<string, typeof sessions>();
  for (const item of sessions) {
    const cle = item.day.toISOString().slice(0, 10);
    parJour.set(cle, [...(parJour.get(cle) ?? []), item]);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl">Programme</h2>
          <p className="text-text-3 text-sm">
            {sessions.length} session(s) · {sessions.filter((s) => s.isPublished).length} publiée(s)
          </p>
        </div>
        {can(session, "sessions.write") && (
          <LienBouton href="/admin/sessions/nouvelle" ton="principal" icone={CalendarPlus}>
            Nouvelle session
          </LienBouton>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-text-2 text-sm">
          Aucune session pour l&apos;instant. Créez d&apos;abord vos salles, puis la première
          session.
        </p>
      ) : (
        [...parJour.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([jour, duJour]) => (
            <section key={jour}>
              <h3 className="text-heading mb-3 text-sm font-semibold">
                {jourLong.format(new Date(`${jour}T00:00:00.000Z`))}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-text-3 text-xs">
                      <th scope="col" className="px-2 py-2 text-left font-semibold">
                        Horaire
                      </th>
                      <th scope="col" className="px-2 py-2 text-left font-semibold">
                        Session
                      </th>
                      <th scope="col" className="px-2 py-2 text-left font-semibold">
                        Salle
                      </th>
                      <th scope="col" className="px-2 py-2 text-left font-semibold">
                        Remplissage
                      </th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {duJour.map((item) => (
                      <tr key={item.id} className="border-border border-t align-top">
                        <td className="text-text-3 px-2 py-2.5 whitespace-nowrap tabular-nums">
                          {heure(item.startTime)}
                          <br />
                          {heure(item.endTime)}
                        </td>
                        <td className="px-2 py-2.5">
                          <Link
                            href={`/admin/sessions/${item.id}/modifier`}
                            className="text-heading font-medium"
                          >
                            {item.titleFr}
                          </Link>
                          <span className="text-text-3 block text-xs">
                            {TYPE_LABELS[item.type]}
                            {item.theme ? ` · ${item.theme}` : ""}
                            {!item.isPublished && " · brouillon"}
                          </span>
                        </td>
                        <td className="text-text-2 px-2 py-2.5">{item.room?.name ?? "—"}</td>
                        <td className="px-2 py-2.5">
                          <Remplissage
                            etat={ETAT_LABELS[item.places.etat]}
                            inscrits={item.places.inscrits}
                            attente={item.places.attente}
                            capacite={item.places.capacite}
                            salle={item.room?.capacity ?? null}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          {/* Une seule ligne d'icônes : les quatre actions
                              tenaient sur trois lignes et allongeaient chaque
                              rangée du tableau. */}
                          {can(session, "sessions.write") && (
                            <div className="flex items-center justify-end gap-1">
                              <LienBouton
                                href={`/admin/sessions/${item.id}/inscriptions`}
                                ton="discret"
                                taille="petit"
                                icone={ClipboardList}
                                titre="Inscriptions"
                              />
                              {can(session, "contributions.write") && (
                                <LienBouton
                                  href={`/admin/sessions/${item.id}/contributions`}
                                  ton="discret"
                                  taille="petit"
                                  icone={FileStack}
                                  titre="Contributions"
                                />
                              )}
                              <SessionActions
                                id={item.id}
                                titre={item.titleFr}
                                isPublished={item.isPublished}
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
      )}

      {can(session, "sessions.write") && (
        <section>
          <h3 className="text-heading mb-1 text-sm font-semibold">Salles</h3>
          <p className="text-text-3 mb-3 text-xs">
            Une salle qui accueille des sessions ne se supprime pas : déplacez-les d&apos;abord.
          </p>
          <div className="flex flex-col gap-3">
            {salles.map((salle) => (
              <RoomRowForm
                key={salle.id}
                salle={{
                  id: salle.id,
                  name: salle.name,
                  capacity: salle.capacity,
                  floor: salle.floor,
                  sessions: salle._count.sessions,
                }}
              />
            ))}
            <RoomRowForm />
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Jauge de remplissage (la carte laissée en attente au chantier 4.6).
 *
 * L'échelle est la capacité **déclarée sur la session**. Quand elle dépasse
 * celle de la salle, c'est signalé : le cas arrive en recopiant une session
 * d'une grande salle vers une petite, et ne se voit qu'au moment où des gens
 * restent debout.
 */
function Remplissage({
  etat,
  inscrits,
  attente,
  capacite,
  salle,
}: {
  etat: string;
  inscrits: number;
  attente: number;
  capacite: number | null;
  salle: number | null;
}) {
  if (capacite === null) {
    return <span className="text-text-3 text-xs">{etat}</span>;
  }

  const part = Math.min(Math.round((inscrits / capacite) * 100), 100);
  const depasse = salle !== null && capacite > salle;

  return (
    <div className="min-w-32">
      <div className="text-text-2 mb-1 text-xs tabular-nums">
        {inscrits} / {capacite}
        {attente > 0 && <span className="text-text-3"> · {attente} en attente</span>}
      </div>
      <div className="bg-bg-2 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={part >= 100 ? "bg-danger-text h-full" : "bg-chart-mark h-full"}
          style={{ width: `${part}%` }}
        />
      </div>
      {depasse && (
        <p className="text-danger-text mt-1 text-[0.68rem]">
          Capacité supérieure à celle de la salle ({salle})
        </p>
      )}
    </div>
  );
}
