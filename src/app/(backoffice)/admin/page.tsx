import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Award,
  BadgeCheck,
  CalendarRange,
  Globe2,
  Mail,
  MapPin,
  Radio,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { getDashboardData } from "@/modules/dashboard/service";
import { StatTile } from "@/modules/dashboard/components/stat-tile";
import { BarList } from "@/modules/dashboard/components/bar-list";
import { FunnelChart } from "@/modules/dashboard/components/funnel-chart";
import { RegistrationsChart } from "@/modules/dashboard/components/registrations-chart";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "dashboard.read")) {
    // La connexion mène ici. Un rapporteur n'a que les contributions : l'y
    // conduire vaut mieux que l'arrêter sur un refus dès son arrivée (§15).
    if (can(session, "contributions.write") || can(session, "contributions.draft")) {
      redirect("/admin/contributions");
    }
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne donne pas accès au tableau de bord.
      </div>
    );
  }

  const edition = await getActiveEdition();
  const { kpis, funnel, byCountry, byCategory, byOrganization, registrationsPerDay } =
    await getDashboardData(edition.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl">Tableau de bord</h2>
          <span className="text-text-3 text-sm">
            {edition.title} — {edition.venue}
          </span>
        </div>
        <span className="bg-blue-soft text-blue-text inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold">
          <CalendarRange aria-hidden size={15} />
          Édition {edition.code}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Inscrits"
          value={kpis.registered}
          hint="Formulaire complété, validation comprise"
          icone={Users}
          ton="bleu"
          rang={0}
          emphasis
        />
        <StatTile
          label="Confirmés"
          value={kpis.confirmed}
          hint="Validés par le comité"
          icone={UserCheck}
          ton="vert"
          rang={1}
          emphasis
        />
        <StatTile
          label="Taux de confirmation"
          value={kpis.confirmationRate === null ? "—" : `${kpis.confirmationRate} %`}
          hint="Confirmés / inscrits"
          icone={TrendingUp}
          ton="or"
          rang={2}
          emphasis
        />
        <StatTile
          label="Badges valides"
          value={kpis.badgesGenerated}
          hint="Générés, révocations exclues"
          icone={BadgeCheck}
          ton="vert"
          rang={3}
          emphasis
        />
        <StatTile
          label="Invitations"
          value={kpis.invited}
          hint="Toutes invitations créées"
          icone={Mail}
          ton="neutre"
          rang={4}
        />
        <StatTile
          label="Nationaux"
          value={kpis.national}
          hint="Inscrits résidant au Sénégal"
          icone={MapPin}
          ton="neutre"
          rang={5}
        />
        <StatTile
          label="Internationaux"
          value={kpis.international}
          hint="Inscrits hors Sénégal"
          icone={Globe2}
          ton="bleu"
          rang={6}
        />
        <StatTile
          label="Autorités / VIP · Médias"
          value={`${kpis.vip} · ${kpis.media}`}
          hint="Inscrits de ces deux catégories"
          icone={Award}
          ton="or"
          rang={7}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card
          title="Entonnoir de conversion"
          subtitle="Parcours des personnes invitées ; les inscriptions spontanées n'y figurent pas. Pourcentage : passage depuis l'étape précédente."
        >
          <FunnelChart stages={funnel} />
        </Card>

        <Card
          title="Inscriptions par jour"
          subtitle="Inscrits, à la date de complétion du formulaire"
        >
          <RegistrationsChart data={registrationsPerDay} />
        </Card>

        <Card title="Répartition par pays" subtitle="Inscrits, huit premiers pays">
          <BarList data={byCountry} emptyLabel="Aucun inscrit pour l'instant." />
        </Card>

        <Card title="Répartition par catégorie" subtitle="Inscrits">
          <BarList data={byCategory} emptyLabel="Aucun inscrit pour l'instant." />
        </Card>

        <Card title="Répartition par institution" subtitle="Inscrits, huit premières institutions">
          <BarList
            data={byOrganization}
            emptyLabel="Aucune institution renseignée pour l'instant."
          />
        </Card>

        <Card title="Flux des scans" subtitle="Temps réel le jour J">
          <p className="text-text-2 flex items-start gap-2.5 text-sm">
            <Radio aria-hidden size={16} className="text-accent-text mt-0.5 shrink-0" />
            <span>
              Le flux, les taux de présence et les feuilles d&apos;émargement sont sur l&apos;écran{" "}
              <Link href="/admin/presences" className="text-link font-semibold underline">
                Présences
              </Link>
              . Il reste vide tant qu&apos;aucun point de contrôle n&apos;a scanné.
            </span>
          </p>
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-surface carte-relief rounded-xl border p-5">
      <h3 className="text-heading text-sm font-semibold">{title}</h3>
      {subtitle && <p className="text-text-3 mb-4 text-xs">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}
