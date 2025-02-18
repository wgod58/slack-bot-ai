module.exports = {
  env: {
    es2021: true,
    node: true,
    jest: true,
  },
  extends: ['standard', 'plugin:prettier/recommended'],
  plugins: ['prettier', 'n', 'promise', 'simple-import-sort'],
  overrides: [
    {
      env: {
        node: true,
      },
      files: ['.eslintrc.{js,cjs}'],
      parserOptions: {
        sourceType: 'script',
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    quotes: [2, 'single', { avoidEscape: true }],
    'comma-dangle': ['error', 'always-multiline'],
    'prettier/prettier': 'error',
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'n/no-callback-literal': 'off',
  },
};
