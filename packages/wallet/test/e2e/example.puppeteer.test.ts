import puppeteer, { Browser } from 'puppeteer';

describe('Example Puppeteer Test', () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await puppeteer.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('has loaded a url correctly', async () => {
    const page = await browser.newPage();
    const TARGET_URL = 'https://example.com/';
    await page.goto(TARGET_URL);
    expect(page.url()).toBe(TARGET_URL);
  });
});
