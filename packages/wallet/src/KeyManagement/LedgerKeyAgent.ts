import { TransportError, GenericError, GenericErrorType } from './errors';
import { Cardano } from '@cardano-sdk/core';
import AppAda, { GetVersionResponse, utils } from '@cardano-foundation/ledgerjs-hw-app-cardano';
import { KeyAgentBase } from './KeyAgentBase';
import { establishDeviceConnection, createDeviceConnection } from './util/deviceConnection';
import { GroupedAddress, KeyAgentType, SerializableLedgerKeyAgentData, SignBlobResult } from './types';

export interface LedgerKeyAgentProps {
  networkId: Cardano.NetworkId;
  accountIndex: number;
  knownAddresses: GroupedAddress[];
  deviceConnection: AppAda,
}

export enum TransportType {
  WebHid = 'webhid',
  NodeHid = 'nodehid'
}

// TODO - extend KeyAgentBase
export class LedgerKeyAgent extends KeyAgentBase {
  readonly #networkId: Cardano.NetworkId;
  readonly #accountIndex: number;
  readonly #knownAddresses: GroupedAddress[];
  #extendedAccountPublicKey: Cardano.Bip32PublicKey;
  #deviceConnection: AppAda;

  constructor({ networkId, accountIndex, knownAddresses, deviceConnection }: LedgerKeyAgentProps) {
    super();
    this.#accountIndex = accountIndex;
    this.#networkId = networkId;
    this.#knownAddresses = knownAddresses;
    this.#deviceConnection = deviceConnection;
  }

  get networkId(): Cardano.NetworkId {
    return this.#networkId;
  }

  get accountIndex(): number {
    return this.#accountIndex;
  }

  get deviceConnection(): AppAda {
    return this.#deviceConnection;
  }

  get __typename(): KeyAgentType {
    return KeyAgentType.Ledger;
  }

  get knownAddresses(): GroupedAddress[] {
    return this.#knownAddresses;
  }

  get extendedAccountPublicKey(): Cardano.Bip32PublicKey {
    return this.#extendedAccountPublicKey;
  }

  get serializableData(): SerializableLedgerKeyAgentData {
    return {
      __typename: KeyAgentType.Ledger,
      accountIndex: this.#accountIndex,
      knownAddresses: this.#knownAddresses,
      extendedAccountPublicKey: this.#extendedAccountPublicKey,
      networkId: this.networkId,
    };
  }

  // TODO - enable node based apps to establish communication using node-hid
  // TODO - enable bluetooth communication
  async checkDeviceConnection(): Promise<AppAda> {
    try {
      if (!this.#deviceConnection.transport) {
        throw new TransportError('Missing transport');
      }
      // Create / Check device connection with currently active transport
      const deviceConnection = await createDeviceConnection(this.#deviceConnection.transport);
      return deviceConnection;
    } catch(error) {
      // Device disconnected -> re-establish connection
      if (error.name === 'DisconnectedDeviceDuringOperation') {
        const deviceConenction = await establishDeviceConnection();
        this.#deviceConnection = deviceConenction;
        return deviceConenction;
      }
      throw error;
    }
  }


  /**
   * @returns Result object containing the Ledger Cardano App version number and compatibility
   */
  async getAppVersion(): Promise<GetVersionResponse> {
    try {
      await this.checkDeviceConnection();
      return await this.#deviceConnection.getVersion();
    } catch (error) {
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
   * const [{ publicKeyHex, chainCodeHex }] = await getExtendedPublicKey(Transport, "1852'/1815'/0'");
   * ```
   */
  async getExtendedAccountPublicKey(): Promise<Cardano.Bip32PublicKey> {
    try {
      await this.checkDeviceConnection();
      const derivationPath = `1852'/1815'/${this.#accountIndex}'`;
      const extendedPublicKey = await this.#deviceConnection.getExtendedPublicKey({
        path: utils.str_to_path(derivationPath), // BIP32Path
      });
      const xPubHex = `${extendedPublicKey.publicKeyHex}${extendedPublicKey.chainCodeHex}`
      const xPub = Cardano.Bip32PublicKey(xPubHex);
      this.#extendedAccountPublicKey = xPub;
      return xPub;
    } catch (error) {
      throw error;
    }
  }

  async signBlob(): Promise<SignBlobResult> {
    throw new GenericError(GenericErrorType.NO_METHOD);
  }

  async derivePublicKey(): Promise<Cardano.Ed25519PublicKey> {
    throw new GenericError(GenericErrorType.NO_METHOD);
  }

  // TODO - this should be moved / removed from KeyAgentBase. Root private key is stored on device in this case
  async exportRootPrivateKey(): Promise<Cardano.Bip32PrivateKey> {
    throw new GenericError(GenericErrorType.NO_METHOD);
  }
}
