import "dotenv/config";

// File de jobs propre à chaque processus de test : les fichiers s'exécutent en
// parallèle contre le même Redis, et un worker traitait alors les jobs d'un
// autre fichier — d'où des échecs qui ne se reproduisaient jamais isolément.
process.env.QUEUE_NAME = `forum-ansd-test-${process.pid}`;
