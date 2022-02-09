import { AddressType, GroupedAddress, KeyType, util } from '../../../src/KeyManagement';
import { Cardano } from '@cardano-sdk/core';

const createAddressInput = (address: Cardano.Address) =>
  ({
    address
  } as Cardano.TxIn);

const createGroupedAddress = (address: Cardano.Address, type: AddressType, index: number): GroupedAddress =>
  ({
    address,
    index,
    type
  } as GroupedAddress);

describe('KeyManagement.util.ownSignaturePaths', () => {
  it('returns distinct derivation paths required to sign the transaction', () => {
    const address1 = Cardano.Address(
      'addr_test1qra788mu4sg8kwd93ns9nfdh3k4ufxwg4xhz2r3n064tzfgxu2hyfhlkwuxupa9d5085eunq2qywy7hvmvej456flkns6cy45x'
    );
    const address2 = Cardano.Address(
      'addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp'
    );
    const txBody = {
      certificates: [{ __typename: Cardano.CertificateType.StakeKeyRegistration }],
      inputs: [address1, address2, address1].map(createAddressInput)
    } as Cardano.TxBodyAlonzo;
    const knownAddresses = [address1, address2].map((address, index) =>
      createGroupedAddress(address, AddressType.External, index)
    );
    expect(util.ownSignatureKeyPaths(txBody, knownAddresses)).toEqual([
      {
        index: 0,
        role: KeyType.External
      },
      {
        index: 1,
        role: KeyType.External
      },
      {
        index: 0,
        role: KeyType.Stake
      }
    ]);
  });
});
