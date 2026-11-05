-- Biographie commune au participant et à sa fiche intervenant (5 novembre 2026,
-- `src/modules/speakers/biographie.ts`).
--
-- Remplissage seulement : le côté vide reprend la biographie de l'autre. Deux
-- biographies déjà rédigées ne sont pas touchées ; la prochaine modification,
-- d'un côté ou de l'autre, les alignera.

UPDATE `Speaker` s
  JOIN `Participant` p ON p.`id` = s.`participantId`
SET s.`bioFr` = p.`bio`
WHERE s.`bioFr` IS NULL
  AND p.`bio` IS NOT NULL;

UPDATE `Participant` p
  JOIN `Speaker` s ON s.`participantId` = p.`id`
SET p.`bio` = s.`bioFr`
WHERE p.`bio` IS NULL
  AND s.`bioFr` IS NOT NULL;
