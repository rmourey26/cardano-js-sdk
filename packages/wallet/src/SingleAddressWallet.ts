import { AddressType, GroupedAddress, KeyAgent, util as keyManagementUtil } from './KeyManagement';
import {
  AssetProvider,
  BigIntMath,
  Cardano,
  NetworkInfo,
  ProtocolParametersRequiredByWallet,
  StakePoolSearchProvider,
  TimeSettings,
  TimeSettingsProvider,
  TxSubmitProvider,
  WalletProvider,
  coreToCsl
} from '@cardano-sdk/core';
import {
  Assets,
  InitializeTxProps,
  InitializeTxPropsValidationResult,
  InitializeTxResult,
  MinimumCoinQuantity,
  SignDataProps,
  SyncStatus,
  Wallet
} from './types';
import {
  Balance,
  BehaviorObservable,
  DelegationTracker,
  FailedTx,
  PersistentDocumentTrackerSubject,
  PollingConfig,
  SyncableIntervalPersistentDocumentTrackerSubject,
  TrackedAssetProvider,
  TrackedStakePoolSearchProvider,
  TrackedTimeSettingsProvider,
  TrackedTxSubmitProvider,
  TrackedWalletProvider,
  TrackerSubject,
  TransactionFailure,
  TransactionalTracker,
  TransactionsTracker,
  coldObservableProvider,
  createAssetsTracker,
  createBalanceTracker,
  createDelegationTracker,
  createNftMetadataProvider,
  createProviderStatusTracker,
  createTransactionsTracker,
  createUtxoTracker,
  distinctBlock,
  distinctEpoch
} from './services';
import { Cip30DataSignature, cip30signData } from './KeyManagement/cip8';
import {
  InputSelector,
  computeMinimumCoinQuantity,
  defaultSelectionConstraints,
  roundRobinRandomImprove
} from '@cardano-sdk/cip2';
import { Logger, dummyLogger } from 'ts-log';
import { Observable, Subject, combineLatest, filter, firstValueFrom, lastValueFrom, map, take } from 'rxjs';
import { RetryBackoffConfig } from 'backoff-rxjs';
import { TxInternals, createTransactionInternals, ensureValidityInterval } from './Transaction';
import { WalletStores, createInMemoryWalletStores } from './persistence';
import { isEqual } from 'lodash-es';

export interface SingleAddressWalletProps {
  readonly name: string;
  readonly polling?: PollingConfig;
  readonly retryBackoffConfig?: RetryBackoffConfig;
}

export interface SingleAddressWalletDependencies {
  readonly keyAgent: KeyAgent;
  readonly txSubmitProvider: TxSubmitProvider;
  readonly walletProvider: WalletProvider;
  readonly stakePoolSearchProvider: StakePoolSearchProvider;
  readonly assetProvider: AssetProvider;
  readonly timeSettingsProvider: TimeSettingsProvider;
  readonly inputSelector?: InputSelector;
  readonly stores?: WalletStores;
  readonly logger?: Logger;
}

export class SingleAddressWallet implements Wallet {
  #inputSelector: InputSelector;
  #keyAgent: KeyAgent;
  #logger: Logger;
  #tip$: SyncableIntervalPersistentDocumentTrackerSubject<Cardano.Tip>;
  #newTransactions = {
    failedToSubmit$: new Subject<FailedTx>(),
    pending$: new Subject<Cardano.NewTxAlonzo>(),
    submitting$: new Subject<Cardano.NewTxAlonzo>()
  };
  txSubmitProvider: TrackedTxSubmitProvider;
  walletProvider: TrackedWalletProvider;
  timeSettingsProvider: TrackedTimeSettingsProvider;
  stakePoolSearchProvider: TrackedStakePoolSearchProvider;
  assetProvider: TrackedAssetProvider;
  utxo: TransactionalTracker<Cardano.Utxo[]>;
  balance: TransactionalTracker<Balance>;
  transactions: TransactionsTracker;
  delegation: DelegationTracker;
  tip$: BehaviorObservable<Cardano.Tip>;
  networkInfo$: TrackerSubject<NetworkInfo>;
  addresses$: TrackerSubject<GroupedAddress[]>;
  protocolParameters$: TrackerSubject<ProtocolParametersRequiredByWallet>;
  genesisParameters$: TrackerSubject<Cardano.CompactGenesis>;
  timeSettings$: TrackerSubject<TimeSettings[]>;
  assets$: TrackerSubject<Assets>;
  syncStatus: SyncStatus;
  name: string;

  constructor(
    {
      name,
      polling: {
        interval: pollInterval = 5000,
        maxInterval = pollInterval * 20,
        consideredOutOfSyncAfter = 1000 * 60 * 3
      } = {},
      retryBackoffConfig = {
        initialInterval: Math.min(pollInterval, 1000),
        maxInterval
      }
    }: SingleAddressWalletProps,
    {
      txSubmitProvider,
      walletProvider,
      stakePoolSearchProvider,
      keyAgent,
      assetProvider,
      timeSettingsProvider,
      logger = dummyLogger,
      inputSelector = roundRobinRandomImprove(),
      stores = createInMemoryWalletStores()
    }: SingleAddressWalletDependencies
  ) {
    this.#logger = logger;
    this.#inputSelector = inputSelector;
    this.txSubmitProvider = new TrackedTxSubmitProvider(txSubmitProvider);
    this.walletProvider = new TrackedWalletProvider(walletProvider);
    this.timeSettingsProvider = new TrackedTimeSettingsProvider(timeSettingsProvider);
    this.stakePoolSearchProvider = new TrackedStakePoolSearchProvider(stakePoolSearchProvider);
    this.assetProvider = new TrackedAssetProvider(assetProvider);
    this.syncStatus = createProviderStatusTracker(
      {
        assetProvider: this.assetProvider,
        stakePoolSearchProvider: this.stakePoolSearchProvider,
        timeSettingsProvider: this.timeSettingsProvider,
        txSubmitProvider: this.txSubmitProvider,
        walletProvider: this.walletProvider
      },
      { consideredOutOfSyncAfter }
    );
    this.#keyAgent = keyAgent;
    this.addresses$ = new TrackerSubject<GroupedAddress[]>(this.#initializeAddress(keyAgent.knownAddresses));
    this.name = name;
    this.#tip$ = this.tip$ = new SyncableIntervalPersistentDocumentTrackerSubject({
      maxPollInterval: maxInterval,
      pollInterval,
      provider$: coldObservableProvider(this.walletProvider.ledgerTip, retryBackoffConfig),
      store: stores.tip,
      trigger$: this.syncStatus.isSettled$.pipe(filter((isSettled) => isSettled))
    });
    const tipBlockHeight$ = distinctBlock(this.tip$);
    this.networkInfo$ = new PersistentDocumentTrackerSubject(
      coldObservableProvider(this.walletProvider.networkInfo, retryBackoffConfig, tipBlockHeight$, isEqual),
      stores.networkInfo
    );
    const epoch$ = distinctEpoch(this.networkInfo$);
    this.timeSettings$ = new PersistentDocumentTrackerSubject(
      coldObservableProvider(this.timeSettingsProvider.getTimeSettings, retryBackoffConfig, epoch$, isEqual),
      stores.timeSettings
    );
    this.protocolParameters$ = new PersistentDocumentTrackerSubject(
      coldObservableProvider(this.walletProvider.currentWalletProtocolParameters, retryBackoffConfig, epoch$, isEqual),
      stores.protocolParameters
    );
    this.genesisParameters$ = new PersistentDocumentTrackerSubject(
      coldObservableProvider(this.walletProvider.genesisParameters, retryBackoffConfig, epoch$, isEqual),
      stores.genesisParameters
    );

    const addresses$ = this.addresses$.pipe(
      map((addresses) => addresses.map((groupedAddress) => groupedAddress.address))
    );
    this.transactions = createTransactionsTracker({
      addresses$,
      newTransactions: this.#newTransactions,
      retryBackoffConfig,
      store: stores.transactions,
      tip$: this.tip$,
      walletProvider: this.walletProvider
    });
    this.utxo = createUtxoTracker({
      addresses$,
      retryBackoffConfig,
      store: stores.utxo,
      tipBlockHeight$,
      transactionsInFlight$: this.transactions.outgoing.inFlight$,
      walletProvider: this.walletProvider
    });
    this.delegation = createDelegationTracker({
      epoch$,
      retryBackoffConfig,
      rewardAccountAddresses$: this.addresses$.pipe(
        map((addresses) => addresses.map((groupedAddress) => groupedAddress.rewardAccount))
      ),
      stakePoolSearchProvider: this.stakePoolSearchProvider,
      stores,
      timeSettings$: this.timeSettings$,
      transactionsTracker: this.transactions,
      walletProvider: this.walletProvider
    });
    this.balance = createBalanceTracker(this.protocolParameters$, this.utxo, this.delegation);
    this.assets$ = new PersistentDocumentTrackerSubject(
      createAssetsTracker({
        assetProvider: this.assetProvider,
        balanceTracker: this.balance,
        nftMetadataProvider: createNftMetadataProvider(
          this.walletProvider,
          // this is not very efficient, consider storing TxAlonzo[] in transactions tracker history
          this.transactions.history.all$.pipe(map((txs) => txs.map(({ tx }) => tx)))
        ),
        retryBackoffConfig
      }),
      stores.assets
    );
  }

  async validateInitializeTxProps(props: InitializeTxProps): Promise<InitializeTxPropsValidationResult> {
    const { coinsPerUtxoWord } = await firstValueFrom(this.protocolParameters$);
    const minimumCoinQuantities = new Map<Cardano.TxOut, MinimumCoinQuantity>();
    for (const output of props.outputs || []) {
      const minimumCoin = BigInt(computeMinimumCoinQuantity(coinsPerUtxoWord)(output.value.assets));
      minimumCoinQuantities.set(output, {
        coinMissing: BigIntMath.max([minimumCoin - output.value.coins, 0n])!,
        minimumCoin
      });
    }
    return { minimumCoinQuantities };
  }
  async initializeTx(props: InitializeTxProps): Promise<InitializeTxResult> {
    const { constraints, utxo, implicitCoin, validityInterval, changeAddress } = await this.#prepareTx(props);
    const { selection: inputSelection } = await this.#inputSelector.select({
      constraints,
      implicitCoin,
      outputs: props.outputs || new Set(),
      utxo: new Set(utxo)
    });
    const { body, hash } = await createTransactionInternals({
      auxiliaryData: props.auxiliaryData,
      certificates: props.certificates,
      changeAddress,
      inputSelection,
      validityInterval,
      withdrawals: props.withdrawals
    });
    return { body, hash, inputSelection };
  }
  async finalizeTx(
    tx: TxInternals,
    auxiliaryData?: Cardano.AuxiliaryData,
    stubSign = false
  ): Promise<Cardano.NewTxAlonzo> {
    const signatures = stubSign
      ? keyManagementUtil.stubSignTransaction(tx.body, this.#keyAgent.knownAddresses)
      : await this.#keyAgent.signTransaction(tx);
    return {
      auxiliaryData,
      body: tx.body,
      id: tx.hash,
      // TODO: add support for the rest of the witness properties
      witness: { signatures }
    };
  }
  async submitTx(tx: Cardano.NewTxAlonzo): Promise<void> {
    this.#newTransactions.submitting$.next(tx);
    try {
      await this.txSubmitProvider.submitTx(coreToCsl.tx(tx).to_bytes());
      this.#newTransactions.pending$.next(tx);
    } catch (error) {
      this.#newTransactions.failedToSubmit$.next({
        error: error as Cardano.TxSubmissionError,
        reason: TransactionFailure.FailedToSubmit,
        tx
      });
      throw error;
    }
  }
  signData(props: SignDataProps): Promise<Cip30DataSignature> {
    return cip30signData({ keyAgent: this.#keyAgent, ...props });
  }
  sync() {
    this.#tip$.sync();
  }
  shutdown() {
    this.balance.shutdown();
    this.utxo.shutdown();
    this.transactions.shutdown();
    this.networkInfo$.complete();
    this.protocolParameters$.complete();
    this.genesisParameters$.complete();
    this.#tip$.complete();
    this.addresses$.complete();
    this.assetProvider.stats.shutdown();
    this.walletProvider.stats.shutdown();
    this.txSubmitProvider.stats.shutdown();
    this.timeSettingsProvider.stats.shutdown();
    this.stakePoolSearchProvider.stats.shutdown();
  }

  #prepareTx(props: InitializeTxProps) {
    return lastValueFrom(
      combineLatest([this.tip$, this.utxo.available$, this.protocolParameters$, this.addresses$]).pipe(
        take(1),
        map(([tip, utxo, protocolParameters, [{ address: changeAddress }]]) => {
          const validityInterval = ensureValidityInterval(tip.slot, props.options?.validityInterval);
          const constraints = defaultSelectionConstraints({
            buildTx: async (inputSelection) => {
              this.#logger.debug('Building TX for selection constraints', inputSelection);
              const txInternals = await createTransactionInternals({
                auxiliaryData: props.auxiliaryData,
                certificates: props.certificates,
                changeAddress,
                inputSelection,
                validityInterval,
                withdrawals: props.withdrawals
              });
              return coreToCsl.tx(await this.finalizeTx(txInternals, props.auxiliaryData, true));
            },
            protocolParameters
          });
          const implicitCoin = Cardano.util.computeImplicitCoin(protocolParameters, props);
          return { changeAddress, constraints, implicitCoin, utxo, validityInterval };
        })
      )
    );
  }

  #initializeAddress(knownAddresses?: GroupedAddress[]): Observable<GroupedAddress[]> {
    return new Observable((observer) => {
      const existingAddress = knownAddresses?.length && knownAddresses?.[0];
      if (existingAddress) {
        observer.next([existingAddress]);
        return;
      }
      this.#keyAgent
        .deriveAddress({
          index: 0,
          type: AddressType.External
        })
        .then((newAddress) => observer.next([newAddress]))
        .catch(observer.error);
    });
  }
}
