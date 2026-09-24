-- Libellé lisible d'un rôle (demande du commanditaire, 24 septembre 2026).
--
-- Nullable, et il le reste pour les rôles du brief : le leur vient de
-- `ROLE_LABELS`, dans le code. Le dupliquer en base aurait créé deux vérités
-- qui finissent par diverger. Seuls les rôles créés depuis le BackOffice, qui
-- n'ont aucune entrée dans ce registre, le renseignent.

-- AlterTable
ALTER TABLE `Role` ADD COLUMN `label` VARCHAR(191) NULL;
