const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^lucide-react(/.*)?$': '<rootDir>/lib/__tests__/mocks/lucide-react.js',
  },
};

module.exports = createJestConfig(customJestConfig);
