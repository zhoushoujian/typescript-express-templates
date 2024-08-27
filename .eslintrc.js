module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: ['@szhou/eslint-config/base', '@szhou/eslint-config/typescript', '@szhou/eslint-config/prettier'],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    project: './tsconfig.json',
    createDefaultProgram: true,
  },
  rules: {},
};
