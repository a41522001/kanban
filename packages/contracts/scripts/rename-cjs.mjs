import { readdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const outputDirectory = fileURLToPath(new URL('../dist/cjs/', import.meta.url));
const entries = await readdir(outputDirectory, { withFileTypes: true });

await Promise.all(
  entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => {
      const sourcePath = join(outputDirectory, entry.name);
      const targetPath = sourcePath.replace(/\.js$/, '.cjs');

      return rename(sourcePath, targetPath);
    }),
);
