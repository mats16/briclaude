import baseConfig from '@repo/eslint-config/base';

export default [
  {
    ignores: ['eslint.config.js', 'dist/**'],
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
