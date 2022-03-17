import { ApiError, Bytes, Cbor, Paginate, TxSignError, WalletApi, handleMessages } from '@cardano-sdk/cip30';
import { Cardano, coreToCsl, cslToCore, parseCslAddress } from '@cardano-sdk/core';
import { Logger, dummyLogger } from 'ts-log';
import { SingleAddressWallet } from '.';
import { firstValueFrom, skip, take } from 'rxjs';
import cbor from 'cbor';

type Props = {
  networkId: Cardano.NetworkId;
  logger?: Logger;
};

export const createCip30WalletApiFromWallet = (wallet: SingleAddressWallet, props: Props): WalletApi => {
  const logger = props.logger || dummyLogger;
  return {
    getBalance: async (): Promise<Cbor> => {
      logger.debug('getting balance');
      try {
        const value = await firstValueFrom(wallet.balance.available$);
        return Buffer.from(coreToCsl.value(value).to_bytes()).toString('hex');
      } catch (error) {
        logger.error(error);
        throw error;
      }
    },
    getChangeAddress: async (): Promise<Cbor> => {
      logger.debug('getting changeAddress');
      try {
        const [{ address }] = await firstValueFrom(wallet.addresses$);
        const parsedAddress = parseCslAddress(address as unknown as string);

        if (!address || !parsedAddress) {
          logger.error('could not get change address');
          throw new ApiError(500, 'could not get change address');
        } else {
          return Buffer.from(parsedAddress.to_bytes()).toString('hex');
        }
      } catch (error) {
        logger.error(error);
        throw new ApiError(500, error);
      }
    },
    getNetworkId: async (): Promise<number> => {
      logger.debug('getting networkId');
      return Promise.resolve(props.networkId);
    },
    getRewardAddresses: async (): Promise<Cbor[]> => {
      logger.debug('getting reward addresses');
      try {
        const [{ rewardAccount }] = await firstValueFrom(wallet.addresses$);
        const parsedAddress = parseCslAddress(rewardAccount as unknown as string);

        if (!rewardAccount || !parsedAddress) {
          throw new ApiError(500, 'could not get reward address');
        } else {
          return [Buffer.from(parsedAddress.to_bytes()).toString('hex')];
        }
      } catch (error) {
        logger.error(error);
        throw new ApiError(500, error);
      }
    },
    getUnusedAddresses: async (): Promise<Cbor[]> => {
      logger.debug('getting unused addresses');
      return Promise.resolve([]);
    },
    getUsedAddresses: async (_paginate?: Paginate): Promise<Cbor[]> => {
      logger.debug('getting changeAddress');

      const [{ address }] = await firstValueFrom(wallet.addresses$);
      const parsedAddress = parseCslAddress(address as unknown as string);

      if (!address || !parsedAddress) {
        throw new ApiError(500, 'could not get used addresses');
      } else {
        return [Buffer.from(parsedAddress.to_bytes()).toString('hex')];
      }
    },
    getUtxos: async (amount?: Cbor, _paginate?: Paginate): Promise<Cardano.Utxo[] | undefined> => {
      const utxos = _paginate
        ? await firstValueFrom(wallet.utxo.available$.pipe(skip(_paginate.page), take(_paginate.limit)))
        : await firstValueFrom(wallet.utxo.available$);
      if (!utxos) return Promise.resolve();

      if (amount) {
        const amountFilteredUtxos = utxos
          .sort((a, b) => {
            if (a[1].value > b[1].value) return 1;
            if (b[1].value > a[1].value) return -1;
            return 0;
          })
          .reduce((sortedUtxos: Cardano.Utxo[], currentUtxo: Cardano.Utxo) => {
            const currentSum = sortedUtxos.reduce(
              (sumCalculation, currentUtxoValue) => currentUtxoValue[1].value.coins + sumCalculation,
              0n
            );
            if (currentSum < BigInt(amount)) return [...sortedUtxos, currentUtxo];
            return sortedUtxos;
          }, [] as Cardano.Utxo[]);
        logger.debug('amountFilteredUtxos', amountFilteredUtxos);
        return Promise.resolve(amountFilteredUtxos);
      }
      return Promise.resolve(utxos);
    },
    signData: (addr: Cbor, sigStructure: string): Promise<Bytes> => {
      logger.debug('signedData', [addr, sigStructure]);
      const uadd = parseCslAddress(cbor.decode(addr));
      if (!uadd) {
        throw new ApiError(400, 'could not parse address');
      }
      return Promise.resolve('');
    },
    signTx: async (tx: Cbor, _partialSign?: Boolean): Promise<Cbor> => {
      logger.debug('signing tx', tx);
      try {
        const signedTx = await wallet.finalizeTx(cbor.decode(tx));
        return Promise.resolve(Buffer.from(cbor.encode([signedTx.witness.signatures])).toString('hex'));
      } catch (error) {
        logger.error(error);
        throw new TxSignError(1, error);
      }
    },
    submitTx: async (tx: Cbor): Promise<string> => {
      logger.debug('submitting tx', tx);
      try {
        const txDecoded = cbor.decode(tx);
        const txData: Cardano.NewTxAlonzo = cslToCore.tx(txDecoded);
        await wallet.submitTx(txData);
        return Promise.resolve(txData.id as unknown as string);
      } catch (error) {
        logger.error(error);
        throw error;
      }
    }
  } as WalletApi;
};

export const createWalletApiAndHandleMessages = (wallet: SingleAddressWallet, props: Props) => {
  const walletApi = createCip30WalletApiFromWallet(wallet, props);
  handleMessages(walletApi, props.logger);
};
