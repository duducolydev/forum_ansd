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
          <h1 className="mb-1 flex items-center justify-center gap-3">
            <span
              aria-hidden
              className="bg-blue-soft text-blue-text inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            >
              <Lock size={20} strokeWidth={2.1} />
            </span>
            Connexion à l&apos;organisation
          </h1>
          <p className="text-text-2 mx-auto max-w-[68ch]">
            Espace réservé au comité d&apos;organisation. Les participants accèdent à leur dossier
            par « Mon espace ».
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
