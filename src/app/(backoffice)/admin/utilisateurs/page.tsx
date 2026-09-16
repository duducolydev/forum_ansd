import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/permissions";
import * as service from "@/modules/users/service";
import { FormulaireCreation } from "@/modules/users/components/formulaire-creation";
import { CarteUtilisateur } from "@/modules/users/components/carte-utilisateur";

export const metadata = { title: "Utilisateurs" };

/**
 * Comptes BackOffice (brief §5.14).
 *
 * Écran réservé à `users.manage`, que seul le SUPER_ADMIN porte par défaut :
 * l'ADMIN_FORUM en est explicitement privé (§12), pour que la maîtrise des
 * accès ne se confonde pas avec la conduite du Forum.
 */
export default async function UtilisateursPage() {
  const session = await auth();
  if (!session?.user || !can(session, "users.manage")) {
    redirect("/admin");
  }

  const [utilisateurs, roles] = await Promise.all([
    service.listerUtilisateurs(),
    service.listerRoles(),
  ]);

  const actifs = utilisateurs.filter((utilisateur) => utilisateur.isActive).length;
  const rolesSimples = roles.map((role) => ({ id: role.id, name: role.name }));

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl">Utilisateurs</h2>
        <span className="text-text-3 text-sm">
          {actifs} compte{actifs > 1 ? "s" : ""} actif{actifs > 1 ? "s" : ""} sur{" "}
          {utilisateurs.length}
        </span>
      </div>

      <FormulaireCreation roles={rolesSimples} />

      <div className="flex flex-col gap-4">
        {utilisateurs.map((utilisateur) => (
          <CarteUtilisateur
            key={utilisateur.id}
            estMoi={utilisateur.id === session.user.id}
            roles={rolesSimples}
            utilisateur={{
              id: utilisateur.id,
              email: utilisateur.email,
              name: utilisateur.name,
              isActive: utilisateur.isActive,
              totpEnabled: utilisateur.totpEnabled,
              exigeDeuxFacteurs: service.exigeDeuxFacteurs(utilisateur.role.name),
              lastLoginAt: utilisateur.lastLoginAt,
              lockedUntil: utilisateur.lockedUntil,
              roleId: utilisateur.role.id,
              roleName: utilisateur.role.name,
            }}
          />
        ))}
      </div>

      <div className="border-border bg-surface mt-6 rounded-xl border p-5">
        <h3 className="text-heading mb-1 text-sm font-semibold">Rôles et droits</h3>
        <p className="text-text-3 mb-3 text-xs">
          Les permissions de chaque rôle sont fixées au déploiement (§12) et se modifient en base.
          Elles sont relues à chaque requête : un rôle changé ici prend effet immédiatement pour la
          personne concernée.
        </p>
        <div className="flex flex-col gap-2">
          {roles.map((role) => {
            const permissions = ((role.permissions as string[] | null) ?? []).length;
            return (
              <div key={role.id} className="text-text-2 flex items-baseline gap-3 text-sm">
                <span className="text-heading min-w-[220px] font-semibold">
                  {ROLE_LABELS[role.name] ?? role.name}
                </span>
                <span className="text-text-3 text-xs">
                  {permissions} permission{permissions > 1 ? "s" : ""}
                  {service.exigeDeuxFacteurs(role.name) ? " — second facteur obligatoire" : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
