-- Newsletter : information publiée sur le site et envoyée aux participants
-- (demande du commanditaire, 24 septembre 2026).
--
-- Table à part des actualités : une actualité se publie, une newsletter
-- s'envoie. `sentAt` marque un acte irréversible — mille messages partis ne
-- se rappellent pas.

-- CreateTable
CREATE TABLE `Newsletter` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `titleFr` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NOT NULL,
    `excerptFr` TEXT NOT NULL,
    `excerptEn` TEXT NOT NULL,
    `bodyFr` TEXT NOT NULL,
    `bodyEn` TEXT NOT NULL,
    `coverPath` VARCHAR(191) NULL,
    `images` JSON NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Newsletter_editionId_publishedAt_idx`(`editionId`, `publishedAt`),
    UNIQUE INDEX `Newsletter_editionId_slug_key`(`editionId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Newsletter` ADD CONSTRAINT `Newsletter_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
