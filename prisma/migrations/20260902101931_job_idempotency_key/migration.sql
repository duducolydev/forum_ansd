-- AlterTable
ALTER TABLE `Job` ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Job_idempotencyKey_key` ON `Job`(`idempotencyKey`);
