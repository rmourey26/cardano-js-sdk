module.exports = {
  ...require('../../test/e2e.jest.config'),
  moduleNameMapper: {
    '^lodash-es$': 'lodash'
  },
  preset: 'jest-puppeteer',
  setupFiles: ['dotenv/config'],
  testRegex: '(/e2e/.*puppeteer.(test|spec))\\.[jt]sx?$',
  testTimeout: 600_000
};
