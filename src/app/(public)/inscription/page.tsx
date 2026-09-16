import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, Clock, LockKeyhole, Save, UserPlus } from "lucide-react";
import { getActiveEdition } from "@/lib/edition";
import { lireParametres } from "@/modules/settings/service";
import { etatInscriptions } from "@/modules/settings/regles";
import { getInvitationByToken, markClicked } from "@/modules/invitations/service";
import { listCategories } from "@/modules/participants/service";
import { REGISTRATION_STEPS } from "@/modules/participants/registration-schema";
import {
  RegistrationForm,
  type RegistrationDay,
} from "@/modules/participants/components/registration-form";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { EnteteSection } from "@/components/site/entete-section";
import { LienSite } from "@/components/site/bouton-site";
import { Reveal } from "@/components/site/reveal";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("register") };
}

/** Journées du Forum, dérivées des dates de l'édition (pas de dates en dur). */
function buildDays(start: Date, end: Date): RegistrationDay[] {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Dakar",
  });
  const days: RegistrationDay[] = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (cursor <= last && days.length < 10) {
    days.push({ value: cursor.toISOString().slice(0, 10), label: formatter.format(cursor) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ inv?: string }>;
}) {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const en = locale === "en";
  const { inv } = await searchParams;
  const edition = await getActiveEdition();

  // Suivi de clic sur le lien personnalisé (brief §5.5).
  if (inv) {
    await markClicked(inv).catch(() => undefined);
  }

  const invitation = inv ? await getInvitationByToken(inv).catch(() => null) : null;
  const usableInvitation =
    invitation && invitation.editionId === edition.id && invitation.status !== "REGISTERED"
      ? {
          token: invitation.token,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          email: invitation.email,
          categoryId: invitation.categoryId,
        }
      : null;

  /*
   * Guichet fermé : on l'annonce au lieu d'afficher un formulaire qui serait
   * refusé au bout du parcours. Une invitation nominative ouvre malgré tout —
   * c'est le comité qui l'a émise. Le refus autoritaire reste côté serveur
   * (`registerPublicParticipant`) : cette page ne fait que l'expliquer.
   */
  // Réglages lus sur l'édition déjà chargée : ni requête supplémentaire, ni
  // cache. Une page qui annonce « ouvert » pendant une minute après la
  // fermeture ferait remplir tout le formulaire pour rien.
  const parametres = lireParametres(edition);
  const guichet = etatInscriptions(parametres.inscriptions);

  if (!guichet.ouvertes && !usableInvitation) {
    const message = en
      ? parametres.inscriptions.messageFermeEn
      : parametres.inscriptions.messageFermeFr;

    return (
      <>
        <BandeauPage largeur="moyen">
          <EnteteSection
            marge={false}
            niveau="h1"
            surtitre={en ? "Registrations closed" : "Inscriptions fermées"}
            titre={t("register")}
            icone={LockKeyhole}
          />
        </BandeauPage>

        <CorpsPage largeur="moyen">
          <div className="border-border bg-surface text-text-2 rounded-2xl border p-7 text-lg">
            {message}
          </div>

          {guichet.ouvreLe && (
            <p className="text-text-3 mt-4 flex items-center gap-2 text-sm">
              <CalendarClock aria-hidden size={15} className="text-accent-text" />
              {en ? "Opening on " : "Ouverture prévue le "}
              {new Intl.DateTimeFormat(en ? "en-GB" : "fr-FR", {
                dateStyle: "long",
                timeZone: "Africa/Dakar",
              }).format(new Date(`${guichet.ouvreLe}T12:00:00.000Z`))}
              .
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <LienSite href="/programme">{en ? "See the programme" : "Voir le programme"}</LienSite>
            <LienSite href="/actualites">{en ? "Read the news" : "Lire les actualités"}</LienSite>
          </div>
        </CorpsPage>
      </>
    );
  }

  const categories = await listCategories(edition.id);

  /*
   * Trois promesses affichées avant le formulaire. Le taux d'abandon d'un
   * formulaire long tient d'abord à l'inconnu : combien d'étapes, combien de
   * temps, que se passe-t-il si je m'interromps.
   *
   * Le compte d'étapes est **dérivé**, jamais écrit. L'étape « Logistique »
   * n'apparaît que pour les catégories qui en demandent une : la page annonçait
   * « Cinq étapes » là où la barre de progression affichait « Étape 1 sur 4 ».
   * Une promesse démentie par l'écran suivant coûte plus qu'une promesse vague.
   */
  const etapesToujours = REGISTRATION_STEPS.filter((etape) => etape.key !== "logistics");
  const minimum = etapesToujours.length;
  const maximum = REGISTRATION_STEPS.length;

  const promesses = [
    {
      icone: UserPlus,
      titre: en ? `${minimum} to ${maximum} steps` : `${minimum} à ${maximum} étapes`,
      texte: en
        ? "Logistics is only asked of categories that need it."
        : "La logistique n'est demandée qu'aux catégories concernées.",
      ton: "bg-blue-soft text-blue-text",
    },
    {
      icone: Clock,
      titre: en ? "About four minutes" : "Environ quatre minutes",
      texte: en ? "No document required at this stage." : "Aucune pièce à fournir à ce stade.",
      ton: "bg-accent-soft text-accent-text",
    },
    {
      icone: Save,
      titre: en ? "Saved as you go" : "Enregistré au fil de l'eau",
      texte: en
        ? "Your progress stays on this device between steps."
        : "Votre progression reste sur cet appareil entre deux étapes.",
      ton: "bg-gold-soft text-gold-text",
    },
  ];

  return (
    <>
      <BandeauPage largeur="moyen">
        <EnteteSection
          marge={false}
          niveau="h1"
          surtitre={en ? "Join the Forum" : "Rejoindre le Forum"}
          titre={t("register")}
          icone={UserPlus}
          description={edition.theme ?? undefined}
        />
      </BandeauPage>

      <CorpsPage largeur="moyen">
        <Reveal>
          <div className="mb-10 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {promesses.map((promesse) => {
              const Icone = promesse.icone;
              return (
                <div
                  key={promesse.titre}
                  className="border-border bg-surface carte-relief rounded-xl border p-4"
                >
                  <span
                    className={`mb-2.5 grid h-9 w-9 place-items-center rounded-lg ${promesse.ton}`}
                  >
                    <Icone aria-hidden size={17} strokeWidth={2.2} />
                  </span>
                  <span className="text-heading block text-sm font-semibold">{promesse.titre}</span>
                  <span className="text-text-3 mt-0.5 block text-sm">{promesse.texte}</span>
                </div>
              );
            })}
          </div>
        </Reveal>

        <RegistrationForm
          categories={categories.map((category) => ({
            id: category.id,
            labelFr: category.labelFr,
            requiresLogistics: category.requiresLogistics,
          }))}
          days={buildDays(edition.startDate, edition.endDate)}
          invitation={usableInvitation}
        />
      </CorpsPage>
    </>
  );
}
