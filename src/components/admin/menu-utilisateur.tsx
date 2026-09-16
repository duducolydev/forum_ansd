"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { confirmer } from "@/components/ui/confirmer";
import { signOutAction } from "./actions";

/**
 * Pastille de l'utilisateur, cliquable, qui déplie la déconnexion.
 *
 * Le bouton de déconnexion était auparavant visible en permanence au bas du
 * menu, où il occupait une place permanente pour une action rare — et où il
 * était surtout à un clic d'une session perdue en pleine saisie. Il est
 * maintenant sous la pastille, et confirmé.
 *
 * Le repli suit les usages attendus d'un tel menu : fermeture au clic
 * extérieur, à la touche Échap, et retour du focus sur la pastille.
 */
export function MenuUtilisateur({
  userName,
  roleName,
  replie,
}: {
  userName: string;
  roleName: string;
  /** Menu réduit aux icônes : la pastille reste, les libellés disparaissent. */
  replie: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ouvert) return;

    function auClic(evenement: MouseEvent) {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuvert(false);
    }
    function auClavier(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") {
        setOuvert(false);
        declencheur.current?.focus();
      }
    }

    document.addEventListener("mousedown", auClic);
    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("mousedown", auClic);
      document.removeEventListener("keydown", auClavier);
    };
  }, [ouvert]);

  const initiales = userName
    .split(" ")
    .map((partie) => partie[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function deconnecter() {
    const confirme = await confirmer({
      titre: "Se déconnecter ?",
      texte: "Les saisies en cours qui n'ont pas été enregistrées seront perdues.",
      confirmer: "Se déconnecter",
      annuler: "Rester connecté",
      ton: "danger",
    });
    if (!confirme) return;

    setEnCours(true);
    await signOutAction();
  }

  return (
    <div ref={conteneur} className="relative">
      <button
        ref={declencheur}
        type="button"
        onClick={() => setOuvert((precedent) => !precedent)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        title={replie ? `${userName} — ${roleName}` : undefined}
        className={`transition-tout flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-white/10 ${
          ouvert ? "bg-white/10" : ""
        }`}
      >
        <span className="from-ansd-bleu-vif to-ansd-vert-vif font-display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[0.8rem] font-bold text-white shadow-sm">
          {initiales || <UserRound aria-hidden size={16} />}
        </span>
        {!replie && (
          <>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-white">{userName}</b>
              <span className="text-dark-panel-muted block truncate text-[0.74rem]">
                {roleName}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              size={16}
              className={`text-dark-panel-muted shrink-0 transition-transform ${
                ouvert ? "rotate-180" : ""
              }`}
            />
          </>
        )}
      </button>

      {ouvert && (
        <div
          role="menu"
          className="border-dark-panel-line bg-dark-panel absolute bottom-full left-0 z-20 mb-2 w-full min-w-[190px] rounded-xl border p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)]"
        >
          {replie && (
            <div className="border-dark-panel-line mb-1 border-b px-2.5 pb-2">
              <b className="block truncate text-sm text-white">{userName}</b>
              <span className="text-dark-panel-muted block truncate text-[0.74rem]">
                {roleName}
              </span>
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            disabled={enCours}
            onClick={() => void deconnecter()}
            className="transition-tout text-dark-panel-muted flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[0.88rem] hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            <LogOut aria-hidden size={16} />
            {enCours ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      )}
    </div>
  );
}
