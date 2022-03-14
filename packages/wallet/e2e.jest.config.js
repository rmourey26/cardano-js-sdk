module.exports = {
  ...require('../../test/e2e.jest.config'),
  testEnvironment: 'jsdom',
  setupFiles: ['dotenv/config', 'jest-webextension-mock']
};
