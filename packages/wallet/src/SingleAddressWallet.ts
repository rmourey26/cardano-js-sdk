import { Address, InitializeTxProps, Wallet } from './types';
import { AddressType } from '.';
import {
  Balance,
  BehaviorObservable,
  DirectionalTransaction,
  FailedTx,
  PollingConfig,
  ProviderTrackerSubject,
  SimpleProvider,
  SourceTrackerConfig,
  SourceTransactionalTracker,
  TransactionalTracker,
  Transactions,
  createAddressTransactionsProvider,
  createBalanceTracker,
  createRewardsProvider,
  createRewardsTracker,
  createTransactionsTracker,
  createUtxoProvider,
  createUtxoTracker
} from './services';
import { Cardano, NetworkInfo, ProtocolParametersRequiredByWallet, WalletProvider, coreToCsl } from '@cardano-sdk/core';
import { InputSelector, defaultSelectionConstraints, roundRobinRandomImprove } from '@cardano-sdk/cip2';
import { KeyManager } from './KeyManagement';
import { Logger, dummyLogger } from 'ts-log';
import { Subject, combineLatest, from, lastValueFrom, mergeMap, take } from 'rxjs';
import { TransactionFailure } from './services/TransactionError';
import { TxInternals, computeImplicitCoin, createTransactionInternals, ensureValidityInterval } from './Transaction';
import { isEqual } from 'lodash-es';

export interface SingleAddressWalletProps {
  readonly name: string;
  readonly polling?: PollingConfig;
}

export interface SingleAddressWalletDependencies {
  readonly keyManager: KeyManager;
  readonly walletProvider: WalletProvider;
  readonly inputSelector?: InputSelector;
  readonly logger?: Logger;
}

export interface SingleAddressWalletConfiguration {
  readonly address?: Address;
  readonly utxoProvider?: SimpleProvider<Cardano.Utxo[]>;
  readonly tipProvider?: SimpleProvider<Cardano.Tip>;
  readonly networkInfoProvider?: SimpleProvider<NetworkInfo>;
  readonly rewardsProvider?: SimpleProvider<Cardano.Lovelace>;
  readonly protocolParametersProvider?: SimpleProvider<ProtocolParametersRequiredByWallet>;
  readonly transactionsProvider?: SimpleProvider<DirectionalTransaction[]>;
  readonly sourceTrackerConfig?: SourceTrackerConfig;
}

export class SingleAddressWallet implements Wallet {
  #inputSelector: InputSelector;
  #keyManager: KeyManager;
  #walletProvider: WalletProvider;
  #address: Address;
  #logger: Logger;
  #tip$: ProviderTrackerSubject<Cardano.Tip>;
  #networkInfo$: ProviderTrackerSubject<NetworkInfo>;
  #protocolParameters$: ProviderTrackerSubject<ProtocolParametersRequiredByWallet>;
  #newTransactions = {
    failedToSubmit$: new Subject<FailedTx>(),
    pending$: new Subject<Cardano.NewTxAlonzo>(),
    submitting$: new Subject<Cardano.NewTxAlonzo>()
  };
  #rewards: SourceTransactionalTracker<Cardano.Lovelace>;
  utxo: SourceTransactionalTracker<Cardano.Utxo[]>;
  balance: TransactionalTracker<Balance>;
  transactions: Transactions;
  tip$: BehaviorObservable<Cardano.Tip>;
  networkInfo$: BehaviorObservable<NetworkInfo>;
  protocolParameters$: BehaviorObservable<ProtocolParametersRequiredByWallet>;
  name: string;

  constructor(
    {
      name,
      polling: { interval, maxInterval } = { interval: 15_000, maxInterval: 15_000 * 10 }
    }: SingleAddressWalletProps,
    {
      walletProvider,
      keyManager,
      logger = dummyLogger,
      inputSelector = roundRobinRandomImprove()
    }: SingleAddressWalletDependencies,
    {
      address = {
        accountIndex: 0,
        bech32: keyManager.deriveAddress(0, 0),
        index: 0,
        type: AddressType.External
      },
      utxoProvider = createUtxoProvider(walletProvider, [address.bech32]),
      tipProvider = () => from(walletProvider.ledgerTip()),
      networkInfoProvider = () => from(walletProvider.networkInfo()),
      rewardsProvider = createRewardsProvider(walletProvider, keyManager),
      transactionsProvider = createAddressTransactionsProvider(walletProvider, [address.bech32]),
      protocolParametersProvider = () => from(walletProvider.currentWalletProtocolParameters()),
      sourceTrackerConfig: config = {
        maxInterval,
        pollInterval: interval
      }
    }: SingleAddressWalletConfiguration = {}
  ) {
    this.#logger = logger;
    this.#inputSelector = inputSelector;
    this.#walletProvider = walletProvider;
    this.#keyManager = keyManager;
    this.#address = address;
    this.#tip$ = this.tip$ = new ProviderTrackerSubject({ config, equals: isEqual, provider: tipProvider });
    this.#networkInfo$ = this.networkInfo$ = new ProviderTrackerSubject({
      config,
      equals: isEqual,
      provider: networkInfoProvider
    });
    this.#protocolParameters$ = this.protocolParameters$ = new ProviderTrackerSubject({
      config,
      equals: isEqual,
      provider: protocolParametersProvider
    });

    this.name = name;
    this.transactions = createTransactionsTracker({
      config,
      newTransactions: this.#newTransactions,
      tip$: this.tip$,
      transactionsProvider
    });
    this.utxo = createUtxoTracker({
      config,
      transactionsInFlight$: this.transactions.outgoing.inFlight$,
      utxoProvider
    });
    this.#rewards = createRewardsTracker({
      config,
      rewardsProvider,
      transactionsInFlight$: this.transactions.outgoing.inFlight$
    });
    this.balance = createBalanceTracker(this.utxo, this.#rewards);
  }
  get addresses(): Address[] {
    return [this.#address];
  }
  initializeTx(props: InitializeTxProps): Promise<TxInternals> {
    return lastValueFrom(
      combineLatest([this.tip$, this.utxo.available$, this.protocolParameters$]).pipe(
        take(1),
        mergeMap(([tip, utxo, protocolParameters]) => {
          const validityInterval = ensureValidityInterval(tip.slot, props.options?.validityInterval);
          const txOutputs = new Set([...props.outputs].map((output) => coreToCsl.txOut(output)));
          const changeAddress = this.addresses[0].bech32;
          const constraints = defaultSelectionConstraints({
            buildTx: async (inputSelection) => {
              this.#logger.debug('Building TX for selection constraints', inputSelection);
              const txInternals = await createTransactionInternals({
                changeAddress,
                inputSelection,
                validityInterval
              });
              return coreToCsl.tx(await this.finalizeTx(txInternals));
            },
            protocolParameters
          });
          const implicitCoin = computeImplicitCoin(protocolParameters, props);
          return from(
            this.#inputSelector
              .select({
                constraints,
                implicitCoin,
                outputs: txOutputs,
                utxo: new Set(coreToCsl.utxo(utxo))
              })
              .then((inputSelectionResult) =>
                createTransactionInternals({
                  changeAddress,
                  inputSelection: inputSelectionResult.selection,
                  validityInterval
                })
              )
          );
        })
      )
    );
  }
  async finalizeTx({ body, hash }: TxInternals, auxiliaryData?: Cardano.AuxiliaryData): Promise<Cardano.NewTxAlonzo> {
    const signatures = await this.#keyManager.signTransaction(hash);
    return {
      auxiliaryData,
      body,
      id: hash,
      // TODO: add support for the rest of the witness properties
      witness: { signatures }
    };
  }
  async submitTx(tx: Cardano.NewTxAlonzo): Promise<void> {
    this.#newTransactions.submitting$.next(tx);
    try {
      await this.#walletProvider.submitTx(coreToCsl.tx(tx).to_bytes());
      this.#newTransactions.pending$.next(tx);
    } catch (error) {
      this.#newTransactions.failedToSubmit$.next({
        reason: TransactionFailure.FailedToSubmit,
        tx
      });
      throw error;
    }
  }
  sync() {
    this.utxo.sync();
    this.transactions.sync();
    this.#tip$.sync();
    this.#networkInfo$.sync();
    this.#protocolParameters$.sync();
    this.#rewards.sync();
  }
  shutdown() {
    this.#rewards.shutdown();
    this.utxo.shutdown();
    this.transactions.shutdown();
    this.#tip$.complete();
    this.#networkInfo$.complete();
    this.#protocolParameters$.complete();
  }
}
