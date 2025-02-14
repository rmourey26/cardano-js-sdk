/* eslint-disable import/imports-first */
require('../../scripts/patchRequire');
import * as envalid from 'envalid';
import { LogLevel, createLogger } from 'bunyan';
import { Logger } from 'ts-log';
import { TxSubmitHttpServer } from '../TxSubmit';
import { URL } from 'url';
import { loggerMethodNames } from '../util';
import { ogmiosTxSubmitProvider } from '@cardano-sdk/ogmios';
import onDeath from 'death';

// Todo: Hoist some to ogmios package, import and merge here and in wallet e2e tests
const envSpecs = {
  API_URL: envalid.url({ default: 'http://localhost:3000' }),
  LOGGER_MIN_SEVERITY: envalid.str({ choices: loggerMethodNames as string[], default: 'info' }),
  OGMIOS_URL: envalid.url({ default: 'ws://localhost:1337' })
};

void (async () => {
  const env = envalid.cleanEnv(process.env, envSpecs);
  const apiUrl = new URL(env.API_URL);
  const ogmiosUrl = new URL(env.OGMIOS_URL);
  const logger: Logger = createLogger({
    level: env.LOGGER_MIN_SEVERITY as LogLevel,
    name: 'tx-submit-http-server'
  });
  const txSubmitProvider = await ogmiosTxSubmitProvider({
    host: ogmiosUrl?.hostname,
    port: ogmiosUrl ? Number.parseInt(ogmiosUrl.port) : undefined,
    tls: ogmiosUrl?.protocol === 'wss'
  });
  const server = TxSubmitHttpServer.create(
    { listen: { host: apiUrl.hostname, port: Number.parseInt(apiUrl.port) } },
    { logger, txSubmitProvider }
  );
  await server.initialize();
  await server.start();
  onDeath(async () => {
    await server.shutdown();
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  });
})();
