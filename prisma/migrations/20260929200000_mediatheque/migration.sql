-- Médiathèque (29 septembre 2026) : albums, photos et vidéos.
-- CreateTable
CREATE TABLE `MediaAlbum` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `titleFr` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NOT NULL,
    `descriptionFr` TEXT NULL,
    `descriptionEn` TEXT NULL,
    `eventDate` DATETIME(3) NULL,
    `coverItemId` VARCHAR(191) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MediaAlbum_editionId_slug_key`(`editionId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaItem` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `albumId` VARCHAR(191) NULL,
    `type` ENUM('PHOTO', 'VIDEO') NOT NULL,
    `filePath` VARCHAR(191) NULL,
    `thumbPath` VARCHAR(191) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `videoProvider` VARCHAR(191) NULL,
    `videoId` VARCHAR(191) NULL,
    `captionFr` TEXT NULL,
    `captionEn` TEXT NULL,
    `credit` VARCHAR(191) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MediaItem_editionId_albumId_sortOrder_idx`(`editionId`, `albumId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MediaAlbum` ADD CONSTRAINT `MediaAlbum_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaItem` ADD CONSTRAINT `MediaItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaItem` ADD CONSTRAINT `MediaItem_albumId_fkey` FOREIGN KEY (`albumId`) REFERENCES `MediaAlbum`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

