import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // no-undef is off by default in Next's config because it is redundant under
    // TypeScript. This project is plain JavaScript, so nothing else catches a
    // name that does not exist: `npm run build` compiles it happily and the
    // page throws in the browser. A dropped import once took My Subjects down
    // this way, so it is on.
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-undef": "error",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
