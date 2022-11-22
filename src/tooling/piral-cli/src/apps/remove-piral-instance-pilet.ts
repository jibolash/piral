import { resolve } from 'path';
import { setLogLevel, progress, log, checkCliCompatibility } from '../common';
import { LogLevels } from '../types';

export interface RemovePiralInstancePiletOptions {
  /**
   * Sets the log level to use (1-5).
   */
  logLevel?: LogLevels;

  /**
   * The name of the Piral instance to remove.
   */
  app?: string;

  /**
   * Sets the source directory for adding the Piral instance.
   */
  source?: string;
}

export const removePiralInstancePiletDefaults: RemovePiralInstancePiletOptions = {
  logLevel: LogLevels.info,
  app: undefined,
  source: '.',
};

export async function removePiralInstancePilet(baseDir = process.cwd(), options: RemovePiralInstancePiletOptions = {}) {
  const {
    logLevel = removePiralInstancePiletDefaults.logLevel,
    source = removePiralInstancePiletDefaults.source,
    app = removePiralInstancePiletDefaults.app,
  } = options;
  const fullBase = resolve(process.cwd(), baseDir);
  setLogLevel(logLevel);
  progress('Reading configuration ...');
}
