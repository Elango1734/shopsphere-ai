/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@shopsphere/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.json' }]
  },
  testMatch: ['<rootDir>/tests/**/*.spec.ts'],
  setupFiles: ['<rootDir>/tests/setup/silenceLogs.ts'],
  testTimeout: 60000,
  maxWorkers: 1,
  // mongodb-memory-server spawns a real mongod subprocess per replica set; across 17 suites some file
  // descriptor/handle from that process pool is not released before Jest tries to exit (a known
  // characteristic of the library, not a leak in application code — the real server exits cleanly on
  // SIGINT/SIGTERM via src/server.ts). Without this, the test run otherwise completes successfully and then
  // the Jest process itself hangs indefinitely rather than exiting.
  forceExit: true
};

export default config;
