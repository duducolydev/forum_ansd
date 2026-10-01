-- Réseaux sociaux de l'ANSD dans le pied de page (1er octobre 2026).
--
-- Posés seulement si aucune adresse de réseau n'est encore saisie : des liens
-- réglés en BackOffice (Paramètres → Pied de page) ne sont jamais écrasés.
-- JSON_MERGE_PATCH garde les autres réglages du pied de page et remplace la
-- seule liste des réseaux.
UPDATE `Edition`
SET `settings` = JSON_MERGE_PATCH(
  COALESCE(`settings`, JSON_OBJECT()),
  JSON_OBJECT('piedDePage', JSON_OBJECT('reseaux', JSON_ARRAY(JSON_OBJECT('reseau', 'facebook', 'url', 'https://web.facebook.com/ansdsn'), JSON_OBJECT('reseau', 'linkedin', 'url', 'https://www.linkedin.com/company/agence-nationale-de-la-statistique-et-de-la-d%C3%A9mographie-ansd/'), JSON_OBJECT('reseau', 'x', 'url', 'https://x.com/statsenegal'), JSON_OBJECT('reseau', 'instagram', 'url', 'https://www.instagram.com/ansdsenegal/'), JSON_OBJECT('reseau', 'tiktok', 'url', 'https://www.tiktok.com/@ansdsenegal'))))
)
WHERE JSON_SEARCH(COALESCE(`settings`, JSON_OBJECT()), 'one', 'http%', NULL, '$.piedDePage.reseaux[*].url') IS NULL;
