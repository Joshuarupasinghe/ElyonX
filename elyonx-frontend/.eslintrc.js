module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['*.config.js', 'jest.setup.js', '__mocks__/**/*.js'],
      env: {
        node: true,
        jest: true,
      },
    },
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      env: {
        jest: true,
      },
    },
    {
      files: ['e2e/**/*.js'],
      env: {
        mocha: true,
      },
      globals: {
        $: 'readonly',
        expect: 'readonly',
      },
    },
  ],
};
