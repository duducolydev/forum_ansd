import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Image Docker de production allégée (Dockerfile, docker/) — brief §11.
  output: "standalone",
};

export default withNextIntl(nextConfig);
