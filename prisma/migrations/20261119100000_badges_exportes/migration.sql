-- 19 novembre 2026 : trace des badges déjà partis à l'impression.
--
-- Deux colonnes nouvelles, rien d'existant n'est touché.
--
-- L'export ZIP ne laissait qu'une ligne d'audit portant des **nombres** —
-- « 394 inclus, 2 manquants » — jamais la liste des badges emportés. Il était
-- donc impossible de demander « ceux qui ne sont pas encore partis », et un
-- second envoi à l'imprimeur repartait du début.
--
-- `exportedAt` est volontairement distinct de `printedAt` : un badge confié à
-- l'imprimeur n'est pas un badge imprimé, et `printedAt` se renseigne fiche par
-- fiche depuis le BackOffice. Les confondre ferait apparaître 394 impressions
-- qui n'ont pas eu lieu.
--
-- Aucune reprise des badges déjà exportés n'est faite ici, et c'est délibéré :
-- le journal ne dit pas lesquels, donc toute valeur posée en masse maintenant
-- serait une invention. L'écran Badges porte une action explicite pour les
-- déclarer, filtre en main (`bulk.ts`, `marquerExportes`).

ALTER TABLE `Badge` ADD COLUMN `exportedAt` DATETIME(3) NULL;
ALTER TABLE `Badge` ADD COLUMN `exportCount` INTEGER NOT NULL DEFAULT 0;
