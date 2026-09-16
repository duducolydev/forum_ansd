import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // `k6/**` tourne dans le moteur k6, pas dans Node ni dans Next : ses
    // scripts importent des modules distants et doivent exporter une
    // fonction anonyme par défaut, ce que nos règles interdisent à juste
    // titre pour le code de l'application.
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "k6/**"],
  },
  {
    rules: {
      // Convention pour les paramètres volontairement inutilisés (interfaces/stubs).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
