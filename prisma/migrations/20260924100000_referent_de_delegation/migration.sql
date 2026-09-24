-- Référent interne d'une délégation (demande du commanditaire, 24 septembre 2026).
--
-- `Referent` est une table à part et non trois colonnes sur `Delegation` : un même
-- référent suit plusieurs délégations, et son numéro se corrige alors d'un seul geste.
-- Le lien est en SET NULL : retirer un référent de l'annuaire ne doit pas emporter
-- les délégations qu'il accompagnait.

-- AlterTable
ALTER TABLE `Delegation` ADD COLUMN `referentId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Referent` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Referent_editionId_idx`(`editionId`),
    UNIQUE INDEX `Referent_editionId_email_key`(`editionId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Delegation_referentId_idx` ON `Delegation`(`referentId`);

-- AddForeignKey
ALTER TABLE `Delegation` ADD CONSTRAINT `Delegation_referentId_fkey` FOREIGN KEY (`referentId`) REFERENCES `Referent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Referent` ADD CONSTRAINT `Referent_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
