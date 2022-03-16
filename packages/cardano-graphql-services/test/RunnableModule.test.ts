import { InvalidModuleState } from '../src/errors';
import { Logger, dummyLogger } from 'ts-log';
import { RunnableModule } from '../src';
import { createStubLogger } from './util/stubLogger';

class SomeRunnableModule extends RunnableModule {
  constructor(logger = dummyLogger) {
    super('Some Module', logger);
  }

  protected initializeImpl(): Promise<void> {
    return Promise.resolve();
  }

  protected startImpl(): Promise<void> {
    return Promise.resolve();
  }

  protected shutdownImpl(): Promise<void> {
    return Promise.resolve();
  }
}

describe('RunnableModule', () => {
  let loggerInfoSpy: jest.SpyInstance;
  let logger: Logger;

  beforeEach(() => {
    logger = createStubLogger();
  });

  describe('construction', () => {
    it('initially has null state', () => {
      const runnableModule = new SomeRunnableModule();
      expect(runnableModule.state).toBeNull();
    });
    it('optionally takes a logger on construction', () => {
      loggerInfoSpy = jest.spyOn(logger, 'info');
      const runnableModule = new SomeRunnableModule(logger);
      expect(runnableModule.state).toBeNull();
      expect(loggerInfoSpy).not.toHaveBeenCalled();
    });
  });
  describe('initialize', () => {
    let runnableModule: RunnableModule;

    beforeEach(() => {
      runnableModule = new SomeRunnableModule(logger);
      loggerInfoSpy = jest.spyOn(logger, 'info');
    });

    it('changes state if not already in progress, and logs info', async () => {
      expect(runnableModule.state).toBeNull();
      await runnableModule.initialize();
      expect(runnableModule.state).toBe('initialized');
      expect(loggerInfoSpy).toHaveBeenCalled();
      loggerInfoSpy.mockReset();
      await expect(runnableModule.initialize()).rejects.toThrowError(InvalidModuleState);
      expect(runnableModule.state).toBe('initialized');
      expect(loggerInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    let runnableModule: RunnableModule;

    beforeEach(async () => {
      runnableModule = new SomeRunnableModule(logger);
      await runnableModule.initialize();
      loggerInfoSpy = jest.spyOn(logger, 'info');
    });

    it('changes state if initialized and not already in progress, and logs info', async () => {
      expect(runnableModule.state).toBe('initialized');
      await runnableModule.start();
      expect(loggerInfoSpy).toHaveBeenCalled();
      expect(runnableModule.state).toBe('running');
      loggerInfoSpy.mockReset();
      await expect(runnableModule.initialize()).rejects.toThrowError(InvalidModuleState);
      expect(runnableModule.state).toBe('running');
      expect(loggerInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    let runnableModule: RunnableModule;

    beforeEach(async () => {
      runnableModule = new SomeRunnableModule(logger);
      await runnableModule.initialize();
      await runnableModule.start();
      loggerInfoSpy = jest.spyOn(logger, 'info');
    });

    it('changes state if running and not already in progress, and logs info', async () => {
      expect(runnableModule.state).toBe('running');
      await runnableModule.shutdown();
      expect(loggerInfoSpy).toHaveBeenCalled();
      expect(runnableModule.state).toBe('initialized');
      loggerInfoSpy.mockReset();
      await expect(runnableModule.initialize()).rejects.toThrowError(InvalidModuleState);
      await expect(runnableModule.shutdown()).rejects.toThrowError(InvalidModuleState);
      expect(runnableModule.state).toBe('initialized');
      expect(loggerInfoSpy).not.toHaveBeenCalled();
    });
  });
});
