import { CommunicationType, DeviceType } from '../types';
import { TransportError } from '../errors';
import AppAda from '@cardano-foundation/ledgerjs-hw-app-cardano';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';

export interface DeviceCommunicationType {
  deviceType: DeviceType;
  communicationType: CommunicationType;
}

export const createTransport = async (activeTransport?: TransportWebHID): Promise<TransportWebHID> =>
  await (activeTransport ? TransportWebHID.open(activeTransport.device) : TransportWebHID.request());

export const createDeviceConnection = async (activeTransport: TransportWebHID): Promise<AppAda> => {
  const deviceConnection = new AppAda(activeTransport);
  // Perform app check to see if device can respond
  return await deviceConnection.getVersion();
};

export const establishDeviceConnection = async ({
  deviceType,
  communicationType
}: DeviceCommunicationType): Promise<AppAda> => {
  let transport;
  if (deviceType !== DeviceType.Ledger) {
    throw new TransportError('Device type not supported');
  }
  if (communicationType !== CommunicationType.Web) {
    throw new TransportError('Communication method not supported');
  }
  try {
    transport = await createTransport();
    if (!transport || !transport.deviceModel) {
      throw new TransportError('Transport failed');
    }
    const isSupportedLedgerModel = transport.deviceModel.id === 'nanoS' || transport.deviceModel.id === 'nanoX';
    if (deviceType === DeviceType.Ledger && !isSupportedLedgerModel) {
      throw new TransportError('Ledger device model not supported');
    }
    return await createDeviceConnection(transport);
  } catch (error) {
    // If transport is established we need to close it so we can recover device from previous session
    if (transport) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      transport.close();
    }
    throw error;
  }
};
