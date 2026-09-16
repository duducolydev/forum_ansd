import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Image Docker de production allégée (Dockerfile, docker/) — brief §11.
  output: "standalone",
  experimental: {
    /*
     * Les Server Actions acceptent 1 Mo par défaut : une photo de badge y tient
     * largement (recadrée à 512 px, ~60 Ko), mais la marge est trop mince face
     * à un navigateur qui enverrait l'original. La limite est portée à 3 Mo,
     * au-dessus du plafond de 2 Mo appliqué côté serveur — un fichier trop
     * lourd doit être **refusé avec un message**, pas rejeté par la plateforme
     * avec une erreur opaque.
     */
    serverActions: { bodySizeLimit: "3mb" },
  },

  /**
   * L'ancienne page « À propos » est devenue une section de l'accueil (§12).
   *
   * La redirection est **permanente** parce que le déplacement l'est : elle
   * apprend aux moteurs que l'adresse a bougé, et transfère au passage le
   * référencement acquis. Sans elle, l'URL figurerait encore dans les résultats
   * de recherche, dans les signets et dans les courriels déjà envoyés, et
   * répondrait 404.
   *
   * La destination porte l'ancre : le visiteur arrive **sur** la section, pas
   * en haut d'une page longue qu'il devrait parcourir pour retrouver ce qu'il
   * cherchait.
   */
  async redirects() {
    return [{ source: "/a-propos", destination: "/#a-propos", permanent: true }];
  },
};

export default withNextIntl(nextConfig);
