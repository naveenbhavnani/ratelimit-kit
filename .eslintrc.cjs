module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    project: './tsconfig.json'
  },
  rules: {
    // Relaxed rules for flexibility while maintaining code quality
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    '@typescript-eslint/prefer-as-const': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-redeclare': 'off'
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'tests/',
    '*.config.*',
    'examples/'
  ]
};