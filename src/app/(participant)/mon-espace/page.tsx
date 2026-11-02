import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { lireLangue, localeIntl, selon, traduire } from "@/lib/langue";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  Clock,
  Download,
  FileImage,
  LogOut,
  ShieldAlert,
  UserPen,
  UserRoundCheck,
  Users,
  Newspaper,
} from "lucide-react";
import { getParticipantSession } from "@/modules/auth/participant-session";
import { logoutAction } from "@/modules/participants/my-space-actions";
import { editDeadline, canEditNow, getMySpaceData } from "@/modules/participants/my-space-service";
import { MagicLinkForm } from "@/modules/participants/components/magic-link-form";
import { MyInfoForm } from "@/modules/participants/components/my-info-form";
import { DeletionRequest } from "@/modules/participants/components/deletion-request";
import { PhotoForm } from "@/modules/participants/components/photo-form";
import { StatusBadge } from "@/modules/participants/components/status-badge";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { BoutonSite, LienSite, LienSiteExterne } from "@/components/site/bouton-site";
import { Reveal } from "@/components/site/reveal";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("myRegistrations"), robots: { index: false, follow: false } };
}

/** Toujours dynamique : le contenu dépend du cookie de session participant. */
export const dynamic = "force-dynamic";

/** Dates et heures dans la langue du visiteur, à l'heure de Dakar. */
function formateurs(langue: string) {
  return {
    date: new Intl.DateTimeFormat(localeIntl(langue), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Dakar",
    }),
    heure: new Intl.DateTimeFormat(localeIntl(langue), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Dakar",
    }),
  };
}

/**
 * Panneau de l'espace participant.
 *
 * Chaque rubrique porte son icône dans une pastille colorée : la page est une
 * longue colonne de cartes identiques, et le repérage se faisait jusqu'ici en
 * relisant chaque titre.
 */
function Panneau({
  icone: Icone,
  ton,
  titre,
  children,
}: {
  icone: LucideIcon;
  ton: string;
  titre: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-surface carte-relief rounded-2xl border p-6">
      <h2 className="mb-4 flex items-center gap-3 text-xl">
        <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${ton}`}>
          <Icone size={17} strokeWidth={2.2} />
        </span>
        {titre}
      </h2>
      {children}
    </section>
  );
}

export default async function MySpacePage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const session = await getParticipantSession();
  const participant = session ? await getMySpaceData(session.participantId) : null;
  const langue = lireLangue(await getLocale());
  const t = (textes: { fr: string; en: string; pt: string }) => selon(langue, textes);

  if (!participant) {
    return (
      <>
        <BandeauPage largeur="etroit" reseau={false}>
          <div className="text-center">
            <h1 className="flex items-center justify-center gap-3">
              <span
                aria-hidden
                className="bg-blue-soft text-blue-text inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              >
                <BadgeCheck size={20} strokeWidth={2.1} />
              </span>
              {t({ fr: "Mon espace", en: "My space", pt: "O meu espaço" })}
            </h1>
          </div>
        </BandeauPage>

        <CorpsPage largeur="etroit">
          {/* Consigne sous le bandeau, qui ne porte plus que le titre (29 septembre 2026). */}
          <p className="text-text-2 mx-auto mb-6 max-w-[68ch] text-center">
            {t({
              fr: "Pas de mot de passe : indiquez votre adresse e-mail, nous vous envoyons un lien d'accès valable 30 minutes.",
              en: "No password: enter your email address and we will send you an access link valid for 30 minutes.",
              pt: "Sem palavra-passe: indique o seu endereço de e-mail e enviamos-lhe uma ligação de acesso válida durante 30 minutos.",
            })}
          </p>
          <div className="border-border bg-surface rounded-2xl border p-7 shadow-sm">
            <MagicLinkForm linkError={erreur === "lien"} />
          </div>
          <p className="text-text-3 mt-8 text-center text-sm">
            {t({
              fr: "Pas encore inscrit\u00a0?",
              en: "Not registered yet?",
              pt: "Ainda não está inscrito?",
            })}{" "}
            <LienSite href="/inscription" ton="discret" taille="compact">
              {t({
                fr: "Remplir le formulaire",
                en: "Fill in the form",
                pt: "Preencher o formulário",
              })}
            </LienSite>
          </p>
        </CorpsPage>
      </>
    );
  }

  /*
   * Presse en attente d'accréditation (29 septembre 2026) : le compte n'est
   * « activé » qu'à l'accréditation. D'ici là, l'espace ne montre que l'état de
   * la demande — ni badge, ni formulaires.
   */
  if (participant.category.requiresAccreditation && participant.status === "REGISTERED") {
    return (
      <>
        <BandeauPage largeur="moyen" reseau={false}>
          <h1>
            {t({ fr: "Bonjour", en: "Hello", pt: "Olá" })} {participant.firstName}{" "}
            {participant.lastName}
          </h1>
        </BandeauPage>
        <span data-sans-curseur hidden />
        <CorpsPage largeur="moyen" className="flex flex-col gap-6">
          <Panneau
            icone={Newspaper}
            ton="bg-gold-soft text-gold-text"
            titre={t({
              fr: "Accréditation presse en cours",
              en: "Press accreditation in progress",
              pt: "Acreditação de imprensa em curso",
            })}
          >
            <p className="text-text-2 leading-relaxed">
              {t({
                fr: "Votre demande d'accréditation presse est bien enregistrée. Votre compte sera activé dès que l'administration du Forum aura accordé votre accréditation : vous recevrez alors un e-mail avec un accès direct à cet espace, où vous retrouverez votre badge presse.",
                en: "Your press accreditation request has been recorded. Your account will be activated as soon as the Forum administration grants your accreditation: you will then receive an email with direct access to this space, where you will find your press badge.",
                pt: "O seu pedido de acreditação de imprensa foi registado. A sua conta será ativada assim que a administração do Fórum conceder a sua acreditação: receberá então um e-mail com acesso direto a este espaço, onde encontrará o seu crachá de imprensa.",
              })}
            </p>
            <p className="text-text-3 mt-3 text-sm">
              {t({ fr: "N° de dossier", en: "File number", pt: "N.º de processo" })} :{" "}
              {participant.publicId}
            </p>
          </Panneau>
          <form action={logoutAction}>
            <BoutonSite type="submit" taille="compact" icone={LogOut}>
              {t({ fr: "Se déconnecter", en: "Sign out", pt: "Terminar sessão" })}
            </BoutonSite>
          </form>
        </CorpsPage>
      </>
    );
  }

  const editable = canEditNow(participant.edition.startDate);
  const { date: dateFormatter, heure: timeFormatter } = formateurs(langue);
  const deadlineLabel = dateFormatter.format(editDeadline(participant.edition.startDate));
  const badge = participant.badges.find((item) => !item.revokedAt) ?? null;
  const isDelegationHead = participant.delegation?.headParticipantId === participant.id;

  return (
    <>
      <BandeauPage largeur="moyen" reseau={false}>
        <h1>
          {t({ fr: "Bonjour", en: "Hello", pt: "Olá" })} {participant.firstName}{" "}
          {participant.lastName}
        </h1>
      </BandeauPage>

      {/* Espace personnel : animations minimales, ni canvas ni curseur (brief §6). */}
      <span data-sans-curseur hidden />
      <CorpsPage largeur="moyen" className="flex flex-col gap-6">
        {/* Statut et déconnexion sous le bandeau, qui ne porte plus que le titre. */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-text-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={participant.status} langue={langue} />
            <span>
              {traduire(langue, {
                fr: participant.category.labelFr,
                en: participant.category.labelEn,
                pt: participant.category.labelPt,
              })}
            </span>
            <span className="text-text-3">·</span>
            <span className="text-text-3">
              {t({ fr: "N°", en: "No.", pt: "N.º" })} {participant.publicId}
            </span>
          </p>
          <form action={logoutAction}>
            <BoutonSite type="submit" taille="compact" icone={LogOut}>
              {t({ fr: "Se déconnecter", en: "Sign out", pt: "Terminar sessão" })}
            </BoutonSite>
          </form>
        </div>
        <Reveal>
          <Panneau
            icone={BadgeCheck}
            ton="bg-accent-soft text-accent-text"
            titre={t({ fr: "Mon badge", en: "My badge", pt: "O meu crachá" })}
          >
            {badge?.pdfPath ? (
              <div className="flex flex-wrap items-center gap-5">
                {badge.pngPath && (
                  // Aperçu du badge et de son QR code, avec un léger zoom d'entrée.
                  /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée et authentifiée */
                  <img
                    src={`/api/v1/badges/${badge.id}/png`}
                    alt={t({
                      fr: "Aperçu de mon badge",
                      en: "Preview of my badge",
                      pt: "Pré-visualização do meu crachá",
                    })}
                    className="zoom-entree border-border h-44 w-auto rounded-xl border bg-white shadow-sm"
                  />
                )}
                <div className="flex flex-wrap gap-3">
                  <LienSiteExterne
                    href={`/api/v1/badges/${badge.id}/pdf`}
                    ton="principal"
                    icone={Download}
                  >
                    {t({
                      fr: "Télécharger le badge (PDF)",
                      en: "Download the badge (PDF)",
                      pt: "Descarregar o crachá (PDF)",
                    })}
                  </LienSiteExterne>
                  {badge.pngPath && (
                    <LienSiteExterne href={`/api/v1/badges/${badge.id}/png`} icone={FileImage}>
                      {t({ fr: "Version PNG", en: "PNG version", pt: "Versão PNG" })}
                    </LienSiteExterne>
                  )}
                </div>
              </div>
            ) : badge ? (
              <p className="text-text-2 flex items-start gap-2">
                <Clock aria-hidden size={16} className="text-text-3 mt-1 shrink-0" />
                {t({
                  fr: "Votre badge est en cours de génération. Vous recevrez un e-mail dès qu'il sera disponible.",
                  en: "Your badge is being generated. You will receive an email as soon as it is available.",
                  pt: "O seu crachá está a ser gerado. Receberá um e-mail assim que estiver disponível.",
                })}
              </p>
            ) : (
              <p className="text-text-2 flex items-start gap-2">
                <Clock aria-hidden size={16} className="text-text-3 mt-1 shrink-0" />
                {t({
                  fr: "Votre badge sera généré dès la confirmation de votre inscription par le comité d'organisation.",
                  en: "Your badge will be generated as soon as the organising committee confirms your registration.",
                  pt: "O seu crachá será gerado assim que a comissão organizadora confirmar a sua inscrição.",
                })}
              </p>
            )}
          </Panneau>
        </Reveal>

        <Reveal delai={60}>
          <Panneau
            icone={Camera}
            ton="bg-blue-soft text-blue-text"
            titre={t({ fr: "Ma photo", en: "My photo", pt: "A minha fotografia" })}
          >
            <PhotoForm
              participantId={participant.id}
              photoEnregistree={Boolean(participant.photoPath)}
            />
          </Panneau>
        </Reveal>

        <Reveal delai={120}>
          <Panneau
            icone={UserPen}
            ton="bg-gold-soft text-gold-text"
            titre={t({ fr: "Mes informations", en: "My details", pt: "Os meus dados" })}
          >
            <MyInfoForm
              email={participant.email}
              editable={editable}
              deadlineLabel={deadlineLabel}
              values={{
                civility: participant.civility ?? "",
                firstName: participant.firstName,
                lastName: participant.lastName,
                phone: participant.phone ?? "",
                city: participant.city ?? "",
                organization: participant.organization ?? "",
                jobTitle: participant.jobTitle ?? "",
                dietaryRequirements: participant.dietaryRequirements ?? "",
                specialNeeds: participant.specialNeeds ?? "",
              }}
            />
          </Panneau>
        </Reveal>

        <Reveal delai={180}>
          <Panneau
            icone={CalendarDays}
            ton="bg-blue-soft text-blue-text"
            titre={t({ fr: "Mes sessions", en: "My sessions", pt: "As minhas sessões" })}
          >
            {participant.sessionRegistrations.length === 0 ? (
              <>
                <p className="text-text-2">
                  {t({
                    fr: "Aucune session réservée. Le programme détaillé et la réservation de sessions seront ouverts prochainement.",
                    en: "No sessions booked. The detailed programme and session booking will open soon.",
                    pt: "Nenhuma sessão reservada. O programa detalhado e a reserva de sessões abrirão em breve.",
                  })}
                </p>
                <div className="mt-4">
                  <LienSite href="/programme" taille="compact" icone={CalendarDays}>
                    {t({
                      fr: "Parcourir le programme",
                      en: "Browse the programme",
                      pt: "Consultar o programa",
                    })}
                  </LienSite>
                </div>
              </>
            ) : (
              <ul className="flex flex-col gap-3">
                {participant.sessionRegistrations.map((registration) => (
                  <li
                    key={registration.id}
                    className="border-border flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <b className="text-heading">
                      {traduire(langue, {
                        fr: registration.session.titleFr,
                        en: registration.session.titleEn,
                        pt: registration.session.titlePt,
                      })}
                    </b>
                    <span className="text-text-3 flex items-center gap-1.5 text-sm">
                      <Clock aria-hidden size={13} />
                      {dateFormatter.format(registration.session.day)} ·{" "}
                      {timeFormatter.format(registration.session.startTime)}–
                      {timeFormatter.format(registration.session.endTime)}
                      {registration.status === "WAITLISTED" &&
                        ` · ${t({ fr: "liste d'attente", en: "waiting list", pt: "lista de espera" })}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panneau>
        </Reveal>

        {/*
          Référent de la délégation, avant le bloc réservé au chef : c'est le
          seul encart de cette page dont un participant a besoin en urgence, et
          il ne doit pas être à chercher en bas.
        */}
        {participant.delegation?.referent && (
          <Reveal delai={210}>
            <Panneau
              icone={UserRoundCheck}
              ton="bg-blue-soft text-blue-text"
              titre={t({ fr: "Mon référent", en: "My contact person", pt: "O meu referente" })}
            >
              <p className="text-text-3 mb-3 text-sm">
                {t({
                  fr: "Votre interlocuteur au sein du comité d'organisation pour la délégation",
                  en: "Your contact on the organising committee for the delegation",
                  pt: "O seu interlocutor na comissão organizadora para a delegação",
                })}{" "}
                {participant.delegation.name}.
              </p>
              <p className="text-heading font-semibold">
                {participant.delegation.referent.name}
                {participant.delegation.referent.role && (
                  <span className="text-text-3 font-normal">
                    {" "}
                    — {participant.delegation.referent.role}
                  </span>
                )}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                <li>
                  <a
                    href={`mailto:${participant.delegation.referent.email}`}
                    className="text-link underline"
                  >
                    {participant.delegation.referent.email}
                  </a>
                </li>
                {participant.delegation.referent.phone && (
                  <li>
                    <a
                      href={`tel:${participant.delegation.referent.phone.replace(/\s/g, "")}`}
                      className="text-link underline"
                    >
                      {participant.delegation.referent.phone}
                    </a>
                  </li>
                )}
              </ul>
            </Panneau>
          </Reveal>
        )}

        {isDelegationHead && participant.delegation && (
          <Reveal delai={240}>
            <Panneau
              icone={Users}
              ton="bg-accent-soft text-accent-text"
              titre={`${t({ fr: "Ma délégation", en: "My delegation", pt: "A minha delegação" })} — ${participant.delegation.name}`}
            >
              <p className="text-text-3 mb-4 text-sm">
                {t({
                  fr: `Vous êtes chef de délégation. ${participant.delegation.members.length} membre(s).`,
                  en: `You are the head of delegation. ${participant.delegation.members.length} member(s).`,
                  pt: `É o chefe da delegação. ${participant.delegation.members.length} membro(s).`,
                })}
              </p>
              <ul className="flex flex-col gap-2">
                {participant.delegation.members.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-heading">
                      {member.firstName} {member.lastName}
                    </span>
                    <StatusBadge status={member.status} langue={langue} />
                    <span className="text-text-3 text-sm">
                      {t({ fr: "N°", en: "No.", pt: "N.º" })} {member.publicId}
                    </span>
                  </li>
                ))}
              </ul>
            </Panneau>
          </Reveal>
        )}

        <Reveal delai={300}>
          <Panneau
            icone={ShieldAlert}
            ton="bg-danger-soft text-danger-text"
            titre={t({
              fr: "Mes données personnelles",
              en: "My personal data",
              pt: "Os meus dados pessoais",
            })}
          >
            <DeletionRequest />
          </Panneau>
        </Reveal>
      </CorpsPage>
    </>
  );
}
