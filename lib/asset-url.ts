import manifest from './asset-manifest.json';
// Relative URLs work at both localhost/ and GitHub Pages /campus-overdrive/.
export function assetUrl(path: string) {
  const record = (manifest as Record<string, { file: string }>)[path];
  return '.' + (record?.file || path);
}
