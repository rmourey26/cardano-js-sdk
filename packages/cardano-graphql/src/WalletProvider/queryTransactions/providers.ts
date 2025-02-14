import { WalletProvider, util } from '@cardano-sdk/core';
import { WalletProviderFnProps } from '../WalletProviderFnProps';
import { graphqlTransactionsToCore } from './graphqlTransactionsToCore';
import { orderBy, unionBy } from 'lodash-es';

export const queryTransactionsByHashesProvider =
  ({ sdk, getExactlyOneObject }: WalletProviderFnProps): WalletProvider['queryTransactionsByHashes'] =>
  async (hashes) => {
    const { queryProtocolParametersAlonzo, queryTransaction } = await sdk.TransactionsByHashes({
      hashes: hashes as unknown as string[]
    });
    return graphqlTransactionsToCore(queryTransaction, queryProtocolParametersAlonzo, getExactlyOneObject);
  };

export const queryTransactionsByAddressesProvider =
  ({ sdk, getExactlyOneObject }: WalletProviderFnProps): WalletProvider['queryTransactionsByAddresses'] =>
  async (addresses, sinceBlock) => {
    const { queryAddress, queryProtocolParametersAlonzo } = await sdk.TransactionsByAddresses({
      addresses: addresses as unknown as string[],
      sinceBlock
    });
    if (!queryAddress) {
      return [];
    }
    return orderBy(
      queryAddress.filter(util.isNotNil).flatMap(({ inputs, utxo }) =>
        unionBy(
          graphqlTransactionsToCore(
            inputs.map(({ transaction }) => transaction),
            queryProtocolParametersAlonzo,
            getExactlyOneObject
          ),
          graphqlTransactionsToCore(
            utxo.map(({ transaction }) => transaction),
            queryProtocolParametersAlonzo,
            getExactlyOneObject
          ),
          (tx) => tx.id
        )
      ),
      [(tx) => tx.blockHeader.blockNo, (tx) => tx.index]
    );
  };
