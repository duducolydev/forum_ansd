-- Rapporteurs de session et dépôts des intervenants reliés aux contributions (PLAN.md §15).

-- AlterTable
ALTER TABLE `Contribution` ADD COLUMN `origine` ENUM('COMITE', 'INTERVENANT', 'RAPPORTEUR') NOT NULL DEFAULT 'COMITE';

-- AlterTable
ALTER TABLE `Speaker` ADD COLUMN `presentationConsentement` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `SessionRapporteur` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SessionRapporteur_userId_idx`(`userId`),
    UNIQUE INDEX `SessionRapporteur_sessionId_userId_key`(`sessionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SessionRapporteur` ADD CONSTRAINT `SessionRapporteur_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionRapporteur` ADD CONSTRAINT `SessionRapporteur_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Rôle Rapporteur.
--
-- Inséré ici et non par le seed : le seed réécrit les permissions de tous les
-- rôles à chaque passage, ce qui effacerait les ajustements faits en BackOffice
-- sur une installation déjà en service. INSERT IGNORE ne touche à rien si le
-- rôle existe déjà (contrainte d'unicité sur `name`).
INSERT IGNORE INTO `Role` (`id`, `name`, `permissions`, `createdAt`, `updatedAt`)
VALUES ('role_rapporteur', 'RAPPORTEUR', JSON_ARRAY('contributions.draft'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
