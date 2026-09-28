-- Catégorie « Prestataire » renommée « Prestataire de service/Fournisseur »
-- (demande du commanditaire, 28 septembre 2026).
--
-- Migration de données, comme pour le changement de lieu : les catégories
-- vivent en base et une installation en service garderait l'ancien libellé.
-- La mise à jour est conditionnée à l'ancien texte : un libellé déjà retouché
-- en BackOffice n'est pas écrasé.

UPDATE `ParticipantCategory`
SET `labelFr` = 'Prestataire de service/Fournisseur'
WHERE `code` = 'PRESTATAIRE' AND `labelFr` = 'Prestataire';

UPDATE `ParticipantCategory`
SET `labelEn` = 'Service provider/Supplier'
WHERE `code` = 'PRESTATAIRE' AND `labelEn` = 'Service provider';
