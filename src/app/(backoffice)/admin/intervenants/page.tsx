import { MicVocal } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listSpeakers } from "@/modules/speakers/service";
import { adresseIntervenant } from "@/modules/auth/magic-link";
import { CreateParticipantButton } from "@/modules/speakers/components/create-participant-button";

export const dynamic = "force-dynamic";

export default async function IntervenantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "speakers.read")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne donne pas accès aux intervenants.
      </div>
    );
  }

  const edition = await getActiveEdition();
  const speakers = await listSpeakers(edition.id);
  const peutEcrire = can(session, "speakers.write");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl">Intervenants</h2>
          <p className="text-text-3 text-sm">
            {speakers.length} fiche(s) · {speakers.filter((s) => s.isPublished).length} publiée(s)
          </p>
        </div>
        {peutEcrire && (
          <LienBouton href="/admin/intervenants/nouveau" ton="principal" icone={MicVocal}>
            Nouvel intervenant
          </LienBouton>
        )}
      </div>

      {speakers.length === 0 ? (
        <p className="text-text-2 text-sm">Aucun intervenant enregistré.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-text-3 text-xs">
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Intervenant
                </th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Sessions
                </th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Dépôts
                </th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">
                  Participant
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {speakers.map((speaker) => {
                const adresse = adresseIntervenant(speaker);
                return (
                  <tr key={speaker.id} className="border-border border-t align-top">
                    <td className="px-2 py-2.5">
                      <Link
                        href={`/admin/intervenants/${speaker.id}/modifier`}
                        className="text-heading font-medium"
                      >
                        {speaker.firstName} {speaker.lastName}
                      </Link>
                      <span className="text-text-3 block text-xs">
                        {[speaker.jobTitle, speaker.organization, speaker.country]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                        {!speaker.isPublished && " · brouillon"}
                      </span>
                      {/* Sans adresse, l'intervenant ne peut pas recevoir son
                          lien d'accès : c'est la première chose à corriger. */}
                      {!adresse && (
                        <span className="text-danger-text block text-xs font-semibold">
                          Aucune adresse : injoignable
                        </span>
                      )}
                    </td>
                    <td className="text-text-2 px-2 py-2.5">
                      {speaker.sessions.length === 0
                        ? "—"
                        : speaker.sessions.map((lien) => (
                            <span key={lien.session.id} className="block text-xs">
                              {lien.session.titleFr}
                            </span>
                          ))}
                    </td>
                    <td className="text-text-3 px-2 py-2.5 text-xs">
                      {speaker.photoPath ? "Photo" : "—"}
                      {" · "}
                      {speaker.presentationPath ? "Présentation" : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-xs">
                      {speaker.participant ? (
                        <Link
                          href={`/admin/participants/${speaker.participant.id}`}
                          className="text-link font-mono font-semibold"
                        >
                          {speaker.participant.publicId}
                        </Link>
                      ) : (
                        <span className="text-text-3">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {peutEcrire && !speaker.participant && (
                        <CreateParticipantButton speakerId={speaker.id} disabled={!adresse} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
