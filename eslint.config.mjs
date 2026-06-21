import next from "eslint-config-next";

const eslintConfig = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    // Reglas del nuevo plugin react-hooks (estilo React Compiler) que marcan
    // patrones idiomáticos y correctos en esta app (detección post-montaje,
    // comparación con la hora actual en render). Quedan como aviso, no error.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default eslintConfig;
