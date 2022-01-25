import { setBasePath, registerModule } from '../../utils';
import type { DefaultLoaderConfig, PiletMetadataV2, Pilet } from '../../types';

/**
 * Loads the provided modules by their URL. Performs a
 * SystemJS import.
 * @param modules The names of the modules to resolve.
 * @returns A tuple containing the source and the evaluated module.
 */
function loadSystemModule(source: string) {
  return System.import(source).then(
    (value): [string, any] => [source, value],
    (error): [string, any] => {
      console.error('Failed to load SystemJS module', source, error);
      return [source, {}];
    },
  );
}

/**
 * Loads the provided SystemJS-powered pilet.
 * @param meta The pilet's metadata.
 * @param _config The loader configuration.
 * @returns The evaluated pilet that can now be integrated.
 */
export default function loader(meta: PiletMetadataV2, _config: DefaultLoaderConfig): Promise<Pilet> {
  const deps = meta.dependencies;
  const link = setBasePath(meta, meta.link);

  if (deps) {
    for (const depName of Object.keys(deps)) {
      if (!System.has(depName)) {
        const depUrl = deps[depName];
        registerModule(depName, () => System.import(depUrl));
      }
    }
  }

  return loadSystemModule(link).then(([_, app]) => ({ ...meta, ...app }));
}
