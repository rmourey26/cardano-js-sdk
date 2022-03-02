/**
 * @jest-environment jsdom
 */

//import { testnetTimeSettings } from '@cardano-sdk/core';
//import { createStubStakePoolSearchProvider, createStubTimeSettingsProvider } from '@cardano-sdk/util-dev';
//import { createWalletApi, injectWindow, WalletApi, Wallet } from '../../cip30';
import { handleMessages, injectWindow, Wallet as BigWallet } from '../../cip30/src';
//import { createWalletPublicApi, WalletPublicApi } from '../../cip30';
import { RequestAccess, WalletApi, WalletProperties, createUiWallet } from '../../cip30/src';
import { firstValueFrom } from '../../wallet/dist/util';
import { SingleAddressWallet, Wallet as BlockWallet } from '../../wallet';
import { assetProvider, keyAgentReady, stakePoolSearchProvider, timeSettingsProvider, walletProvider } from './config';

// import { Wallet } from '../../cip30';

export const properties: WalletProperties = { apiVersion: '0.1.0', icon: 'imageLink', name: 'testWallet' };

export const requestAccess: RequestAccess = async () => true;

declare const window: any;

describe('cip30 e2e', () => {
  let wallet: BlockWallet;
  let walletStartingBalance: bigint;
  let injectedWallet: BigWallet;
  let api: WalletApi = createUiWallet();
  delete window.location;
  window.location = { hostname: 'test.invalid' };

  beforeAll(async () => {
    injectedWallet = await BigWallet.initialize(properties, api, requestAccess);
    injectWindow(window, injectedWallet);

    // CREATE A WALLET
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
    await firstValueFrom(wallet.balance.total$);
    if (wallet.balance.total$.value?.coins) {
      walletStartingBalance = wallet.balance.total$.value.coins;
    } else {
      throw new Error('unable to connect to blockfrost');
    }
  });

  afterAll(() => wallet.shutdown());

  it('should not be enabled in the beginning', async () => {
    const isEnabled = await window.cardano[properties.name].isEnabled();
    expect(isEnabled).toBe(false);
  });

  it('should display a name, apiVersion, and icon prior to enabling', () => {
    expect(window.cardano[properties.name].name).toEqual(properties.name);
    expect(window.cardano[properties.name].apiVersion).toEqual(properties.apiVersion);
    expect(window.cardano[properties.name].icon).toEqual(properties.icon);
  });

  it('should be enabled after calling the enable method', async () => {
    await window.cardano[properties.name].enable(window.location.hostname);
    const isNowEnabled = await window.cardano.testWallet.isEnabled(window.location.hostname);
    expect(isNowEnabled).toBe(true);
  });

  it('should expose the api methods when enabled', async () => {
    const api = await window.cardano[properties.name].enable(window.location.hostname);
    expect(Object.keys(api)).toEqual([
      'getNetworkId',
      'getUtxos',
      'getBalance',
      'getUsedAddresses',
      'getUnusedAddresses',
      'getChangeAddress',
      'getRewardAddresses',
      'signTx',
      'signData',
      'submitTx'
    ]);
  });

  describe('API Methods', () => {
    let api: WalletApi;
    beforeAll(async () => {
      api = await window.cardano[properties.name].enable(window.location.hostname);
    });

    xtest('api.getNetworkId', async () => {
      const cip30NetworkId = await api.getNetworkId(); // returns undefined
      const singleAddressWalletNetworkId = (await firstValueFrom(wallet.addresses$))[0].networkId;
      expect(cip30NetworkId).toEqual(singleAddressWalletNetworkId);
    });

    xtest('api.getUtxos', async () => {
      const cip30WindowUtxos = await api.getUtxos();
      const singleAddressWalletUtxos = await firstValueFrom(wallet.utxo.available$);
      expect(cip30WindowUtxos).toEqual(singleAddressWalletUtxos);
    });

    xtest('api.getBalance', async () => {
      const cip30Balance = await api.getBalance();
      expect(cip30Balance).toEqual(walletStartingBalance);
    });

    xtest('api.getUsedAddresses', async () => {
      const cipUsedAddressess = await api.getUsedAddresses();
      const walletUsedAddresses = await firstValueFrom(wallet.addresses$);
      // TODO: maybe search all transactions and list these addresses?
      expect(cipUsedAddressess).toEqual(walletUsedAddresses);
    });

    xtest('api.getUnusedAddresses', async () => {
      const cipUsedAddressess = await api.getUnusedAddresses();
      const walletUsedAddresses = await firstValueFrom(wallet.addresses$);
      expect(cipUsedAddressess).toEqual(walletUsedAddresses);
    });

    test.todo('api.getChangeAddress');
    test.todo('api.getRewardAddresses');
  });
});
