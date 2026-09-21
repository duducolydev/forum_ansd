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
        <div className="text-center">
          <h1 className="mb-1 flex items-center justify-center gap-3">
            <span
              aria-hidden
              className="bg-blue-soft text-blue-text inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            >
              <Lock size={20} strokeWidth={2.1} />
            </span>
            Validation de la connexion
          </h1>
          <p className="text-text-2 mx-auto max-w-[68ch]">
            Ce lien vous ouvre le BackOffice sur cet appareil. Il ne sert qu&apos;une fois et expire
            dix minutes après son envoi.
          </p>
        </div>
      </BandeauPage>

      <CorpsPage largeur="etroit" espacement="serre">
        <ValidationLien jeton={token} />
      </CorpsPage>
    </>
  );
}
