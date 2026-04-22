/**
 * Platform-agnostic file I/O for session metadata.
 * In React Native, provide an adapter backed by expo-file-system or react-native-fs.
 */
export type SessionStorageAdapter = {
  readText(path: string): Promise<string | null>;
  writeText(path: string, data: string): Promise<void>;
  writeTextAtomic?(path: string, data: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
};

export async function createNodeSessionStorageAdapter(): Promise<SessionStorageAdapter | null> {
  try {
    const fs = await import('node:fs/promises');
    const pathMod = await import('node:path');
    return {
      async readText(path: string) {
        try {
          return await fs.readFile(path, 'utf8');
        } catch (e: unknown) {
          const err = e as { code?: string };
          if (err.code === 'ENOENT') return null;
          throw e;
        }
      },
      async writeText(path: string, data: string) {
        await fs.mkdir(pathMod.dirname(path), { recursive: true });
        await fs.writeFile(path, data, 'utf8');
      },
      async writeTextAtomic(path: string, data: string) {
        const tmpPath = `${path}.tmp`;
        await fs.mkdir(pathMod.dirname(path), { recursive: true });
        await fs.writeFile(tmpPath, data, 'utf8');
        try {
          await fs.rename(tmpPath, path);
        } catch {
          // Some filesystems can fail atomic rename; preserve data with a direct write fallback.
          await fs.writeFile(path, data, 'utf8');
          await fs.unlink(tmpPath).catch(() => {});
        }
      },
      async exists(path: string) {
        try {
          await fs.access(path);
          return true;
        } catch {
          return false;
        }
      },
      async delete(path: string) {
        try {
          await fs.unlink(path);
        } catch (e: unknown) {
          const err = e as { code?: string };
          if (err.code !== 'ENOENT') throw e;
        }
      },
    };
  } catch {
    return null;
  }
}
