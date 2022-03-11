import AppAda from '@cardano-foundation/ledgerjs-hw-app-cardano';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import { TransportError } from '../errors';
import { DeviceType, CommunicationType } from '../types'

export interface DeviceCommunicationType {
  deviceType: DeviceType;
  communicationType: CommunicationType;
}

export const createTransport = async (activeTransport?: TransportWebHID): Promise<TransportWebHID> => {
  let transport;
  try {
    if (activeTransport) {
      transport = await TransportWebHID.open(activeTransport.device);        
    } else {
      transport = await TransportWebHID.request();
    }
    return transport
  } catch(error) {
    throw error;
  }
}

export const createDeviceConnection = async (activeTransport: TransportWebHID): Promise<AppAda> => {
  try {
    const deviceConnection = new AppAda(activeTransport);
    // Perform app check to see if device can respond
    await deviceConnection.getVersion();
    return deviceConnection;
  } catch(error) {
    throw error;
  }
}

export const establishDeviceConnection = async ({
  deviceType,
  communicationType,
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
      throw new TransportError('Transport failed')
    }
    const isSupportedLedgerModel = transport.deviceModel.id === "nanoS" || transport.deviceModel.id === "nanoX";
    if (deviceType === DeviceType.Ledger && !isSupportedLedgerModel) {
      throw new TransportError('Ledger device model not supported');
    }
    const deviceConnection = await createDeviceConnection(transport);
    return deviceConnection;
  } catch(error) {
    // If transport is established we need to close it so we can recover device from previous session
    if (transport) {
      transport.close()
    }
    throw error;
  }
} 