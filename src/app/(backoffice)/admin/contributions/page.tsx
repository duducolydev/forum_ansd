import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { getActiveEdition } from "@/lib/edition";
import {
  presentationsEnAttenteDeSession,
  sessionsDeContribution,
} from "@/modules/contributions/service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contributions" };

const jour = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const heure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}

/**
 * Point d'entrée des contributions (§15).
 *
 * Le gestionnaire y voit toutes les sessions et leur état ; le rapporteur, les
 * sessions qui lui sont confiées et elles seules. C'est aussi l'écran d'arrivée
 * du rapporteur, qui n'a pas de tableau de bord.
 */
export default async function ContributionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");

  const permissions = session.user.permissions ?? [];
  const gestionnaire = permissions.includes("contributions.write");
  if (!gestionnaire && !permissions.includes("contributions.draft")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne permet pas de gérer les contributions.
      </div>
    );
  }

  const edition = await getActiveEdition();
  const [sessions, enAttente] = await Promise.all([
    sessionsDeContribution(edition.id, { userId: session.user.id, permissions }),
    // Le rapporteur n'a pas à connaître les intervenants hors de ses sessions.
    gestionnaire ? presentationsEnAttenteDeSession(edition.id) : Promise.resolve([]),
  ]);
  const peutRattacherIntervenant = permissions.includes("speakers.write");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl">Contributions</h2>
        <p className="text-text-3 text-sm">
          {gestionnaire
            ? "Toutes les sessions. Vous publiez ; les rapporteurs rédigent sur les sessions auxquelles vous les rattachez."
            : "Les sessions qui vous sont confiées. Vous rédigez ; le gestionnaire programme publie après relecture."}
        </p>
      </div>

      {enAttente.length > 0 && (
        <section
          aria-labelledby="titre-en-attente"
          className="border-border bg-surface rounded-xl border p-5"
        >
          <h3 id="titre-en-attente" className="text-heading text-sm font-semibold">
            Présentations en attente de session
          </h3>
          <p className="text-text-3 mt-1 text-xs">
            Ces intervenants ont déposé leur présentation mais ne sont rattachés à aucune session :
            elle ne figure donc dans aucune contribution. Rattachez-les depuis leur fiche ; leur
            présentation rejoindra la session, en brouillon.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {enAttente.map((intervenant) => (
              <li
                key={intervenant.id}
                data-testid="presentation-en-attente"
                className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <span className="text-sm">
                  <span className="text-heading font-medium">
                    {intervenant.firstName} {intervenant.lastName}
                  </span>
                  {intervenant.organization && (
                    <span className="text-text-3"> · {intervenant.organization}</span>
                  )}
                  <span className="text-text-3">
                    {" "}
                    ·{" "}
                    {intervenant.presentationConsentement
                      ? "publication autorisée"
                      : "sans accord de publication"}
                  </span>
                </span>
                {peutRattacherIntervenant && (
                  <Link
                    href={`/admin/intervenants/${intervenant.id}/modifier`}
                    className="text-link text-sm font-semibold"
                  >
                    Rattacher à une session
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sessions.length === 0 ? (
        <p className="border-border bg-surface text-text-3 rounded-xl border p-5 text-sm">
          {gestionnaire
            ? "Aucune session pour cette édition."
            : "Aucune session ne vous est confiée pour l'instant. Le gestionnaire programme vous rattache depuis l'écran d'une session."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((item) => {
            const publiees = item.contributions.filter((c) => c.isPublished).length;
            const brouillons = item.contributions.length - publiees;
            const deposees = item.contributions.filter((c) => c.origine === "INTERVENANT").length;
            const rapporteurs = item.rapporteurs.map((lien) => lien.user.name);

            return (
              <li key={item.id} data-testid="session-contributions">
                <Link
                  href={`/admin/sessions/${item.id}/contributions`}
                  className="border-border bg-surface carte-relief hover:border-border-strong flex flex-wrap items-center gap-3 rounded-xl border p-4 transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-heading block font-semibold">{item.titleFr}</span>
                    <span className="text-text-3 text-xs">
                      {jour.format(item.day)} · {heure.format(item.startTime)}
                      {!item.isPublished && " · session non publiée"}
                      {gestionnaire &&
                        (rapporteurs.length > 0
                          ? ` · Rapporteur : ${rapporteurs.join(", ")}`
                          : " · Aucun rapporteur")}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="bg-accent-soft text-accent-text rounded-md px-2 py-0.5 font-semibold">
                      {pluriel(publiees, "publiée")}
                    </span>
                    <span className="border-border text-text-2 rounded-md border px-2 py-0.5">
                      {pluriel(brouillons, "brouillon")}
                    </span>
                    {deposees > 0 && (
                      <span className="bg-blue-soft text-blue-text rounded-md px-2 py-0.5 font-semibold">
                        {pluriel(deposees, "dépôt")} d&apos;intervenant
                      </span>
                    )}
                    <ChevronRight aria-hidden size={16} className="text-text-3" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
