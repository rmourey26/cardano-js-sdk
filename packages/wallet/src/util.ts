// import cbor from 'cbor';
import {
  ApiError,
  // ApiError,
  // Bytes,
  Cbor,
  Paginate,
  WalletApi,
  // PaginateError,
  // Paginate, PaginateError,
  handleMessages
} from '@cardano-sdk/cip30';
// import { Cardano } from '@cardano-sdk/core';
import { Cardano } from '@cardano-sdk/core';
import { Logger, dummyLogger } from 'ts-log';
import { SingleAddressWallet } from '.';
import {
  firstValueFrom
  // map
} from 'rxjs';

type Props = {
  networkId: 0;
  logger?: Logger;
};

export const createCip30WalletApiFromWallet = (wallet: SingleAddressWallet, props: Props): WalletApi => {
  const logger = props.logger || dummyLogger;
  return {
    getBalance: async (): Promise<Cbor> => {
      logger.debug('getting balance');
      try {
        return wallet.balance.available$.value as unknown as string;
        // TODO: uncomment and fix failure
        // return cbor.encode(wallet.balance.available$.value).toString('hex');
      } catch (error) {
        logger.error(error);
        throw error;
      }
    },
    getChangeAddress: async (): Promise<Cbor> => {
      logger.debug('getting changeAddress');

      const changeAddresss = wallet.addresses$.value?.find((e) => e.type === 1);

      if (!changeAddresss) {
        throw new Error('could not find a change address');
      }
      return changeAddresss.address.toString();
      // return cbor.encode(changeAddresss?.address.toString).toString('hex');
    },
    getNetworkId: async (): Promise<Cardano.NetworkId> => {
      logger.debug('getting networkId');
      return Promise.resolve(props.networkId);
    },
    /* getRewardAddresses: async (): Promise<Cbor[]> => {
      logger.info('getting reward addresses');

      const rewardAccounts = await firstValueFrom(wallet.delegation.rewardAccounts$);
      return rewardAccounts.map((a) => cbor.encode(a.address.toString).toString('hex'));
    },*/
    getUnusedAddresses: async (): Promise<Cbor[]> => {
      logger.info('getting unused addresses');
      try {
        const addresses = await firstValueFrom(wallet.addresses$);
        const cardanoAddresses = addresses.map((addr) => addr.address as unknown as string);
        if (!cardanoAddresses) {
          throw new ApiError(400, 'Could not find any addresses');
        }
        return Promise.resolve(cardanoAddresses);
      } catch (error) {
        logger.error(error);
        throw error;
      }
    },
    /* getUsedAddresses: async (_paginate?: Paginate): Promise<Cbor[]> => {
      const returnedAddresses = [];
      if (_paginate && _paginate.limit > returnedAddresses.length)
        throw new PaginateError(returnedAddresses.length, 'Pagination limit exceeds returned addresses');
      // Otherwise slice the addresses by page/limit
      return Promise.resolve(['usedAddresses']);
    },*/
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

      // TODO: determine how to paginate effectively
      return Promise.resolve(allUtxos);
    }
    /* signData: (addr: Cbor, sigStructure: string): Promise<Bytes> => {
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
    }*/
  } as WalletApi;
};

export const createWalletApiAndHandleMessages = (wallet: SingleAddressWallet, props: Props) => {
  const walletApi = createCip30WalletApiFromWallet(wallet, props);
  handleMessages(walletApi, props.logger);
};
