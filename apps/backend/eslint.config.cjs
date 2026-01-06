const baseConfig = require('@repo/eslint-config/base');

module.exports = [
  {
    ignores: ['eslint.config.cjs', 'dist/**'],
  },
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
  },
];
