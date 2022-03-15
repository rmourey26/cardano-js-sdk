import {
  Wallet as Cip30Wallet,
  RequestAccess,
  WalletApi,
  WalletProperties,
  createUiWallet,
  injectWindow
} from '@cardano-sdk/cip30';
import { SingleAddressWallet } from '../../../src';
import { assetProvider, keyAgentReady, stakePoolSearchProvider, timeSettingsProvider, walletProvider } from '../config';
import { createWalletApiAndHandleMessages } from '../../../src/util';
import { firstValueFrom } from 'rxjs';
import { mocks } from 'mock-browser';

export const properties: WalletProperties = { apiVersion: '0.1.0', icon: 'imageLink', name: 'testWallet' };

export const requestAccess: RequestAccess = async () => true;

describe('cip30 e2e', () => {
  let window: ReturnType<typeof mocks.MockBrowser>;
  let wallet: SingleAddressWallet;
  let injectedWallet: Cip30Wallet;
  const windowStub = { ...window, location: { hostname: 'test-dapp' } };

  beforeAll(async () => {
    window = mocks.MockBrowser.createWindow();
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

    const api: WalletApi = createUiWallet();
    injectedWallet = new Cip30Wallet(properties, api, requestAccess);
    injectWindow(window, injectedWallet);
    createWalletApiAndHandleMessages(wallet, { logger: console, networkId: 0 });
  });

  afterAll(() => wallet.shutdown());

  it('should correctly pull wallet balance correctly from blockfrost before starting the test', async () => {
    await firstValueFrom(wallet.balance.total$);
    expect(wallet.balance.total$.value?.coins).toBeGreaterThanOrEqual(0n);
  });

  describe('API Methods', () => {
    let api: WalletApi;
    beforeAll(async () => {
      api = await window.cardano[properties.name].enable(windowStub.location.hostname);
    });

    xtest('api.getNetworkId', async () => {
      const cip30NetworkId = await api.getNetworkId();
      expect(cip30NetworkId).toEqual(0);
    });

    xtest('api.getUtxos', async () => {
      const cip30WindowUtxos = await api.getUtxos();
      const singleAddressWalletUtxos = await firstValueFrom(wallet.utxo.available$);
      expect(cip30WindowUtxos).toEqual(singleAddressWalletUtxos);
    });

    test.skip('api.getBalance', async () => {
      // const cip30Balance = await api.getBalance();
      // const walletBalance = wallet.balance.total$.value;
      // expect(cip30Balance).toEqual(walletBalance);
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

    test('api.getChangeAddress', async () => {
      const cipChangeAddress = await api.getChangeAddress();
      // const walletChangeAddress = wallet?.addresses$?.value?.filter((a) => a.type === 1);
      // TODO: maybe search all transactions and list these addresses?
      // expect(cipChangeAddress).toEqual(walletChangeAddress);
      expect(true);
    });
    xtest('api.getRewardAddresses', async () => {
      const cipRewardAddresses = await api.getRewardAddresses();
      const walletRewardAddresses = await wallet.addresses$.value?.filter((s) => s.rewardAccount);

      expect(cipRewardAddresses).toEqual(walletRewardAddresses);
    });

    test.todo('api.signTx');
    test.todo('api.signData');
    test.todo('api.submitTx');
  });
});
