import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { RequestAccess, WalletApi, WalletProperties } from '@cardano-sdk/cip30';
import { SingleAddressWallet } from '../../../src';
import { assetProvider, keyAgentReady, stakePoolSearchProvider, timeSettingsProvider, walletProvider } from '../config';
import { createCip30WalletApiFromWallet } from '../../../src/util';
import { firstValueFrom } from 'rxjs'; // or wasm, or load dynamically in beforeAll
import { parseCslAddress } from '@cardano-sdk/core';

export const properties: WalletProperties = { apiVersion: '0.1.0', icon: 'imageLink', name: 'testWallet' };

export const requestAccess: RequestAccess = async () => true;

describe('cip30 e2e', () => {
  let wallet: SingleAddressWallet;
  let mappedWallet: WalletApi;

  beforeAll(async () => {
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

    mappedWallet = createCip30WalletApiFromWallet(wallet, {
      logger: console,
      networkId: Number(process.env.NETWORK_ID)
    });
  });

  afterAll(() => {
    wallet.shutdown();
  });

  it('should correctly pull wallet balance correctly from blockfrost before starting the test', async () => {
    await firstValueFrom(wallet.balance.total$);
    expect(wallet.balance.total$.value?.coins).toBeGreaterThanOrEqual(0n);
  });

  describe('API Methods', () => {
    test('api.getNetworkId', async () => {
      const cip30NetworkId = await mappedWallet.getNetworkId();
      expect(cip30NetworkId).toEqual(Number(process.env.NETWORK_ID));
    });

    test.skip('api.getUtxos', async () => {
      expect(async () => await mappedWallet.getUtxos()).not.toThrow();
    });

    test('api.getBalance', async () => {
      const balanceCborBytes = Buffer.from(await mappedWallet.getBalance(), 'hex');
      expect(() => CSL.Value.from_bytes(balanceCborBytes)).not.toThrow(); // I think asserting that it does not throw is sufficient
    });

    test.skip('api.getUsedAddresses', async () => {
      const cipUsedAddressess = await mappedWallet.getUsedAddresses();
      const [{ address: walletUsedAddresses }] = await firstValueFrom(wallet.addresses$);

      const encodedWallet = CSL.Address.from_bech32(cipUsedAddressess[0]);

      expect(encodedWallet).toEqual(walletUsedAddresses);
    });

    test('api.getUnusedAddresses', async () => {
      const cipUsedAddressess = await mappedWallet.getUnusedAddresses();
      expect(cipUsedAddressess).toEqual([]);
    });

    test('api.getChangeAddress', async () => {
      const cipChangeAddress = await mappedWallet.getChangeAddress();
      const [{ address }] = await firstValueFrom(wallet.addresses$);
      const parsedAddress = parseCslAddress(address as unknown as string);
      if (!parsedAddress) {
        throw new Error('No wallet address');
      }

      expect(cipChangeAddress).toEqual(Buffer.from(parsedAddress.to_bytes()).toString('hex'));
    });

    test.skip('api.getRewardAddresses', async () => {
      const cipRewardAddresses = await mappedWallet.getRewardAddresses();
      const walletRewardAddresses = await wallet.addresses$.value?.filter((s) => s.rewardAccount);

      expect(cipRewardAddresses).toEqual(walletRewardAddresses);
    });

    test.todo('api.signTx');
    test.todo('api.signData');
    test.todo('api.submitTx');

    test.todo('errorStates');
  });
});
