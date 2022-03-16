module.exports = {
  // ...require('./jest.config'),
  ...require('./base.jest.config'),
  moduleNameMapper: {
    '^lodash-es$': 'lodash'
  },
  preset: 'jest-puppeteer',
  setupFiles: ['dotenv/config'],
  testRegex: '(/hardware/.*puppeteer.(test|spec))\\.[jt]sx?$',
  testTimeout: 600_000,
};