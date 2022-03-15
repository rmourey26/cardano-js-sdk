import {
  Wallet as Cip30Wallet,
  RequestAccess,
  WalletApi,
  WalletProperties,
  WindowMaybeWithCardano,
  createUiWallet,
  injectWindow
} from '@cardano-sdk/cip30';
import { SingleAddressWallet } from '../../src';
import { assetProvider, keyAgentReady, stakePoolSearchProvider, timeSettingsProvider, walletProvider } from './config';
import { createWalletApiAndHandleMessages } from '../../src/util';
import puppeteer, { Browser } from 'puppeteer';

const properties: WalletProperties = { apiVersion: '0.1.0', icon: 'imageLink', name: 'testWallet' };
const requestAccess: RequestAccess = async () => true;

declare const window: WindowMaybeWithCardano;

describe('Example Puppeteer Test', () => {
  let browser: Browser;
  let wallet: SingleAddressWallet;
  let injectedWallet: Cip30Wallet;
  const windowStub = { ...window, location: { hostname: 'test-dapp' } };
  let page: puppeteer.Page;
  const TARGET_URL = 'https://example.com/';

  beforeAll(async () => {
    page = await browser.newPage();
    await page.goto(TARGET_URL);
    // CREATE A WALLET

    beforeAll(async () => {
      browser = await puppeteer.launch({ headless: false });

      wallet = new SingleAddressWallet(
        { name: 'Test Wallet' },
        {
          assetProvider,
          keyAgent: await keyAgentReady,
          stakePoolSearchProvider,
          timeSettingsProvider,
          walletProvider
        }
      );

      const api: WalletApi = createUiWallet();
      injectedWallet = new Cip30Wallet(properties, api, requestAccess);
      injectWindow(window, injectedWallet);
      createWalletApiAndHandleMessages(wallet, { networkId: 0 });
    });

    afterAll(async () => {
      await browser.close();
    });

    it('has loaded a url correctly', async () => {
      expect(page.url()).toBe(TARGET_URL);
    });

    describe('API Methods', () => {
      let api: WalletApi;
      beforeAll(async () => {
        if (window.cardano) api = await window.cardano[properties.name].enable(windowStub.location.hostname);
      });

      test('api.getNetworkId', async () => {
        const cip30NetworkId = await api.getNetworkId();
        expect(cip30NetworkId).toEqual(0);
      });
    });
  });
});
