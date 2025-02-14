module.exports = {
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  extends: ['standard', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['simple-import-sort', 'prettier'],
  rules: {
    quotes: [2, 'single', { avoidEscape: true }],
    'comma-dangle': ['error', 'always-multiline'],
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
  },
};
