-- 20 novembre 2026 : affluence de la retransmission.
--
-- Deux tables nouvelles, aucune table touchée. Rien n'est supprimé ni réécrit.
--
-- `LiveViewer` : une ligne par lecteur ouvert, identifiée par un jeton anonyme
-- tiré par le navigateur. Chaque battement met la ligne à jour plutôt que d'en
-- ajouter une : la table est bornée par le nombre de spectateurs distincts, et
-- non par la durée de la diffusion. Aucune colonne ne porte d'adresse IP ni de
-- rattachement à un participant.
--
-- `LiveAudienceSample` : un relevé du nombre de spectateurs simultanés toutes
-- les cinq minutes. La table des spectateurs ne garde que le dernier état ;
-- sans ces points, la courbe d'une journée serait impossible à reconstituer.
-- L'unicité sur (editionId, at) rend l'écriture idempotente : plusieurs
-- instances de l'application peuvent relever le même créneau sans le dupliquer.

CREATE TABLE `LiveViewer` (
    `id` VARCHAR(32) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `day` DATE NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL,

    INDEX `LiveViewer_editionId_day_idx`(`editionId`, `day`),
    INDEX `LiveViewer_editionId_lastSeenAt_idx`(`editionId`, `lastSeenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LiveAudienceSample` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `day` DATE NOT NULL,
    `at` DATETIME(3) NOT NULL,
    `viewers` INTEGER NOT NULL,

    UNIQUE INDEX `LiveAudienceSample_editionId_at_key`(`editionId`, `at`),
    INDEX `LiveAudienceSample_editionId_day_idx`(`editionId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LiveViewer` ADD CONSTRAINT `LiveViewer_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LiveAudienceSample` ADD CONSTRAINT `LiveAudienceSample_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
