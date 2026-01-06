import baseConfig from '@repo/eslint-config/base';

export default [
  {
    ignores: ['eslint.config.js', 'dist/**'],
  },
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
  },
];
