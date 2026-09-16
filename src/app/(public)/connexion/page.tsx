import { Lock } from "lucide-react";
import { BandeauPage, CorpsPage } from "@/components/site/bandeau-page";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Connexion à l'organisation",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <>
      <BandeauPage largeur="etroit">
        <div className="text-center">
          <span
            aria-hidden
            className="bg-blue-soft text-blue-text mb-4 inline-grid h-14 w-14 place-items-center rounded-2xl"
          >
            <Lock size={25} strokeWidth={2.1} />
          </span>
          <h1 className="mb-2">Connexion à l&apos;organisation</h1>
          <p className="text-text-2 mx-auto max-w-[44ch]">
            Espace réservé au comité d&apos;organisation. Les participants accèdent à leur dossier
            par « Mes inscriptions ».
          </p>
        </div>
      </BandeauPage>

      <CorpsPage largeur="etroit">
        {/* Transmise telle quelle ; le serveur la valide avant de s'en servir. */}
        <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : ""} />
      </CorpsPage>
    </>
  );
}
