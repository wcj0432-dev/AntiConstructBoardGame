import { packager } from '@electron/packager';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.argv[2] || 'win32';
const arch = process.argv[3] || 'x64';
if (!['win32', 'linux'].includes(platform) || !['x64', 'arm64'].includes(arch)) throw new Error('Unsupported desktop target');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const staging = path.join(root, '.desktop-stage');
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(path.join(root, 'dist'), path.join(staging, 'dist'), { recursive: true });
await cp(path.join(root, 'desktop/main.cjs'), path.join(staging, 'main.cjs'));
await writeFile(path.join(staging, 'package.json'), JSON.stringify({ name: pkg.name, productName: '诸界联邦', version: pkg.version, author: pkg.author, main: 'main.cjs' }, null, 2));
const paths = await packager({
  dir: staging, name: 'FederationOfWorlds', platform, arch,
  electronVersion: '44.7.0', appVersion: pkg.version,
  asar: true, overwrite: true, out: path.join(root, 'artifacts/desktop'),
  download: { cacheRoot: path.join(root, '.cache/electron') },
  ...(platform === 'win32' ? { win32metadata: { ProductName: '诸界联邦', FileDescription: 'Federation of Worlds · Offline board game' } } : {}),
});
for (const output of paths) {
  await cp(path.join(root, 'PLAYER_GUIDE.md'), path.join(output, '游玩说明.md'));
  await cp(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(output, 'THIRD_PARTY_NOTICES.md'));
  await cp(path.join(root, 'RULES.md'), path.join(output, 'RULES.md'));
  console.log(`Desktop package: ${output}`);
}
await rm(staging, { recursive: true, force: true });
