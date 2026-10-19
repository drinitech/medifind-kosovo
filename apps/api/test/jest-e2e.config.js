/** End-to-end tests: the real Nest app against a disposable Postgres database (TEST_DATABASE_URL). */
module.exports = {
  rootDir: '.',
  testRegex: '.*\.e2e-spec\.ts$',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  globalSetup: '<rootDir>/global-setup.ts',
  setupFiles: ['<rootDir>/load-test-env.ts'],
  testTimeout: 60000,
};
