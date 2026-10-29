-- Noms de famille en capitales (29 octobre 2026).
--
-- Le site les met désormais en majuscules à l'enregistrement
-- (`src/lib/nom-de-famille.ts`) ; cette migration aligne les fiches saisies
-- avant. Réécriture de données de production faite avec l'accord explicite de
-- l'utilisateur, donné le 29 octobre 2026.
--
-- Seuls les noms qui ne sont pas déjà en capitales sont réécrits. `BINARY`
-- compare à la casse près : la collation par défaut ne distingue pas « Diop »
-- de « DIOP ». `UPPER` garde les accents (« Diène » devient « DIÈNE »).

-- garde-donnees: noms de famille des participants mis en capitales, accord explicite de l'utilisateur le 29/10/2026
UPDATE `Participant` SET `lastName` = UPPER(`lastName`) WHERE BINARY `lastName` <> BINARY UPPER(`lastName`);

-- garde-donnees: noms de famille des intervenants mis en capitales, accord explicite de l'utilisateur le 29/10/2026
UPDATE `Speaker` SET `lastName` = UPPER(`lastName`) WHERE BINARY `lastName` <> BINARY UPPER(`lastName`);

-- garde-donnees: noms de famille des invitations mis en capitales, accord explicite de l'utilisateur le 29/10/2026
UPDATE `Invitation` SET `lastName` = UPPER(`lastName`) WHERE BINARY `lastName` <> BINARY UPPER(`lastName`);
