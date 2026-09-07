import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import manifest from '../lib/asset-manifest.json' with { type: 'json' };
const project = process.cwd();
const temp = resolve(project, 'outputs/static-entry');
const github = process.argv.includes('--github-pages');
const output = resolve(
  project,
  github ? 'outputs/GitHub-Pages部署版' : 'outputs/公开部署版',
);
await mkdir(temp, { recursive: true });
await writeFile(
  resolve(temp, 'index.html'),
  '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#10111c"><title>合成清华 · 徽章竞速挑战</title><meta name="description" content="手机横屏操控院徽，按合成进度挑战 Boss，合出清华并击败最终 Boss。"><link rel="icon" href="/badges/shuxue.png"></head><body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>',
);
await writeFile(
  resolve(temp, 'entry.tsx'),
  `import React from 'react';import {createRoot} from 'react-dom/client';import Home from ${JSON.stringify(resolve(project, 'app/page.tsx'))};import ${JSON.stringify(resolve(project, 'app/globals.css'))};createRoot(document.getElementById('root')!).render(<Home/>);`,
);
await build({
  configFile: false,
  root: temp,
  base: github ? './' : '/',
  publicDir: resolve(project, 'public'),
  plugins: [react()],
  resolve: { alias: { '@': project } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: output, emptyOutDir: true, target: 'es2020' },
});
if (github) {
  const htmlPath = resolve(output, 'index.html');
  const { readFile, rm } = await import('node:fs/promises');
  const html = await readFile(htmlPath, 'utf8');
  await writeFile(
    htmlPath,
    html.replaceAll(
      'href="/badges/shuxue.png"',
      `href=".${manifest['/badges/shuxue.png'].file}"`,
    ),
  );
  await writeFile(resolve(output, '.nojekyll'), '');
  // Source originals remain in Git; the playable export serves only their hashed encodings.
  for (const original of Object.keys(manifest))
    await rm(resolve(output, '.' + original));
}
console.log('Static deployment folder:', output);
