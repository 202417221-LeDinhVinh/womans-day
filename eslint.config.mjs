import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // The ported celebration code uses intentional patterns the new react-hooks
  // rules flag by default (ref mirrors written during render, setState-in-effect
  // for mount hydration, latest-ref assignment). These are the exact patterns the
  // feature shipped with in ronansat-platform — documented at each call site —
  // so they report as warnings here, not errors. New code should still prefer
  // the rules' guidance.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
]);
