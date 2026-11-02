"use client";

import { useActionState, useState } from "react";
import { useLocale } from "next-intl";
import { lireLangue, selon } from "@/lib/langue";
import { MOT_SUPPRESSION } from "../registration-i18n";
import { requestDeletionAction, type MySpaceState } from "../my-space-actions";
import { AlertCircle, CircleCheck, Trash2, X } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";

const initialState: MySpaceState = {};

export function DeletionRequest() {
  const [state, formAction, pending] = useActionState(requestDeletionAction, initialState);
  const [open, setOpen] = useState(false);
  const langue = lireLangue(useLocale());
  const t = (textes: { fr: string; en: string; pt: string }) => selon(langue, textes);

  if (state.success) {
    return (
      <p className="text-accent-text flex items-start gap-2 text-sm">
        <CircleCheck aria-hidden size={16} className="mt-0.5 shrink-0" />
        {state.success}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-3 text-sm">
        {t({
          fr: "Conformément à la loi n°\u00a02008-12 sur la protection des données à caractère personnel, vous pouvez demander la suppression de vos données. La demande est enregistrée puis traitée par le comité d'organisation.",
          en: "In accordance with Law No.\u00a02008-12 on the protection of personal data, you may request the deletion of your data. The request is recorded and then handled by the organising committee.",
          pt: "Nos termos da Lei n.º\u00a02008-12 relativa à proteção de dados pessoais, pode pedir a eliminação dos seus dados. O pedido é registado e depois tratado pela comissão organizadora.",
        })}
      </p>

      {!open ? (
        <BoutonSite
          type="button"
          onClick={() => setOpen(true)}
          taille="compact"
          icone={Trash2}
          className="w-fit"
        >
          {t({
            fr: "Demander la suppression de mes données",
            en: "Request deletion of my data",
            pt: "Pedir a eliminação dos meus dados",
          })}
        </BoutonSite>
      ) : (
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm" className="text-heading text-sm font-semibold">
              {t({ fr: "Saisissez ", en: "Type ", pt: "Escreva " })}
              <code>{selon(langue, MOT_SUPPRESSION)}</code>
              {t({ fr: " pour confirmer", en: " to confirm", pt: " para confirmar" })}
            </label>
            <input
              id="confirm"
              name="confirm"
              required
              className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="transition-tout inline-flex w-fit items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            <Trash2 aria-hidden size={16} strokeWidth={2.2} />
            {pending
              ? t({ fr: "Envoi…", en: "Sending…", pt: "A enviar…" })
              : t({
                  fr: "Confirmer la demande",
                  en: "Confirm the request",
                  pt: "Confirmar o pedido",
                })}
          </button>
          <BoutonSite
            type="button"
            onClick={() => setOpen(false)}
            ton="discret"
            taille="compact"
            icone={X}
          >
            {t({ fr: "Annuler", en: "Cancel", pt: "Cancelar" })}
          </BoutonSite>
        </form>
      )}

      {state.error && (
        <p className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle aria-hidden size={15} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
    </div>
  );
}
