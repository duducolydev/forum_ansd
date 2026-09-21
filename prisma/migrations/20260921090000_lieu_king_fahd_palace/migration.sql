-- Changement de lieu (PLAN.md §24) : le Forum se tient à l'Hôtel King Fahd
-- Palace, à Dakar, et non plus au CICAD de Diamniadio.
--
-- Le lieu et les textes pratiques vivent en base, pas dans le code : le seed ne
-- les réécrit pas sur une base existante (`edition.upsert` a un `update` vide),
-- et une installation déjà en service garderait l'ancien lieu. D'où cette
-- migration de données.
--
-- Chaque mise à jour est **conditionnée à l'ancien texte** : un contenu déjà
-- corrigé depuis le BackOffice n'est pas écrasé par celui-ci.

UPDATE `Edition`
SET `venue` = 'Hôtel King Fahd Palace'
WHERE `venue` = 'CICAD, Diamniadio';

UPDATE `ContentBlock`
SET `valueFr` = JSON_QUOTE('Hôtel King Fahd Palace. Route des Almadies, Dakar'),
    `valueEn` = JSON_QUOTE('King Fahd Palace Hotel. Almadies Road, Dakar')
WHERE `key` = 'practical.venue' AND CAST(`valueFr` AS CHAR) LIKE '%CICAD%';

UPDATE `ContentBlock`
SET `valueFr` = JSON_QUOTE('Aéroport international Blaise Diagne (AIBD). Navettes prévues pour les délégations sur présentation du badge.'),
    `valueEn` = JSON_QUOTE('Blaise Diagne International Airport (AIBD). Shuttles provided for delegations upon presentation of the badge.')
WHERE `key` = 'practical.arrival' AND CAST(`valueFr` AS CHAR) LIKE '%CICAD%';

UPDATE `ContentBlock`
SET `valueFr` = JSON_QUOTE('Tarifs négociés à l''Hôtel King Fahd Palace, sur le lieu du Forum, et dans des hôtels partenaires de Dakar. Le code de réservation est envoyé après confirmation de votre inscription.'),
    `valueEn` = JSON_QUOTE('Negotiated rates at the King Fahd Palace Hotel, the Forum venue itself, and at partner hotels in Dakar. The booking code is sent after your registration is confirmed.')
WHERE `key` = 'practical.accommodation' AND CAST(`valueFr` AS CHAR) LIKE '%Diamniadio%';

UPDATE `ContentBlock`
SET `valueFr` = JSON_QUOTE('Navettes entre les hôtels partenaires et le King Fahd Palace, matin et soir. Parking sur place pour les participants.'),
    `valueEn` = JSON_QUOTE('Shuttles between partner hotels and the King Fahd Palace, morning and evening. On-site parking for participants.')
WHERE `key` = 'practical.transport' AND CAST(`valueFr` AS CHAR) LIKE '%CICAD%';

-- Rappels J-7 et J-1 : une substitution ciblée, qui laisse le reste du message
-- intact (dates, consignes de badge, signature).
UPDATE `NotificationTemplate`
SET `bodyFr` = REPLACE(`bodyFr`, 'au CICAD de Diamniadio', 'à l''Hôtel King Fahd Palace, à Dakar'),
    `bodyEn` = REPLACE(`bodyEn`, 'at CICAD, Diamniadio', 'at the King Fahd Palace Hotel in Dakar')
WHERE `key` IN ('reminder_j7', 'reminder_j1');
