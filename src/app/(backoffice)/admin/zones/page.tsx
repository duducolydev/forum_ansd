import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/access/service";
import { MatrixForm } from "@/modules/access/components/matrix-form";
import { ZoneRowForm } from "@/modules/access/components/zone-row-form";
import { CheckpointRowForm } from "@/modules/access/components/checkpoint-row-form";
import { OverridePanel } from "@/modules/access/components/override-panel";

export const dynamic = "force-dynamic";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default async function ZonesPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "zones.manage")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne permet pas de configurer les accès par zone.
      </div>
    );
  }

  const edition = await getActiveEdition();
  const [matrice, zones, checkpoints, overrides] = await Promise.all([
    service.getAccessMatrix(edition.id),
    service.listZones(edition.id),
    service.listCheckpoints(edition.id),
    service.listOverrides(edition.id),
  ]);

  const zonesSimples = matrice.zones;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl">Zones d&apos;accès</h2>
        <p className="text-text-3 text-sm">
          Qui entre où, le jour J. Ces réglages pilotent le scanner des points de contrôle, y
          compris hors connexion.
        </p>
      </div>

      <section className="border-border bg-surface rounded-xl border p-5">
        <h3 className="text-heading mb-1 text-sm font-semibold">Matrice catégorie × zone</h3>
        <p className="text-text-3 mb-4 text-xs">
          Une case cochée ouvre la zone à toute la catégorie. Les accès individuels s&apos;accordent
          plus bas, en exception.
        </p>
        <MatrixForm
          categories={matrice.categories}
          zones={zonesSimples}
          allowed={[...matrice.allowed]}
        />
      </section>

      <section>
        <h3 className="text-heading mb-1 text-sm font-semibold">Zones</h3>
        <p className="text-text-3 mb-3 text-xs">
          Le code voyage jusqu&apos;au scanner : le modifier après le début du Forum invaliderait
          les manifestes déjà téléchargés sur les appareils.
        </p>
        <div className="flex flex-col gap-3">
          {zones.map((zone) => (
            <ZoneRowForm
              key={zone.id}
              zone={{
                id: zone.id,
                code: zone.code,
                name: zone.name,
                description: zone.description,
                checkpoints: zone._count.checkpoints,
                categories: zone._count.categoryZones,
                overrides: zone._count.overrides,
              }}
            />
          ))}
          <ZoneRowForm />
        </div>
      </section>

      <section>
        <h3 className="text-heading mb-1 text-sm font-semibold">Points de contrôle</h3>
        <p className="text-text-3 mb-3 text-xs">
          Un point par poste physique. Un point qui a déjà scanné se désactive, il ne se supprime
          pas.
        </p>
        <div className="flex flex-col gap-3">
          {checkpoints.map((checkpoint) => (
            <CheckpointRowForm
              key={checkpoint.id}
              zones={zonesSimples}
              checkpoint={{
                id: checkpoint.id,
                name: checkpoint.name,
                zoneId: checkpoint.zoneId,
                deviceLabel: checkpoint.deviceLabel,
                isActive: checkpoint.isActive,
                scans: checkpoint._count.scanLogs,
              }}
            />
          ))}
          {zonesSimples.length > 0 && <CheckpointRowForm zones={zonesSimples} />}
        </div>
      </section>

      <section>
        <h3 className="text-heading mb-1 text-sm font-semibold">Exceptions individuelles</h3>
        <p className="text-text-3 mb-3 text-xs">
          Un accès supplémentaire, nominatif et motivé. Une exception ajoute une zone ; elle
          n&apos;en retire jamais.
        </p>
        <OverridePanel
          zones={zonesSimples}
          overrides={overrides.map((ligne) => ({
            id: ligne.id,
            createdAt: dateCourte.format(ligne.createdAt),
            zoneCode: ligne.zone.code,
            zoneName: ligne.zone.name,
            participantPublicId: ligne.participant.publicId,
            participantName: `${ligne.participant.firstName} ${ligne.participant.lastName}`,
            organization: ligne.participant.organization,
            reason: ligne.reason,
            grantedBy: ligne.grantedBy?.name ?? null,
          }))}
        />
      </section>
    </div>
  );
}
