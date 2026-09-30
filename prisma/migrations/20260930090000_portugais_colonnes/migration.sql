-- Portugais (30 septembre 2026) : un champ PT, facultatif, à côté de chaque
-- champ anglais. Vide, c'est l'anglais qui s'affiche (src/lib/langue.ts).

-- AlterTable
ALTER TABLE `ContentBlock` ADD COLUMN `valuePt` JSON NULL;

-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `titlePt` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Hotel` ADD COLUMN `descriptionPt` TEXT NULL;

-- AlterTable
ALTER TABLE `MediaAlbum` ADD COLUMN `descriptionPt` TEXT NULL,
    ADD COLUMN `titlePt` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `MediaItem` ADD COLUMN `captionPt` TEXT NULL;

-- AlterTable
ALTER TABLE `Newsletter` ADD COLUMN `bodyPt` TEXT NULL,
    ADD COLUMN `excerptPt` TEXT NULL,
    ADD COLUMN `titlePt` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `NotificationTemplate` ADD COLUMN `bodyPt` TEXT NULL,
    ADD COLUMN `subjectPt` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PageSection` ADD COLUMN `contentPt` JSON NULL;

-- AlterTable
ALTER TABLE `ParticipantCategory` ADD COLUMN `labelPt` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Post` ADD COLUMN `bodyPt` TEXT NULL,
    ADD COLUMN `excerptPt` TEXT NULL,
    ADD COLUMN `titlePt` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PracticalContact` ADD COLUMN `labelPt` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Session` ADD COLUMN `descriptionPt` TEXT NULL,
    ADD COLUMN `titlePt` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Speaker` ADD COLUMN `bioPt` TEXT NULL;

-- AlterTable
ALTER TABLE `Sponsor` ADD COLUMN `descriptionPt` TEXT NULL;

