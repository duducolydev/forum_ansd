import type { ReactNode } from "react";
import { PublicShell } from "@/components/site/public-shell";

// L'espace intervenant garde l'en-tête et le pied de page du site : on y arrive
// par un lien reçu par courriel, et se retrouver sur une page sans repère
// donnerait l'impression d'avoir quitté le portail.
export default function SpeakerLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
