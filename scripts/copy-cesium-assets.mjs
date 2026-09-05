import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const sourceRoot = resolve(process.cwd(), 'node_modules/cesium/Build/Cesium');
const destinationRoot = resolve(process.cwd(), 'public/cesium');
const directories = ['Assets', 'ThirdParty', 'Widgets', 'Workers'];

if (!existsSync(sourceRoot)) {
  throw new Error('Cesium package was not installed. Run `npm install cesium` first.');
}

mkdirSync(destinationRoot, { recursive: true });

for (const directory of directories) {
  cpSync(resolve(sourceRoot, directory), resolve(destinationRoot, directory), {
    recursive: true,
    force: true,
  });
}
