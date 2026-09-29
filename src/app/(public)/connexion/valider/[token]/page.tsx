import { Lock } from "lucide-react";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { ValidationLien } from "../validation-lien";

export const metadata = {
  title: "Validation de la connexion",
  robots: { index: false, follow: false },
};

/** Page ouverte depuis le lien du courriel de connexion (PLAN.md §23). */
export default async function ValiderConnexionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <>
      <BandeauPage largeur="etroit">
        {/* Formulaire sensible : pas de curseur personnalisé (brief §6). */}
        <span data-sans-curseur hidden />
        <div className="text-center">
          <h1 className="flex items-center justify-center gap-3">
            <span
              aria-hidden
              className="bg-blue-soft text-blue-text inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            >
              <Lock size={20} strokeWidth={2.1} />
            </span>
            Validation de la connexion
          </h1>
        </div>
      </BandeauPage>

      <CorpsPage largeur="etroit" espacement="serre">
        {/* Consigne sous le bandeau, qui ne porte plus que le titre (29 septembre 2026). */}
        <p className="text-text-2 mx-auto mb-6 max-w-[68ch] text-center">
          Ce lien vous ouvre le BackOffice sur cet appareil. Il ne sert qu&apos;une fois et expire
          dix minutes après son envoi.
        </p>
        <ValidationLien jeton={token} />
      </CorpsPage>
    </>
  );
}
