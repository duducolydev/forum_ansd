-- AlterTable
ALTER TABLE `ParticipantCategory` ADD COLUMN `alertOnScan` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `ScanLog` MODIFY `result` ENUM('OK', 'ALREADY', 'DENIED_ZONE', 'DENIED_STATUS', 'REVOKED', 'UNKNOWN') NOT NULL;
