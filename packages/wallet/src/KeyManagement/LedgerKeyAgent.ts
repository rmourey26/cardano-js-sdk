import { Cardano } from '@cardano-sdk/core';
import { DeviceCommunicationType, createDeviceConnection, establishDeviceConnection } from './util/deviceConnection';
import { GenericError, GenericErrorType, TransportError } from './errors';
import { GroupedAddress, KeyAgentType, SerializableLedgerKeyAgentData, SignBlobResult } from './types';
import { KeyAgentBase } from './KeyAgentBase';
import AppAda, { GetVersionResponse, utils } from '@cardano-foundation/ledgerjs-hw-app-cardano';

export interface LedgerKeyAgentProps {
  networkId: Cardano.NetworkId;
  accountIndex: number;
  knownAddresses: GroupedAddress[];
  deviceConnection: AppAda;
  deviceCommunicationType: DeviceCommunicationType;
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
  readonly #deviceCommunicationType: DeviceCommunicationType;
  #extendedAccountPublicKey: Cardano.Bip32PublicKey;
  #deviceConnection: AppAda;

  constructor({
    networkId,
    accountIndex,
    knownAddresses,
    deviceConnection,
    deviceCommunicationType
  }: LedgerKeyAgentProps) {
    super();
    this.#accountIndex = accountIndex;
    this.#networkId = networkId;
    this.#knownAddresses = knownAddresses;
    this.#deviceConnection = deviceConnection;
    this.#deviceCommunicationType = deviceCommunicationType;
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
      extendedAccountPublicKey: this.#extendedAccountPublicKey,
      knownAddresses: this.#knownAddresses,
      networkId: this.networkId
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
      return await createDeviceConnection(this.#deviceConnection.transport);
    } catch (error) {
      // Device disconnected -> re-establish connection
      if (error.name === 'DisconnectedDeviceDuringOperation') {
        const deviceConenction = await establishDeviceConnection(this.#deviceCommunicationType);
        this.#deviceConnection = deviceConenction;
        return deviceConenction;
      }
      throw error;
    }
  }

  async getAppVersion(): Promise<GetVersionResponse> {
    await this.checkDeviceConnection();
    return await this.#deviceConnection.getVersion();
  }

  async getExtendedAccountPublicKey(): Promise<Cardano.Bip32PublicKey> {
    await this.checkDeviceConnection();
    const derivationPath = `1852'/1815'/${this.#accountIndex}'`;
    const extendedPublicKey = await this.#deviceConnection.getExtendedPublicKey({
      path: utils.str_to_path(derivationPath) // BIP32Path
    });
    const xPubHex = `${extendedPublicKey.publicKeyHex}${extendedPublicKey.chainCodeHex}`;
    const xPub = Cardano.Bip32PublicKey(xPubHex);
    this.#extendedAccountPublicKey = xPub;
    return xPub;
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
