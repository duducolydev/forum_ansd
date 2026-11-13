-- 13 novembre 2026 : dernier état annoncé d'une session.
--
-- Deux colonnes nouvelles, rien d'existant n'est touché. Elles retiennent ce
-- que les inscrits et les intervenants savent déjà d'une session — jour,
-- horaire, salle, intitulé — pour que le bouton « Prévenir les inscrits »
-- n'annonce que l'écart avec cet état.
--
-- Aucune reprise des sessions déjà publiées n'est faite ici, et c'est
-- volontaire : un état annoncé posé en masse maintenant serait une affirmation
-- que personne ne peut vérifier. Le code s'en charge au premier changement —
-- il prend alors comme état connu celui d'**avant** la modification, qui est
-- bien celui que le public avait sous les yeux (`sessions/service.ts`).

ALTER TABLE `Session` ADD COLUMN `announcedState` JSON NULL;
ALTER TABLE `Session` ADD COLUMN `announcedAt` DATETIME(3) NULL;
