// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // Scripts que se ejecutan con Node, fuera de la app.
    files: ['scripts/**/*.js', 'plugins/**/*.js'],
    languageOptions: { globals: { __dirname: 'readonly', Buffer: 'readonly' } },
  },
  {
    files: ['jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
]);
