module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "import/no-unresolved": 0,
    "indent": "off",
    "max-len": "off",
    "object-curly-spacing": "off",
    "quotes": "off",
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "linebreak-style": 0,
  },
};
