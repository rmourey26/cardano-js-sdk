import { TransportError } from './errors';
import { Cardano } from '@cardano-sdk/core';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import type Transport from '@ledgerhq/hw-transport';
import AppAda, { GetVersionResponse, GetExtendedPublicKeyResponse, utils } from '@cardano-foundation/ledgerjs-hw-app-cardano';
import { GroupedAddress, KeyAgentType } from './types';

export interface InMemoryLedgerKeyAgentProps {
  networkId: Cardano.NetworkId;
  accountIndex: number;
  knownAddresses: GroupedAddress[];
}

export interface FromExtendedPublicKeyProps {
  networkId: Cardano.NetworkId;
  extendedPublicKey: string;
  accountIndex?: number;
}

export interface ExtendedPublicKeyResult {
  address: string;
  path: string;
  publicKey: string;
  chainCode?: string;
}

export enum TransportType {
  WebHid = 'webhid',
  NodeHid = 'nodehid'
}

export interface InitiateTransportProps {
  transportType: TransportType;
}

// TODO - extend KeyAgentBase
export class InMemoryLedgerKeyAgent {
  readonly #networkId: Cardano.NetworkId;
  readonly #accountIndex: number;
  readonly #knownAddresses: GroupedAddress[];
  #activeTransport: Transport;

  constructor({ networkId, accountIndex, knownAddresses }: InMemoryLedgerKeyAgentProps) {
    this.#accountIndex = accountIndex;
    this.#networkId = networkId;
    this.#knownAddresses = knownAddresses;
  }

  get networkId(): Cardano.NetworkId {
    return this.#networkId;
  }

  get accountIndex(): number {
    return this.#accountIndex;
  }

  get activeTransport(): Transport {
    return this.#activeTransport;
  }

  get __typename(): KeyAgentType {
    return KeyAgentType.InMemoryLedger;
  }

  get knownAddresses(): GroupedAddress[] {
    return this.#knownAddresses;
  }

  // TODO - enable node based apps to establish communication using node-hid
  // TODO - enable bluetooth communication
  static async initiateTransport(): Promise<Transport> {
    return await TransportWebHID.create();
  }

  /**
   * @returns Result object containing the Ledger Cardano App version number and compatibility
   */
  static async getAppVersion(transport: Transport): Promise<GetVersionResponse> {
    try {
      const appAdaConnection = new AppAda(transport);
      return await appAdaConnection.getVersion();
    } catch (error) {
      if (!transport) {
        throw new TransportError('Missing transport', error);
      }
      throw error;
    }
  }

  /**
   * Get a public key from the specified BIP 32 path.
   *
   * @param path. Path to public key which should be derived. A path must begin with `44'/1815'/account'` or `1852'/1815'/account'`, and may be up to 10 indexes long.
   * @returns The extended public key (i.e. with chaincode) for the given path.
   *
   * @example
   * ```
   * const [{ publicKey, chainCode }] = await getExtendedPublicKey(Transport, "1852'/1815'/0'");
   * ```
   */
  static async getExtendedPublicKey(
    transport: Transport,
    derivationPath : string
  ): Promise<GetExtendedPublicKeyResponse> {
    try {
      const appAdaConnection = new AppAda(transport);
      return await appAdaConnection.getExtendedPublicKey({
        path: utils.str_to_path(derivationPath), // BIP32Path
      });
    } catch (error) {
      if (!transport) {
        throw new TransportError('Missing transport', error);
      }
      throw error;
    }
  }
}
