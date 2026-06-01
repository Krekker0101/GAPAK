import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const compat = new FlatCompat({
  baseDirectory: currentDirectory,
});

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "dist/**", "coverage/**"],
  },
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
