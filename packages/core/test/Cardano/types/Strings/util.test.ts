import { InvalidStringError, assertIsBech32WithPrefix, assertIsHexString } from '../../../../src/Cardano';

describe('Cardano/types/Strings/util', () => {
  describe('assertIsBech32WithPrefix', () => {
    it('does not throw when asserting a valid bech32', () => {
      expect(() =>
        assertIsBech32WithPrefix('pool1ujcu3myfg9wwvdyh2ks653954lamtufy3lefjs73jrr327q53j4', 'pool')
      ).not.toThrow();
      expect(() =>
        assertIsBech32WithPrefix('pool1ujcu3myfg9wwvdyh2ks653954lamtufy3lefjs73jrr327q53j4', 'pool', 45)
      ).not.toThrow();
    });

    it('throws when decoded words length does not match the last argument', () => {
      expect(() =>
        assertIsBech32WithPrefix('pool1ujcu3myfg9wwvdyh2ks653954lamtufy3lefjs73jrr327q53j4', 'pool', 55)
      ).toThrowError(InvalidStringError);
    });

    it('throws when asserting an invalid bech32 (too short)', () => {
      expect(() => assertIsBech32WithPrefix('pool1', 'pool')).toThrowError(InvalidStringError);
    });

    it('throws when asserting an empty string', () => {
      expect(() => assertIsBech32WithPrefix('', '')).toThrowError(InvalidStringError);
    });

    it('throws when decoded prefix does not match the expected prefix', () => {
      expect(() =>
        assertIsBech32WithPrefix(
          // eslint-disable-next-line max-len
          'addr_test1qrydm8hsalwjmuqj624cwnyrs554zu6a8n8wg64dxk3zarsxu2hyfhlkwuxupa9d5085eunq2qywy7hvmvej456flknsq3qxgd',
          'pool'
        )
      ).toThrowError(InvalidStringError);
    });
  });

  describe('assertIsHexString', () => {
    it('throws when asserting an empty string', () => {
      expect(() => assertIsHexString('')).toThrowError(InvalidStringError);
    });

    it('does not throw when asserting a valid hex string', () => {
      expect(() => assertIsHexString('ABCDEF')).not.toThrowError();
      expect(() => assertIsHexString('ABCDEF', 6)).not.toThrowError();
      expect(() => assertIsHexString('1234567890abcdef')).not.toThrowError();
    });

    it('throws when string length does not match the expected length', () => {
      expect(() => assertIsHexString('ABCDEF', 5)).toThrowError(InvalidStringError);
    });

    it('throws when string has an non base16 character', () => {
      expect(() => assertIsHexString(' 1234567890abcdef')).toThrowError(InvalidStringError);
      expect(() => assertIsHexString('1234567890abcdefg')).toThrowError(InvalidStringError);
    });
  });
});
