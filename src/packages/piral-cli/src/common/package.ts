import { resolve, join, extname, basename, dirname, relative } from 'path';
import {
  readJson,
  copy,
  updateExistingJson,
  ForceOverwrite,
  findFile,
  checkExists,
  getHash,
  checkIsDirectory,
  matchFiles,
} from './io';
import { cliVersion } from './info';
import { logFail, logWarn } from './log';
import { getDevDependencies, PiletLanguage } from './language';
import { PiletsInfo, TemplateFileLocation } from '../types';

export interface FileInfo {
  path: string;
  hash: string;
  changed: boolean;
}

function getPiralPath(root: string, name: string) {
  return resolve(root, 'node_modules', name);
}

function getDependencyVersion(
  name: string,
  devDependencies: Record<string, string | true>,
  allDependencies: Record<string, string>,
) {
  const version = devDependencies[name];
  const selected = typeof version === 'string' ? version : version === true ? allDependencies[name] : undefined;

  if (!selected) {
    logWarn(`The version for "${name}" could not be resolved. Using "latest".`);
  }

  return selected || 'latest';
}

async function getFilesOf(root: string, name: string, file: string | TemplateFileLocation) {
  const { from, to, deep = false } = typeof file === 'string' ? { from: file, to: file, deep: false } : file;
  const sourcePath = join(getPiralPath(root, name), from);
  const targetPath = resolve(root, to);
  const isDirectory = await checkIsDirectory(sourcePath);

  if (isDirectory) {
    const pattern = deep ? '**/*' : '*';
    const files = await matchFiles(sourcePath, pattern);
    return files.map(file => ({
      sourcePath: file,
      targetPath: resolve(targetPath, relative(sourcePath, file)),
    }));
  }

  return [
    {
      sourcePath,
      targetPath,
    },
  ];
}

function findRoot(pck: string, baseDir: string) {
  try {
    const path = require.resolve(pck, {
      paths: [baseDir],
    });

    return path;
  } catch (ex) {
    return undefined;
  }
}

function findPackage(pck: string | Array<string>, baseDir: string) {
  if (Array.isArray(pck)) {
    for (const item of pck) {
      const result = findPackage(item, baseDir);

      if (result) {
        return result;
      }
    }
  } else {
    try {
      const path = require.resolve(`${pck}/package.json`, {
        paths: [baseDir],
      });

      const appPackage = require(path);
      const relPath = appPackage && appPackage.app;
      appPackage.app = relPath && resolve(dirname(path), relPath);
      return appPackage;
    } catch (ex) {
      return undefined;
    }
  }
}

export function readPiralPackage(root: string, name: string) {
  const path = getPiralPath(root, name);
  return readJson(path, 'package.json');
}

export function getPiralPackage(app: string, language: PiletLanguage) {
  const baseData = {
    app,
    main: 'lib/index.js',
    pilets: {
      ...getPiletsInfo({}),
      scripts: {
        build: 'npm run build-pilet',
        start: 'npm run debug-pilet',
      },
    },
    devDependencies: {
      ...getDevDependencies(language),
      'piral-cli': 'latest',
    },
  };

  switch (language) {
    case PiletLanguage.ts:
      return {
        ...baseData,
        typings: 'lib/index.d.ts',
        scripts: {
          start: 'piral debug',
          build: 'npm run build:deploy && npm run build:pilets',
          'build:deploy': 'piral build',
          'build:pilets': 'tsc',
        },
      };
    case PiletLanguage.js:
      return {
        ...baseData,
        scripts: {
          start: 'piral debug',
          build: 'piral build',
        },
      };
  }

  return baseData;
}

export async function getFileStats(root: string, name: string, files: Array<string | TemplateFileLocation> = []) {
  const results: Array<FileInfo> = [];
  await Promise.all(
    files.map(async file => {
      const subfiles = await getFilesOf(root, name, file);

      for (const subfile of subfiles) {
        const { sourcePath, targetPath } = subfile;
        const sourceHash = await getHash(sourcePath);
        const targetHash = await getHash(targetPath);
        results.push({
          path: targetPath,
          hash: targetHash,
          changed: sourceHash !== targetHash,
        });
      }
    }),
  );
  return results;
}

export async function copyPiralFiles(
  root: string,
  name: string,
  files: Array<string | TemplateFileLocation>,
  forceOverwrite: ForceOverwrite,
  originalFiles: Array<FileInfo> = [],
) {
  for (const file of files) {
    const subfiles = await getFilesOf(root, name, file);

    for (const subfile of subfiles) {
      const { sourcePath, targetPath } = subfile;
      const overwrite = originalFiles.some(m => m.path === targetPath && !m.changed);
      const force = overwrite ? ForceOverwrite.yes : forceOverwrite;
      await copy(sourcePath, targetPath, force);
    }
  }
}

export function getPiletsInfo(piralInfo: any): PiletsInfo {
  const {
    files = [],
    externals = [],
    scripts = {},
    validators = {},
    devDependencies = {},
    preScaffold = '',
    postScaffold = '',
    preUpgrade = '',
    postUpgrade = '',
  } = piralInfo.pilets || {};

  return {
    files,
    externals,
    scripts,
    validators,
    devDependencies,
    preScaffold,
    postScaffold,
    preUpgrade,
    postUpgrade,
  };
}

export async function retrievePiralRoot(baseDir: string, entry: string) {
  const rootDir = join(baseDir, entry);

  if (extname(rootDir) !== '.html') {
    const packageName = basename(rootDir) === 'package.json' ? rootDir : join(rootDir, 'package.json');
    const exists = await checkExists(packageName);

    if (!exists) {
      logFail(`Cannot find a valid entry point. Missing package.json in "%s".`, rootDir);
      throw new Error('Invalid Piral instance.');
    }

    const { app } = require(packageName);

    if (!app) {
      logFail(`Cannot find a valid entry point. Missing field "%s" in the "%s".`, 'app', 'package.json');
      throw new Error('Invalid Piral instance.');
    }

    return join(dirname(packageName), app);
  }

  return rootDir;
}

export async function retrievePiletsInfo(entryFile: string) {
  const exists = await checkExists(entryFile);

  if (!exists) {
    logFail(`The given entry pointing to "%s" does not exist.`, entryFile);
    throw new Error('Invalid Piral instance.');
  }

  const packageJson = await findFile(entryFile, 'package.json');

  if (!packageJson) {
    logFail('Cannot find any package.json. You need a valid package.json for your Piral instance.');
    throw new Error('Invalid Piral instance.');
  }

  const packageInfo = require(packageJson);

  return {
    ...getPiletsInfo(packageInfo),
    name: packageInfo.name,
    version: packageInfo.version,
    root: dirname(packageJson),
  };
}

export async function patchPiletPackage(
  root: string,
  name: string,
  version: string,
  piralInfo: any,
  language?: PiletLanguage,
) {
  const piralDependencies = piralInfo.dependencies || {};
  const piralDevDependencies = piralInfo.devDependencies || {};
  const allDependencies = {
    ...piralDependencies,
    ...piralDevDependencies,
  };
  const typeDependencies = language ? getDevDependencies(language) : {};
  const { externals, ...info } = getPiletsInfo(piralInfo);
  const piral = {
    comment: 'Keep this section to allow running `piral upgrade`.',
    name,
    version: piralInfo.version,
    tooling: cliVersion,
    externals,
    ...info,
  };
  const scripts = {
    'debug-pilet': 'pilet debug',
    'build-pilet': 'pilet build',
    'upgrade-pilet': 'pilet upgrade',
    ...info.scripts,
  };
  const peerDependencies = {
    ...externals.reduce(
      (deps, name) => {
        deps[name] = '*';
        return deps;
      },
      {} as Record<string, string>,
    ),
    '@dbeining/react-atom': '*',
    '@libre/atom': '*',
    history: '*',
    react: '*',
    'react-dom': '*',
    'react-router': '*',
    'react-router-dom': '*',
    tslib: '*',
    'path-to-regexp': '*',
    [name]: `*`,
  };
  const devDependencies = {
    ...Object.keys(typeDependencies).reduce(
      (deps, name) => {
        deps[name] = allDependencies[name] || typeDependencies[name];
        return deps;
      },
      {} as Record<string, string>,
    ),
    ...Object.keys(info.devDependencies).reduce(
      (deps, name) => {
        deps[name] = getDependencyVersion(name, info.devDependencies, allDependencies);
        return deps;
      },
      {} as Record<string, string>,
    ),
    ...externals.reduce(
      (deps, name) => {
        deps[name] = piralDependencies[name] || 'latest';
        return deps;
      },
      {} as Record<string, string>,
    ),
    [name]: `${version || piralInfo.version}`,
    'piral-cli': `^${cliVersion}`,
  };
  await updateExistingJson(root, 'package.json', {
    piral,
    devDependencies,
    peerDependencies,
    scripts,
  });
  return info.files;
}

export async function retrievePiletData(target: string, app?: string) {
  const packageJson = await findFile(target, 'package.json');

  if (!packageJson) {
    logFail('Cannot find the "%s". You need a valid package.json for your pilet.', 'package.json');
    throw new Error('Invalid pilet.');
  }

  const root = dirname(packageJson);
  const packageContent = require(packageJson);

  const appPackage = findPackage(
    app || (packageContent.piral && packageContent.piral.name) || Object.keys(packageContent.devDependencies),
    target,
  );
  const appFile: string = appPackage && appPackage.app;

  if (!appFile) {
    logFail(
      'Cannot find the Piral instance. Make sure the "%s" of the Piral instance is valid (has an "%s" field).',
      'package.json',
      'app',
    );
    throw new Error('Invalid Piral instance selected.');
  }

  const coreFile = findRoot('piral-core', appFile);

  if (!coreFile) {
    logFail('Cannot find the package "%s". Make sure your dependencies are correctly resolved.', 'piral-core');
    throw new Error('Invalid dependency structure.');
  }

  return {
    coreFile,
    dependencies: packageContent.dependencies || {},
    devDependencies: packageContent.devDependencies || {},
    peerDependencies: packageContent.peerDependencies || {},
    appFile,
    appPackage,
    root,
  };
}