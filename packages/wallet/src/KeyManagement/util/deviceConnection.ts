import AppAda from '@cardano-foundation/ledgerjs-hw-app-cardano';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';

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

export const establishDeviceConnection = async (): Promise<AppAda> => {
  let transport;
  try {
    transport = await createTransport();
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