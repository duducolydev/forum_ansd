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
            Connexion à l&apos;organisation
          </h1>
        </div>
      </BandeauPage>

      <CorpsPage largeur="etroit">
        {/* Consigne sous le bandeau, qui ne porte plus que le titre (29 septembre 2026). */}
        <p className="text-text-2 mx-auto mb-6 max-w-[68ch] text-center">
          Espace réservé au comité d&apos;organisation. Les participants accèdent à leur dossier par
          « Mon espace ».
        </p>
        {/* Transmise telle quelle ; le serveur la valide avant de s'en servir. */}
        <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : ""} />
      </CorpsPage>
    </>
  );
}
