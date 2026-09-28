/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.[jt]s?(x)'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    // env.ts touches `import.meta.env`, which can't be parsed under the
    // CommonJS module target these tests use — swap it for a plain mock.
    '^\\./env$': '<rootDir>/src/lib/env.mock.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/main.tsx',
    '!src/lib/env.ts',
    '!src/lib/env.mock.ts',
    // A one-line wrapper around window.location.reload() — jsdom's real
    // Location object can't be stubbed (non-configurable own properties),
    // so this file exists purely to be jest.mock()'d by its caller's tests.
    '!src/lib/reload.ts',
    '!src/**/*.spec.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
