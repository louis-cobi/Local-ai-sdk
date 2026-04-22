import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { readFile } from 'node:fs/promises';

async function assertPath(path) {
  await access(path, constants.F_OK);
}

await assertPath(new URL('../../packages/local-ai-sdk/dist/index.js', import.meta.url));

const sdkDist = await readFile(new URL('../../packages/local-ai-sdk/dist/index.js', import.meta.url), 'utf8');
if (!sdkDist.includes('createLlamaRNProvider')) {
  throw new Error('ESM bundle does not expose createLlamaRNProvider symbol');
}
if (!sdkDist.includes('downloadModel')) {
  throw new Error('ESM bundle does not expose downloadModel symbol');
}

const sdkPkgRaw = await readFile(new URL('../../packages/local-ai-sdk/package.json', import.meta.url), 'utf8');
const sdkPkg = JSON.parse(sdkPkgRaw);
if (!sdkPkg.exports?.['.']?.import || !sdkPkg.exports?.['.']?.require || !sdkPkg.exports?.['.']?.types) {
  throw new Error('local-ai-sdk exports map is incomplete');
}
