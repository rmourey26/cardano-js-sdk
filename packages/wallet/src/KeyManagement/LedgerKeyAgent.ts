import { Cardano } from '@cardano-sdk/core';
import { DeviceCommunicationType, /*createDeviceConnection,*/ establishDeviceConnection } from './util/deviceConnection';
import { GenericError, GenericErrorType, TransportError } from './errors';
import { GroupedAddress, KeyAgentType, SerializableLedgerKeyAgentData, SignBlobResult } from './types';
import { KeyAgentBase } from './KeyAgentBase';
import AppAda, { GetVersionResponse, utils } from '@cardano-foundation/ledgerjs-hw-app-cardano';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import type Transport from '@ledgerhq/hw-transport';
import { CommunicationType, DeviceType } from './types';

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

  static async createTransport(activeTransport?: TransportWebHID): Promise<TransportWebHID> {
    return await (activeTransport ? TransportWebHID.open(activeTransport.device) : TransportWebHID.request());
  }

  static async createDeviceConnection(activeTransport: Transport): Promise<AppAda> {
    const deviceConnection = new AppAda(activeTransport);
    // Perform app check to see if device can respond
    await deviceConnection.getVersion();
    return deviceConnection;
  };

  static async establishDeviceConnection({
    deviceType,
    communicationType
  }: DeviceCommunicationType): Promise<AppAda>{
    let transport;
    if (deviceType !== DeviceType.Ledger) {
      throw new TransportError('Device type not supported');
    }
    if (communicationType !== CommunicationType.Web) {
      throw new TransportError('Communication method not supported');
    }
    try {
      transport = await LedgerKeyAgent.createTransport();
      if (!transport || !transport.deviceModel) {
        throw new TransportError('Transport failed');
      }
      const isSupportedLedgerModel = transport.deviceModel.id === 'nanoS' || transport.deviceModel.id === 'nanoX';
      if (deviceType === DeviceType.Ledger && !isSupportedLedgerModel) {
        throw new TransportError('Ledger device model not supported');
      }
      return await LedgerKeyAgent.createDeviceConnection(transport);
    } catch (error) {
      // If transport is established we need to close it so we can recover device from previous session
      if (transport) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        transport.close();
      }
      throw error;
    }
  };

  static async checkDeviceConnection(deviceConnection: AppAda, deviceCommunicationType: DeviceCommunicationType): Promise<AppAda> {
    try {
      if (!deviceConnection.transport) {
        throw new TransportError('Missing transport');
      }
      // Create / Check device connection with currently active transport
      return await LedgerKeyAgent.createDeviceConnection(deviceConnection.transport);
    } catch (error) {
      // Device disconnected -> re-establish connection
      if (error.name === 'DisconnectedDeviceDuringOperation') {
        return await establishDeviceConnection(deviceCommunicationType);
      }
      throw error;
    }
  }

  static async getAppVersion(deviceConnection: AppAda, deviceCommunicationType: DeviceCommunicationType): Promise<GetVersionResponse> {
    const recoveredDeviceConnection = await LedgerKeyAgent.checkDeviceConnection(deviceConnection, deviceCommunicationType);
    return await recoveredDeviceConnection.getVersion();
  }

  async getExtendedAccountPublicKey(deviceConnection: AppAda): Promise<Cardano.Bip32PublicKey> {
    const recoveredDeviceConnection = await LedgerKeyAgent.checkDeviceConnection(deviceConnection, this.#deviceCommunicationType);
    const derivationPath = `1852'/1815'/${this.#accountIndex}'`;
    const extendedPublicKey = await recoveredDeviceConnection.getExtendedPublicKey({
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
