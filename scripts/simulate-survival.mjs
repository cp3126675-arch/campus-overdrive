import { build } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const outDir = await mkdtemp(join(tmpdir(), 'campus-survival-balance-'));
try {
  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      ssr: 'scripts/simulate-survival.ts',
      outDir,
      rolldownOptions: { output: { entryFileNames: 'run.mjs' } },
    },
  });
  await import(pathToFileURL(join(outDir, 'run.mjs')).href);
} finally {
  await rm(outDir, { recursive: true, force: true });
}
