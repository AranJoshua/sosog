import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * True when the module at `metaUrl` (pass `import.meta.url`) is the file Node
 * was started with, so a script can run its `main()` only when executed
 * directly and not when a test imports it.
 *
 * This replaces the earlier `import.meta.url === \`file://${process.argv[1]}\``
 * check, which never matched on Windows (`file:///C:/...` against
 * `C:\...`) or in any folder whose path has a space or other character that a
 * file URL percent-encodes. In that case `npm run sync:sheet` did nothing and
 * exited cleanly, so a build quietly reused whatever JSON was already on disk.
 *
 * `windows` is a parameter only so the Windows behaviour can be tested on any
 * machine; callers leave it at the default.
 */
export function isMainModule(
  metaUrl: string,
  entryPath: string | undefined = process.argv[1],
  windows: boolean = process.platform === 'win32'
): boolean {
  if (!entryPath) return false;
  try {
    const self = fileURLToPath(metaUrl, { windows });
    const entry = windows ? path.win32.resolve(entryPath) : path.resolve(entryPath);
    return windows ? self.toLowerCase() === entry.toLowerCase() : self === entry;
  } catch {
    return false;
  }
}
