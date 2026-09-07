import { build } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const outDir = await mkdtemp(join(tmpdir(), 'campus-tests-'));
try {
  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      ssr: 'scripts/test-game.ts',
      outDir,
      rollupOptions: { output: { entryFileNames: 'test.mjs' } },
    },
  });
  await import(pathToFileURL(join(outDir, 'test.mjs')).href);
} finally {
  await rm(outDir, { recursive: true, force: true });
}
