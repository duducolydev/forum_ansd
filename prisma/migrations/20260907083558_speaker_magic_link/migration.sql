-- AlterTable
ALTER TABLE `MagicLink` ADD COLUMN `speakerId` VARCHAR(191) NULL,
    MODIFY `participantId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `MagicLink_speakerId_idx` ON `MagicLink`(`speakerId`);

-- AddForeignKey
ALTER TABLE `MagicLink` ADD CONSTRAINT `MagicLink_speakerId_fkey` FOREIGN KEY (`speakerId`) REFERENCES `Speaker`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
