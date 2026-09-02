export interface FileStorage {
  put(key: string, data: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** URL publique/relative pour accéder au fichier (via une route contrôlée, pas le webroot — brief §7). */
  url(key: string): string;
}
