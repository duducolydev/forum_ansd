import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FileStorage } from "./types";

/** Implémentation par défaut (brief §3.1) : disque local sous `STORAGE_LOCAL_PATH`. */
export class LocalFileStorage implements FileStorage {
  constructor(private readonly rootPath: string) {}

  private resolve(key: string): string {
    return join(this.rootPath, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => undefined);
  }

  url(key: string): string {
    // Fichiers servis hors webroot (brief §7) via une route dédiée avec contrôle
    // d'accès — route non encore implémentée, à ajouter avec le premier module
    // qui expose des fichiers (ex. modules/badges, PLAN.md 3.6).
    return `/api/v1/files/${key}`;
  }
}
