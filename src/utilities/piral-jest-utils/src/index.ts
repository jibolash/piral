import type { Config } from '@jest/types';
import { deepMerge } from './utils';
import defaultConfig from './config';

function extendConfig(userConfig: Config.InitialOptions) {
  return mergeConfig(defaultConfig, userConfig);
}

function mergeConfig(baseConfig: Config.InitialOptions, userConfig: Config.InitialOptions): Config.InitialOptions {
  return deepMerge(baseConfig, userConfig);
}

export default defaultConfig;

export { defaultConfig, extendConfig, mergeConfig };
