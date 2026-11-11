/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/jest.pg-env.cjs'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    // Stale / misconfigured vs current sources; fix imports before re-enabling.
    'rds-connection\\.test\\.ts',
    'loyalty-points-service\\.test\\.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Allow settlement handlers that import via the Lambda `src/...` alias to resolve in Jest.
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
};
