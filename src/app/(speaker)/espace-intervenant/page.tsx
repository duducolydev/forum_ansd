import { AlertCircle, Mic } from "lucide-react";
import { getSpeakerSession } from "@/modules/speakers/session";
import { getSpeaker } from "@/modules/speakers/service";
import { SpeakerSpace, type SpeakerVue } from "@/modules/speakers/components/speaker-space";
import { LinkRequestForm } from "@/modules/speakers/components/link-request-form";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Espace intervenant",
  robots: { index: false, follow: false },
};

const quand = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function EspaceIntervenantPage({
  searchParams,
}: {
  searchParams: Promise<{ lien?: string }>;
}) {
  const { lien } = await searchParams;
  const session = await getSpeakerSession();
  const speaker = session ? await getSpeaker(session.speakerId) : null;

  // Session valide mais intervenant supprimé entre-temps : on retombe sur le
  // formulaire plutôt que sur une page vide.
  if (!speaker) {
    return (
      <>
        <BandeauPage largeur="etroit">
          <div className="text-center">
            <span
              aria-hidden
              className="bg-blue-soft text-blue-text mb-4 inline-grid h-14 w-14 place-items-center rounded-2xl"
            >
              <Mic size={26} strokeWidth={2.1} />
            </span>
            <h1 className="mb-2">Espace intervenant</h1>
            <p className="text-text-2 mx-auto max-w-[52ch]">
              Déposez votre photo, votre biographie et votre présentation. Indiquez l&apos;adresse à
              laquelle le comité vous a écrit : vous recevrez un lien d&apos;accès valable 30
              minutes.
            </p>
          </div>
        </BandeauPage>

        <CorpsPage largeur="etroit">
          {lien === "invalide" && (
            <p className="bg-danger-soft text-danger-text mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm">
              <AlertCircle aria-hidden size={16} className="mt-0.5 shrink-0" />
              Ce lien n&apos;est plus valable : il a déjà servi ou il a expiré. Demandez-en un
              nouveau.
            </p>
          )}
          <div className="border-border bg-surface rounded-2xl border p-7 shadow-sm">
            <LinkRequestForm />
          </div>
        </CorpsPage>
      </>
    );
  }

  const vue: SpeakerVue = {
    id: speaker.id,
    nom: `${speaker.firstName} ${speaker.lastName}`,
    jobTitle: speaker.jobTitle ?? "",
    organization: speaker.organization ?? "",
    country: speaker.country ?? "",
    bioFr: speaker.bioFr ?? "",
    bioEn: speaker.bioEn ?? "",
    aPhoto: speaker.photoPath !== null,
    aPresentation: speaker.presentationPath !== null,
    aConsenti: speaker.presentationConsentement,
    sessions: speaker.sessions.map((lien) => ({
      id: lien.session.id,
      titre: lien.session.titleFr,
      quand: quand.format(lien.session.startTime),
      role: lien.role,
      confirmation: lien.confirmationStatus,
    })),
  };

  return (
    <>
      <BandeauPage largeur="moyen">
        <span className="surtitre mb-3">Espace intervenant</span>
        <h1 className="mb-1 flex items-center gap-3">
          <Mic aria-hidden size={26} className="text-accent-text shrink-0" />
          {vue.nom}
        </h1>
        <p className="text-text-2">
          {[vue.jobTitle, vue.organization, vue.country].filter(Boolean).join(" · ")}
        </p>
      </BandeauPage>

      <CorpsPage largeur="moyen">
        <SpeakerSpace speaker={vue} />
      </CorpsPage>
    </>
  );
}
