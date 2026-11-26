-- 25 novembre 2026 : newsletters en fichier joint, envoi réparti entre les boîtes.
--
-- Des colonnes ajoutées, toutes facultatives ou à défaut : rien n'est supprimé
-- ni réécrit. Les newsletters déjà publiées gardent leur corps mis en forme.
--
-- `Newsletter` : le fichier de synthèse (PDF), son nom d'origine, son poids, le
-- nombre de téléchargements, la population visée et le plan d'envoi retenu.
--
-- `NotificationLog.boite` : la boîte qui a porté chaque message. Les lignes
-- antérieures restent à NULL ; leur boîte se déduit alors du modèle.

ALTER TABLE `Newsletter`
    ADD COLUMN `filePath` VARCHAR(191) NULL,
    ADD COLUMN `fileName` VARCHAR(191) NULL,
    ADD COLUMN `fileSize` INTEGER NULL,
    ADD COLUMN `downloadCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `audience` JSON NULL,
    ADD COLUMN `envoi` JSON NULL;

ALTER TABLE `NotificationLog`
    ADD COLUMN `boite` VARCHAR(20) NULL;

CREATE INDEX `NotificationLog_boite_createdAt_idx` ON `NotificationLog`(`boite`, `createdAt`);
