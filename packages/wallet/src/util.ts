import * as cbor from 'cbor';
import { ApiError, Bytes, Cbor, Paginate, PaginateError, WalletApi } from '@cardano-sdk/cip30';
import { Cardano } from '@cardano-sdk/core';
import { Logger, dummyLogger } from 'ts-log';
import { SingleAddressWallet } from '.';
import { firstValueFrom } from 'rxjs';

type Props = {
  logger: Logger;
};

export const createCip30WalletApiFromWallet = (wallet: SingleAddressWallet, _props?: Props): WalletApi => {
  const logger = _props?.logger || dummyLogger;
  return {
    getBalance: async (): Promise<Cbor> => {
      logger.info('getting balance');
      try {
        await firstValueFrom(wallet.balance.available$);
        return cbor.encode(wallet.balance.available$.value).toString('hex');
      } catch (error) {
        logger.error(error);
        throw error;
      }
    },
    getChangeAddress: async (): Promise<Cbor> => {
      logger.info('getting changeAddres');

      await firstValueFrom(wallet.addresses$);
      const changeAddresss = wallet.addresses$.value?.find((e) => e.type === 1);

      if (!changeAddresss) {
        throw new Error('could not find a change address');
      }

      return cbor.encode(changeAddresss?.address.toString).toString('hex');
    },
    getNetworkId: async (): Promise<Cardano.NetworkId> => {
      logger.info('getting networkId');

      try {
        const a = await firstValueFrom(wallet.addresses$);
        return a[0].networkId;
      } catch (error) {
        logger.error(error);
        throw ApiError;
      }
    },
    getRewardAddresses: async (): Promise<Cbor[]> => {
      logger.info('getting reward addresses');

      const rewardAccounts = await firstValueFrom(wallet.delegation.rewardAccounts$);
      return rewardAccounts.map((a) => cbor.encode(a.address.toString).toString('hex'));
    },
    getUnusedAddresses: async (): Promise<Cbor[]> => {
      logger.info('getting unused addresses');
      try {
        const addresses = await firstValueFrom(wallet.addresses$);
        const cborAddresses = addresses?.map((addr) => cbor.encode(addr).toString('hex'));
        if (!cborAddresses) {
          throw new ApiError(400, 'Could not find any addresses');
        }
        return cborAddresses;
      } catch (error) {
        logger.error(error);
        throw error;
      }
    },
    getUsedAddresses: async (_paginate?: Paginate): Promise<Cbor[]> => {
      logger.info('getting used addresses', _paginate);
      // const confirmedAddreesses = wallet.transactions.outgoing.confirmed$.pipe(map((tx) => tx.body.inputs));

      // todo: return correctly
      const returnedAddresses = [];
      if (_paginate && _paginate.limit > returnedAddresses.length)
        throw new PaginateError(returnedAddresses.length, 'Pagination limit exceeds returned addresses');
      // Otherwise slice the addresses by page/limit
      return Promise.resolve(['usedAddresses']);
    },
    getUtxos: async (amount?: Cbor, _paginate?: Paginate): Promise<Cardano.Utxo[] | undefined> => {
      await firstValueFrom(wallet.utxo.available$);
      const allUtxos = wallet.utxo.available$.value;
      if (!allUtxos) return Promise.resolve([]);

      if (amount) {
        const filteredByAmount = allUtxos
          .sort((a, b) => {
            if (a[1].value > b[1].value) return 1;
            if (b[1].value > a[1].value) return -1;
            return 0;
          })
          .reduce((utxos: Cardano.Utxo[], currentUtxo: Cardano.Utxo) => {
            const currentSum = utxos.reduce(
              (sumCalculation, currentUtxoValue) => currentUtxoValue[1].value.coins + sumCalculation,
              0n
            );
            if (currentSum < BigInt(amount)) return [...utxos, currentUtxo];
            return utxos;
          }, [] as Cardano.Utxo[]);
        logger.info('filteredByAmount', filteredByAmount);
      }
      return Promise.resolve(allUtxos);
    },
    signData: (addr: Cbor, sigStructure: string): Promise<Bytes> => {
      // todo: return correctly
      logger.info('signedData', [addr, sigStructure]);
      return Promise.resolve('signedData');
    },
    signTx: (tx: Cbor, _partialSign?: Boolean) =>
      // const decodedTx = cbor.decode(tx);

      // todo: return correctly
      Promise.resolve(tx),
    submitTx: async (tx: Cbor): Promise<string> => {
      const txData: Cardano.NewTxAlonzo = cbor.decode(tx);
      try {
        await wallet.submitTx(txData);
        return txData.id as unknown as string;
      } catch (error) {
        logger.error(error);

        throw error;
      }
    }
  } as WalletApi;
};
