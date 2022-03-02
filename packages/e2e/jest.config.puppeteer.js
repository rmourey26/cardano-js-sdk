module.exports = {
  ...require('../../test/e2e.jest.config'),
  globalSetup: './test/jest-puppeteer.global-setup.ts',
  preset: 'jest-puppeteer',
  setupFilesAfterEnv: ['<rootDir>/test/jest-puppeteer.setup.ts'],
  transform: {
    '^.+\\.ts?$': 'ts-jest'
  },
  testPathIgnorePatterns: ['/node_modules/', 'dist'],
  testTimeout: 600_000,
  setupFiles: ['dotenv/config', 'jest-webextension-mock'],
  moduleNameMapper: {
    '^lodash-es$': 'lodash'
  }
};
