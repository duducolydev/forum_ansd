import type { PublicVerification } from "../public-verify";

interface Props {
  result: PublicVerification;
  /** Intitulé et dates de l'édition, pour situer le contrôle. */
  eventLabel: string;
}

/**
 * Affichage du résultat de vérification (brief §2.11) : uniquement prénom, nom,
 * organisation, pays, catégorie et validité. Jamais d'e-mail, de téléphone ni
 * de photo — le service ne les charge d'ailleurs pas.
 */
export function VerificationResult({ result, eventLabel }: Props) {
  if (result.status === "RATE_LIMITED") {
    return (
      <Panel tone="warn" icon="!" title="Trop de vérifications">
        <p className="text-text-2">
          Patientez {result.retryAfterSeconds} seconde(s) avant un nouveau contrôle.
        </p>
      </Panel>
    );
  }

  if (result.status === "UNKNOWN") {
    return (
      <Panel tone="danger" icon="✕" title="Badge non reconnu">
        <p className="text-text-2">
          Aucun badge ne correspond. Vérifiez la saisie, ou orientez la personne vers l&apos;accueil
          du Forum.
        </p>
      </Panel>
    );
  }

  if (result.status === "NOT_BADGED") {
    return (
      <Panel tone="warn" icon="!" title="Aucun badge émis">
        <p className="text-text-2">
          Cet identifiant correspond à une inscription, mais aucun badge n&apos;a encore été émis.
          Orientez la personne vers l&apos;accueil.
        </p>
      </Panel>
    );
  }

  if (result.status === "REVOKED") {
    return (
      <Panel tone="danger" icon="✕" title="Badge révoqué">
        <p className="text-text-2">
          Ce badge a été retiré et ne donne plus accès au Forum.
          {result.reason ? ` Motif : ${result.reason}.` : ""}
        </p>
        <Assurance assurance={result.assurance} />
      </Panel>
    );
  }

  if (result.status === "CANCELLED") {
    return (
      <Panel tone="danger" icon="✕" title="Participation annulée">
        <p className="text-text-2">
          Le badge existe mais la participation a été annulée : il ne donne pas accès au Forum.
        </p>
        <Assurance assurance={result.assurance} />
      </Panel>
    );
  }

  const { participant } = result;
  return (
    <Panel
      tone={result.assurance === "SIGNED" ? "ok" : "warn"}
      icon={result.assurance === "SIGNED" ? "✓" : "!"}
      title={result.assurance === "SIGNED" ? "Badge valide" : "Identifiant reconnu"}
    >
      <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm sm:grid-cols-[130px_1fr]">
        <dt className="text-text-3">Participant</dt>
        <dd className="text-heading font-semibold">
          {participant.firstName} {participant.lastName.toUpperCase()}
        </dd>

        <dt className="text-text-3">Organisation</dt>
        <dd className="text-heading">
          {[participant.organization, participant.country].filter(Boolean).join(" · ")}
        </dd>

        <dt className="text-text-3">Catégorie</dt>
        <dd className="text-heading">{participant.categoryLabel}</dd>

        <dt className="text-text-3">Identifiant</dt>
        <dd className="text-heading tracking-wider">{participant.publicId}</dd>

        <dt className="text-text-3">Évènement</dt>
        <dd className="text-heading">{eventLabel}</dd>
      </dl>

      {result.checkedIn && (
        <p className="text-text-3 mt-3 text-sm">Déjà enregistré à l&apos;entrée.</p>
      )}

      <Assurance assurance={result.assurance} />

      <p className="text-text-3 mt-3 text-xs">
        Seules les informations strictement nécessaires au contrôle sont affichées.
      </p>
    </Panel>
  );
}

/**
 * La saisie manuelle ne prouve pas l'authenticité du support : le dire, plutôt
 * que d'afficher la même coche verte que pour un QR vérifié.
 */
function Assurance({ assurance }: { assurance: "SIGNED" | "IDENTIFIER" }) {
  if (assurance === "SIGNED") {
    return (
      <p className="text-text-3 mt-3 text-xs">
        Signature du QR code vérifiée : le badge présenté est authentique.
      </p>
    );
  }
  return (
    <p className="text-warn-text mt-3 text-xs">
      Contrôle par identifiant saisi : l&apos;inscription est confirmée, mais l&apos;authenticité du
      badge lui-même n&apos;est pas vérifiée. Scannez le QR code pour un contrôle complet.
    </p>
  );
}

const TONES = {
  ok: {
    border: "border-ansd-vert-vif",
    icon: "bg-ansd-vert-vif text-white",
    title: "text-accent-text",
  },
  warn: { border: "border-warn-text", icon: "bg-warn-text text-white", title: "text-warn-text" },
  danger: {
    border: "border-danger-text",
    icon: "bg-danger-text text-white",
    title: "text-danger-text",
  },
} as const;

function Panel({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof TONES;
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  const styles = TONES[tone];
  return (
    <div className={`bg-surface mt-7 rounded-2xl border p-6 text-left ${styles.border}`}>
      <div className={`mb-4 flex items-center gap-3 font-bold ${styles.title}`}>
        <span
          className={`grid h-8 w-8 place-items-center rounded-full text-sm ${styles.icon}`}
          aria-hidden
        >
          {icon}
        </span>
        {title}
      </div>
      {children}
    </div>
  );
}
