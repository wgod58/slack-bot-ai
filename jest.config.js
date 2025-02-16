export default {
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['js'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.js', '<rootDir>/test/**/*.test.js'],
  clearMocks: true,
  verbose: true,
  coveragePathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  testTimeout: 30000,
  setupFilesAfterEnv: ['./jest.setup.afterEnv.js'],
};
