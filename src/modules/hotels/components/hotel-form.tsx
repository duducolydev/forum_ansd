"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import type { ActionState } from "../actions";

interface Valeurs {
  name?: string;
  category?: string;
  address?: string;
  district?: string;
  distanceKm?: number | string;
  phone?: string;
  email?: string;
  website?: string;
  mapUrl?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  amenities?: string;
  bookingCode?: string;
  bookingUrl?: string;
  isPublished?: boolean;
  sortOrder?: number;
}

interface Props {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Valeurs;
  submitLabel: string;
}

const initialState: ActionState = {};
const CHAMP = "border-border bg-surface text-text w-full rounded-lg border px-3 py-2.5";

function Champ({
  nom,
  label,
  aide,
  children,
}: {
  nom: string;
  label: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={nom} className="text-heading text-sm font-semibold">
        {label}
      </label>
      {children}
      {aide && <span className="text-text-3 text-xs">{aide}</span>}
    </div>
  );
}

/**
 * Fiche d'un hôtel partenaire (§29).
 *
 * Les champs sont groupés dans l'ordre où l'information arrive quand on
 * négocie : l'identité de l'hôtel, puis où il se trouve, puis comment le
 * joindre, puis l'accord obtenu. Les tarifs ne sont pas ici — ils se gèrent
 * ligne par ligne sur la fiche, une fois l'hôtel créé.
 */
export function HotelForm({ action, defaultValues, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const d = defaultValues ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Champ nom="name" label="Nom de l'hôtel">
        <input id="name" name="name" required defaultValue={d.name} className={CHAMP} />
      </Champ>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Champ nom="category" label="Catégorie" aide="5 étoiles, Résidence, Appart-hôtel…">
          <input id="category" name="category" defaultValue={d.category} className={CHAMP} />
        </Champ>
        <Champ nom="district" label="Quartier">
          <input id="district" name="district" defaultValue={d.district} className={CHAMP} />
        </Champ>
        <Champ nom="address" label="Adresse">
          <input id="address" name="address" defaultValue={d.address} className={CHAMP} />
        </Champ>
        <Champ
          nom="distanceKm"
          label="Distance du Forum (km)"
          aide="Le premier critère de choix pour trois jours de navettes."
        >
          <input
            id="distanceKm"
            name="distanceKm"
            type="number"
            step="0.1"
            min={0}
            defaultValue={d.distanceKm}
            className={CHAMP}
          />
        </Champ>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Champ nom="phone" label="Téléphone">
          <input id="phone" name="phone" defaultValue={d.phone} className={CHAMP} />
        </Champ>
        <Champ nom="email" label="E-mail">
          <input id="email" name="email" type="email" defaultValue={d.email} className={CHAMP} />
        </Champ>
        <Champ nom="website" label="Site web" aide="Adresse complète, avec https://">
          <input id="website" name="website" defaultValue={d.website} className={CHAMP} />
        </Champ>
      </div>

      <Champ
        nom="mapUrl"
        label="Lien de carte"
        aide="Lien vérifié vers la position exacte : les adresses de Dakar se géocodent mal."
      >
        <input id="mapUrl" name="mapUrl" defaultValue={d.mapUrl} className={CHAMP} />
      </Champ>

      <Champ
        nom="amenities"
        label="Prestations"
        aide="Séparées par des virgules : navette, wifi, petit-déjeuner, piscine…"
      >
        <input id="amenities" name="amenities" defaultValue={d.amenities} className={CHAMP} />
      </Champ>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Champ nom="descriptionFr" label="Description (français)">
          <textarea
            id="descriptionFr"
            name="descriptionFr"
            rows={4}
            defaultValue={d.descriptionFr}
            className={CHAMP}
          />
        </Champ>
        <Champ
          nom="descriptionEn"
          label="Description (anglais)"
          aide="Vide, le français est repris."
        >
          <textarea
            id="descriptionEn"
            name="descriptionEn"
            rows={4}
            defaultValue={d.descriptionEn}
            className={CHAMP}
          />
        </Champ>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Champ
          nom="bookingCode"
          label="Code de réservation"
          aide="Jamais affiché sur le site : envoyé au participant après confirmation."
        >
          <input
            id="bookingCode"
            name="bookingCode"
            defaultValue={d.bookingCode}
            className={CHAMP}
          />
        </Champ>
        <Champ nom="bookingUrl" label="Lien de réservation">
          <input id="bookingUrl" name="bookingUrl" defaultValue={d.bookingUrl} className={CHAMP} />
        </Champ>
        <Champ nom="sortOrder" label="Ordre d'affichage" aide="0 en premier.">
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={d.sortOrder ?? 0}
            className={CHAMP}
          />
        </Champ>
      </div>

      <label className="text-text flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={d.isPublished ?? false}
          className="size-4"
        />
        Publié sur le site
        <span className="text-text-3 text-xs">
          Décoché, l&apos;hôtel reste invisible du public : le temps de saisir les tarifs et
          d&apos;obtenir l&apos;accord.
        </span>
      </label>

      {state.error && <p className="text-danger-text text-sm">{state.error}</p>}

      <div>
        <Bouton ton="principal" icone={Save} type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Bouton>
      </div>
    </form>
  );
}
