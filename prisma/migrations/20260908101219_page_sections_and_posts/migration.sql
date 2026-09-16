-- AlterTable
ALTER TABLE `Post` ADD COLUMN `excerptEn` TEXT NULL,
    ADD COLUMN `excerptFr` TEXT NULL,
    ADD COLUMN `gallery` JSON NULL;

-- CreateTable
CREATE TABLE `PageSection` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `page` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `variant` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isVisible` BOOLEAN NOT NULL DEFAULT true,
    `settings` JSON NOT NULL,
    `contentFr` JSON NOT NULL,
    `contentEn` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PageSection_editionId_page_sortOrder_idx`(`editionId`, `page`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PageSection` ADD CONSTRAINT `PageSection_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
