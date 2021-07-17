module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: ['@shuyun-ep-team/eslint-config'],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    project: './tsconfig.json',
    createDefaultProgram: true,
  },
  rules: {
    'global-require': 'off',
  },
};
