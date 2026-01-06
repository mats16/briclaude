const baseConfig = require('@repo/eslint-config/base');

module.exports = [
  {
    ignores: ['eslint.config.js', 'dist/**'],
  },
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
  },
];
