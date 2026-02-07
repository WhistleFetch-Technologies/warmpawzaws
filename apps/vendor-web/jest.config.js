/** @type {import('jest').Config} */
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: __dirname });
module.exports = createJestConfig({
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
});
