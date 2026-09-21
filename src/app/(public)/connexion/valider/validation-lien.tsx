"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertCircle, LogIn } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";
import { validerLienAction, type ValidationState } from "../actions";
import { loginErrorMessage } from "../error-messages";

const etatInitial: ValidationState = {};

/**
 * Validation du lien reçu par e-mail (PLAN.md §23).
 *
 * L'envoi part du navigateur, à l'ouverture de la page : un lien de courriel est
 * visité par les antivirus de messagerie et les aperçus, qui ne font que
 * charger la page — le jeton, lui, n'est consommé que par cet envoi. Le bouton
 * reste affiché pour qui navigue sans JavaScript.
 */
export function ValidationLien({ jeton }: { jeton: string }) {
  const [etat, action, enCours] = useActionState(validerLienAction, etatInitial);
  const formulaire = useRef<HTMLFormElement>(null);
  const envoye = useRef(false);

  useEffect(() => {
    if (envoye.current) return;
    envoye.current = true;
    formulaire.current?.requestSubmit();
  }, []);

  const message = loginErrorMessage(etat.error);

  return (
    <form ref={formulaire} action={action} className="flex flex-col items-center gap-4">
      <input type="hidden" name="jeton" value={jeton} />

      {message ? (
        <p className="text-danger-text bg-danger-soft flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
          <AlertCircle aria-hidden size={15} className="mt-0.5 shrink-0" />
          {message}
        </p>
      ) : (
        <p className="text-text-2 text-sm">
          {enCours ? "Validation en cours…" : "Validez pour ouvrir votre session."}
        </p>
      )}

      <BoutonSite type="submit" ton="principal" icone={LogIn} disabled={enCours}>
        {enCours ? "Validation…" : "Valider la connexion"}
      </BoutonSite>
    </form>
  );
}
