"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";
import { envoyerMessageContactAction, type EtatContact } from "../actions";

const etatInitial: EtatContact = {};
const CHAMP = "border-border bg-surface text-text w-full rounded-lg border px-3 py-2.5";
const ETIQUETTE = "text-heading text-sm font-semibold";

/**
 * Formulaire « Écrire au comité » (rubrique Contacts). Le message part vers
 * la boîte du Forum ; la réponse revient à l'adresse saisie ici.
 */
export function FormulaireContact({ en }: { en: boolean }) {
  const [etat, action, enCours] = useActionState(envoyerMessageContactAction, etatInitial);
  // Heure d'ouverture du formulaire, posée au montage : un envoi dans la
  // seconde trahit un robot (cf. `actions.ts`).
  const [ouvertLe, setOuvertLe] = useState(0);
  useEffect(() => setOuvertLe(Date.now()), []);
  const refSucces = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (etat.envoye) refSucces.current?.focus();
  }, [etat.envoye]);

  if (etat.envoye) {
    return (
      <div
        ref={refSucces}
        tabIndex={-1}
        role="status"
        className="border-accent-text bg-accent-soft text-accent-text flex items-start gap-3 rounded-xl border p-6"
      >
        <CheckCircle2 aria-hidden size={22} className="mt-0.5 shrink-0" />
        <p>
          {en
            ? "Your message has been sent to the organising committee. We will reply to the address you gave."
            : "Votre message a bien été transmis au comité d'organisation. La réponse vous parviendra à l'adresse indiquée."}
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="border-border bg-surface flex flex-col gap-4 rounded-2xl border p-6"
    >
      <input type="hidden" name="ouvertLe" value={ouvertLe || ""} />
      {/* Champ piège : invisible, ignoré des lecteurs d'écran ; seul un robot le remplit. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="site_web">Site web</label>
        <input id="site_web" name="site_web" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-nom" className={ETIQUETTE}>
            {en ? "Name" : "Nom"} *
          </label>
          <input
            id="contact-nom"
            name="nom"
            required
            maxLength={120}
            autoComplete="name"
            className={CHAMP}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-email" className={ETIQUETTE}>
            {en ? "E-mail address" : "Adresse e-mail"} *
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={190}
            autoComplete="email"
            className={CHAMP}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-organisation" className={ETIQUETTE}>
            {en ? "Organisation" : "Organisation"}
          </label>
          <input
            id="contact-organisation"
            name="organisation"
            maxLength={150}
            autoComplete="organization"
            className={CHAMP}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-objet" className={ETIQUETTE}>
            {en ? "Subject" : "Objet"} *
          </label>
          <input id="contact-objet" name="objet" required maxLength={150} className={CHAMP} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className={ETIQUETTE}>
          Message *
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          className={CHAMP}
        />
      </div>

      {etat.erreur && (
        <p role="alert" className="text-danger-text text-sm">
          {etat.erreur}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-3 text-xs">
          {en
            ? "Your details are used only to answer your message."
            : "Vos coordonnées servent uniquement à répondre à votre message."}
        </p>
        <BoutonSite type="submit" ton="principal" icone={Send} disabled={enCours}>
          {enCours ? (en ? "Sending…" : "Envoi…") : en ? "Send" : "Envoyer"}
        </BoutonSite>
      </div>
    </form>
  );
}
