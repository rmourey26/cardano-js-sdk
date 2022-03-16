/**
 * @jest-environment jsdom
 */


import puppeteer, { Browser } from 'puppeteer';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';

describe('Example Puppeteer Test', () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--enable-experimental-web-platform-features'
      ]
    })
  });

  afterAll(async () => {
    // await browser.close();
  });

  it('has loaded a url correctly', async () => {
    const page = await browser.newPage();
    const TARGET_URL = 'https://example.com/';
    await page.goto(TARGET_URL);
    expect(page.url()).toBe(TARGET_URL);


    const performance = JSON.parse(await page.evaluate(
      () => JSON.stringify(window.performance)
    ));

    console.log('>>> performance: ', performance);    
    console.log('dummy: ', await page.evaluate(() => navigator.userAgent));
    console.log('dummy 2: ', await page.evaluate(() => navigator.usb));
    console.log('dummy 3: ', await page.evaluate(() => navigator.usb.getDevices()));
    console.debug('>>> TransportWebUSB: ', TransportWebUSB)

    // @ts-ignore
    const test = (a) => {
      return a
    }
    await page.exposeFunction("test", test);
    console.log('dummy 7: ', await page.evaluate(() => {
        const a = 'NOVO'
        return test(a)
      }
    ));


    // @ts-ignore
    const test2 = () => {
      return TransportWebUSB
    }
    await page.exposeFunction("test2", test2);

    await page.exposeFunction("require", require);
      console.log('dummy 9: ', await page.evaluate(() => {
        return test2();
      }
    ));

    await page.addScriptTag({ path: '../../node_modules/@ledgerhq/hw-transport-webusb/src/TransportWebUSB.ts' });

    const generalInfo = await page.evaluate(() => {
      console.log('>>> Window: ', window)
      return window
    });

    console.log("GENERAL", generalInfo);

    await page.exposeFunction('exposedTest', async () => {
      // @ts-ignore
      return TransportWebUSB.list();
    });

    await page.evaluate(async () => {
      try {
        console.log('>>> navigator: ', window.navigator)
        console.log('>>> usb: ', window.navigator.usb)
        console.log('>>> devices: ', await window.navigator.usb.getDevices())
        /* window.navigator.usb.requestDevice({filters:[]}).then(function(device){
          console.log('REQUESTED: ', device);
        }); */
        // @ts-ignore
        const tr = await window.exposedTest();
        console.log('>>> TransportWebUSB: ', tr)
      } catch (e) {
        console.log('>>> TransportWebUSB ERROR: ', e)
      }
    });

    const navUsb = await global.navigator.usb;
    const userAgent = global.navigator.userAgent;
    console.log('>>> devices: ', navUsb);
    console.log('>>> userAgent: ', userAgent);

    try {
      console.log('>>> IsSupported: ', TransportWebUSB.isSupported());
    } catch (e) {
      console.debug('>> E1: ',e)
    }

    try {
      const transport = await TransportWebUSB.openConnected();
      console.debug('>>> TR: ', transport);

    } catch (e) {
      console.debug('>> E2: ',e)
    }
  });
});