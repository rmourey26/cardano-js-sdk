import { keyAgentReady, stakePoolSearchProvider, walletProvider } from './config';

xdescribe('config', () => {
  test('all config variables are set', () => {
    expect(walletProvider).toBeTruthy();
    expect(stakePoolSearchProvider).toBeTruthy();
    expect(keyAgentReady).toBeTruthy();
  });
});
