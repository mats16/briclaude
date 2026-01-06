import baseConfig from '@repo/eslint-config/base';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**'],
  },
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
