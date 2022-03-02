module.exports = {
  ...require('../../test/e2e.jest.config'),
  launch: {
    dumpio: true,
    headless: true
  },
  browserContext: 'default',
  setupFiles: ['dotenv/config', 'jest-webextension-mock']
};
