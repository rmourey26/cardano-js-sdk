
import type Transport from "@ledgerhq/hw-transport";
import type { Observable } from "rxjs";
import { from } from "rxjs";
import { Cardano } from '@cardano-sdk/core';
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid-noevents";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid-noevents';
import { registerTransportModule } from "@ledgerhq/live-common/lib/hw";
import { getCryptoCurrencyById } from "@ledgerhq/live-common/lib/currencies"
import { withDevice } from "@ledgerhq/live-common/lib/hw/deviceAccess";
import getAppAndVersion from "@ledgerhq/live-common/lib/hw/getAppAndVersion";
import getAddress from "@ledgerhq/live-common/lib/hw/getAddress";
import { GroupedAddress, KeyAgentType } from './types';

export interface InMemoryLedgerKeyAgentProps {
  networkId: Cardano.NetworkId;
  accountIndex: number;
  knownAddresses: GroupedAddress[];
}

export interface FromExtendedPublicKeyProps {
  networkId: Cardano.NetworkId;
  extendedPublicKey: string,
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
  NodeHid = 'nodehid',
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

  constructor({
    networkId,
    accountIndex,
    knownAddresses,
  }: InMemoryLedgerKeyAgentProps) {
    super();
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

  // TODO - this probably should be moved to ./utils
  static initiateTransport({
    transportType,
  }: InitiateTransportProps): void {
    registerTransportModule({
      id: 'hid',
      open: (device?: string): Promise<Transport> => {
        // Use webhid for web based apps or nodehid for node based apps
        // WebHid - It will open device selection popup in the browser
        // NodeHid - It will create a transport in the background and use last physically connected device
        // TODO - Add BLE (bluetooth) support (@ledgerhq/hw-transport-web-ble & @ledgerhq/hw-transport-node-ble)
        const transportMethod = transportType === TransportType.WebHid ? TransportWebHID : TransportNodeHid;

        // Create transport for new device or recover existing one by device ID
        return device ? transportMethod.open(device) : transportMethod.create();
      },
      disconnect: (): Promise<void> => Promise.resolve(),
    });
  }

  static getOpenedDeviceAppAndVersion(deviceId: string): Observable<{
    name: string,
    version: string,
    flags: number | Buffer,
  }> {
    /** subscribe(next => appVersion, error)
     * @returns {name: 'Cardano ADA', version: '2.4.1', flags: Uint8Array(1)} // Cardano App started on device
     * @returns {name: 'BOLOS', version: '2.1.0-rc3', flags: Uint8Array(1)} // No apps running on device
     ** Transport not initiated
     * @throws
     * {
     *   message: "Can't find handler to open undefined"
     *   name: "CantOpenDevice"
     * }
     ** Transport initiated / device not connected - popup will appear. Since there are no connected devices you will get error on popup close.
     * @throws
     * {
     *   message: "Access denied to use Ledger device"
     *   name: "CantOpenDevice"
     * }
     */
    return withDevice(deviceId)((transport: Transport) => {
      return from(
        getAppAndVersion(transport)
      )
    })
  }

  #getExtendedPublicKey({
    deviceId: string,
    derivationPath: string,
  }): Observable<ExtendedPublicKeyResult> {
    /** subscribe(next => extendedPublicKey, error)
     * @returns Public key for specific account index
     ** Transport not initiated
     * @throws
     * {
     *   message: "Can't find handler to open undefined"
     *   name: "CantOpenDevice"
     * }
     ** Transport initiated / device not connected - popup will appear. Since there are no connected devices you will get error on popup close.
     * @throws
     * {
     *   message: "Access denied to use Ledger device"
     *   name: "CantOpenDevice"
     * }
     * ** Exporting rejected on device
     * @throws - TODO
     */
    const cardanoCurrencyData = getCryptoCurrencyById('cardano');
    return withDevice(deviceId)((transport: Transport) =>
      from(
        getAddress(transport, {
          currency: cardanoCurrencyData,
          derivationMode: '',
          path: derivationPath,
          verify: true,
        })
      )
    )
  }

  /**
   * @throws AuthenticationError
   */
  static async fromExtendedPublicKey({
    networkId,
    extendedPublicKey,
    accountIndex = 0
  }: FromExtendedPublicKeyProps): Promise<InMemoryLedgerKeyAgent> {
    return new InMemoryLedgerKeyAgent({
      accountIndex,
      extendedPublicKey,
      knownAddresses: [],
      networkId,
    });
  }
}
