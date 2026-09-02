import { LocalFileStorage } from "./local-storage";
import type { FileStorage } from "./types";

export type { FileStorage } from "./types";

function createFileStorage(): FileStorage {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver !== "local") {
    // S3-compatible (MinIO) prévu par le brief §3.1, non implémenté à ce stade.
    throw new Error(`Pilote de stockage "${driver}" non implémenté (seul "local" est disponible).`);
  }
  return new LocalFileStorage(process.env.STORAGE_LOCAL_PATH ?? "./storage");
}

export const fileStorage = createFileStorage();
