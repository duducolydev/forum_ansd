"use client";

import { useActionState } from "react";
import { saveSessionAction, type ActionState } from "../actions";
import { SESSION_TYPES, TYPE_LABELS } from "../schema";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};

const champ = "border-border bg-bg text-text rounded-lg border px-3 py-2 text-sm w-full";
const bloc = "flex flex-col gap-1.5";
const etiquette = "text-text-3 text-xs font-semibold";

export interface SessionFormValues {
  id?: string;
  slug: string;
  type: string;
  number: number | null;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  objectives: string;
  theme: string;
  day: string;
  startTime: string;
  endTime: string;
  roomId: string;
  capacity: number | null;
  registrationOpen: boolean;
  registrationDeadline: string;
  waitlistEnabled: boolean;
  vipQuota: number | null;
  liveStreamUrl: string;
  isPublished: boolean;
}

/**
 * Formulaire de session.
 *
 * Champs **non contrôlés** (`defaultValue`) avec `action={formAction}` : c'est
 * le motif éprouvé du reste du BackOffice. Un état React sur ces champs nous a
 * coûté cher au formulaire d'inscription, où React sérialisait sa propre vue
 * plutôt que celle de l'utilisateur.
 */
export function SessionForm({
  valeurs,
  salles,
}: {
  valeurs: SessionFormValues;
  salles: { id: string; name: string; capacity: number | null }[];
}) {
  const [state, formAction, pending] = useActionState(saveSessionAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {valeurs.id && <input type="hidden" name="id" value={valeurs.id} />}

      <section className="border-border bg-surface rounded-xl border p-5">
        <h3 className="text-heading mb-4 text-sm font-semibold">Identité</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={bloc}>
            <label htmlFor="titleFr" className={etiquette}>
              Titre (français) *
            </label>
            <input
              id="titleFr"
              name="titleFr"
              required
              maxLength={200}
              defaultValue={valeurs.titleFr}
              className={champ}
            />
          </div>
          <div className={bloc}>
            <label htmlFor="titleEn" className={etiquette}>
              Titre (anglais) — repli sur le français si vide
            </label>
            <input
              id="titleEn"
              name="titleEn"
              maxLength={200}
              defaultValue={valeurs.titleEn}
              className={champ}
            />
          </div>
          <div className={bloc}>
            <label htmlFor="type" className={etiquette}>
              Type *
            </label>
            <select id="type" name="type" defaultValue={valeurs.type} className={champ}>
              {SESSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className={bloc}>
              <label htmlFor="number" className={etiquette}>
                Numéro
              </label>
              <input
                id="number"
                name="number"
                type="number"
                min={1}
                defaultValue={valeurs.number ?? ""}
                className={champ}
              />
            </div>
            <div className={bloc}>
              <label htmlFor="theme" className={etiquette}>
                Thème
              </label>
              <input
                id="theme"
                name="theme"
                maxLength={120}
                defaultValue={valeurs.theme}
                className={champ}
              />
            </div>
          </div>
          <div className={`${bloc} md:col-span-2`}>
            <label htmlFor="slug" className={etiquette}>
              Adresse publique — laissée vide, elle est dérivée du titre
            </label>
            <input
              id="slug"
              name="slug"
              maxLength={150}
              defaultValue={valeurs.slug}
              placeholder="panel-donnees-climat"
              className={`${champ} font-mono`}
            />
          </div>
        </div>
      </section>

      <section className="border-border bg-surface rounded-xl border p-5">
        <h3 className="text-heading mb-4 text-sm font-semibold">Horaire et salle</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className={bloc}>
            <label htmlFor="day" className={etiquette}>
              Jour *
            </label>
            <input
              id="day"
              name="day"
              type="date"
              required
              defaultValue={valeurs.day}
              className={champ}
            />
          </div>
          <div className={bloc}>
            <label htmlFor="startTime" className={etiquette}>
              Début *
            </label>
            <input
              id="startTime"
              name="startTime"
              type="time"
              required
              defaultValue={valeurs.startTime}
              className={champ}
            />
          </div>
          <div className={bloc}>
            <label htmlFor="endTime" className={etiquette}>
              Fin *
            </label>
            <input
              id="endTime"
              name="endTime"
              type="time"
              required
              defaultValue={valeurs.endTime}
              className={champ}
            />
          </div>
          <div className={bloc}>
            <label htmlFor="roomId" className={etiquette}>
              Salle
            </label>
            <select id="roomId" name="roomId" defaultValue={valeurs.roomId} className={champ}>
              <option value="">Sans salle (moment commun)</option>
              {salles.map((salle) => (
                <option key={salle.id} value={salle.id}>
                  {salle.name}
                  {salle.capacity ? ` (${salle.capacity})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="border-border bg-surface rounded-xl border p-5">
        <h3 className="text-heading mb-1 text-sm font-semibold">Réservation</h3>
        <p className="text-text-3 mb-4 text-xs">
          Une session ouverte à la réservation doit avoir une capacité : sans elle, il n&apos;y a
          pas de limite à faire respecter.
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className={bloc}>
            <label htmlFor="capacity" className={etiquette}>
              Capacité
            </label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={valeurs.capacity ?? ""}
              className={champ}
            />
          </div>
          <div className={bloc}>
            <label htmlFor="vipQuota" className={etiquette}>
              Quota VIP réservé
            </label>
            <input
              id="vipQuota"
              name="vipQuota"
              type="number"
              min={0}
              defaultValue={valeurs.vipQuota ?? ""}
              className={champ}
            />
          </div>
          <div className={bloc}>
            <label htmlFor="registrationDeadline" className={etiquette}>
              Clôture des réservations
            </label>
            <input
              id="registrationDeadline"
              name="registrationDeadline"
              type="date"
              defaultValue={valeurs.registrationDeadline}
              className={champ}
            />
          </div>
          <div className="flex flex-col gap-2 pt-5">
            <label className="text-text-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="registrationOpen"
                defaultChecked={valeurs.registrationOpen}
                className="accent-primary h-4 w-4"
              />
              Réservation ouverte
            </label>
            <label className="text-text-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="waitlistEnabled"
                defaultChecked={valeurs.waitlistEnabled}
                className="accent-primary h-4 w-4"
              />
              Liste d&apos;attente
            </label>
          </div>
        </div>
      </section>

      <section className="border-border bg-surface rounded-xl border p-5">
        <h3 className="text-heading mb-4 text-sm font-semibold">Contenu</h3>
        <div className="flex flex-col gap-4">
          <div className={bloc}>
            <label htmlFor="descriptionFr" className={etiquette}>
              Présentation (français)
            </label>
            <textarea
              id="descriptionFr"
              name="descriptionFr"
              rows={4}
              maxLength={5000}
              defaultValue={valeurs.descriptionFr}
              className={champ}
            />
          </div>
          <div className={bloc}>
            <label htmlFor="descriptionEn" className={etiquette}>
              Présentation (anglais)
            </label>
            <textarea
              id="descriptionEn"
              name="descriptionEn"
              rows={3}
              maxLength={5000}
              defaultValue={valeurs.descriptionEn}
              className={champ}
            />
          </div>
          <div className={bloc}>
            <label htmlFor="objectives" className={etiquette}>
              Objectifs
            </label>
            <textarea
              id="objectives"
              name="objectives"
              rows={3}
              maxLength={3000}
              defaultValue={valeurs.objectives}
              className={champ}
            />
          </div>
          <div className={bloc}>
            <label htmlFor="liveStreamUrl" className={etiquette}>
              Lien de diffusion en direct
            </label>
            <input
              id="liveStreamUrl"
              name="liveStreamUrl"
              type="url"
              defaultValue={valeurs.liveStreamUrl}
              placeholder="https://…"
              className={champ}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <label className="text-text-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={valeurs.isPublished}
            className="accent-primary h-4 w-4"
          />
          Publier sur le site
        </label>
        <Bouton ton="principal" icone={Save} type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Bouton>
        {state.error && <p className="text-danger-text text-sm">{state.error}</p>}
        {state.message && !state.error && <p className="text-text-3 text-sm">{state.message}</p>}
      </div>
    </form>
  );
}
