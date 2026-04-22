import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { readFile } from 'node:fs/promises';

async function assertPath(path) {
  await access(path, constants.F_OK);
}

await assertPath(new URL('../../packages/local-ai-sdk/dist/index.js', import.meta.url));
await assertPath(new URL('../../packages/local-ai-sdk-models/dist/index.js', import.meta.url));
await assertPath(new URL('../../packages/local-ai-sdk-llama/dist/index.js', import.meta.url));

const models = await import('../../packages/local-ai-sdk-models/dist/index.js');
if (typeof models.downloadModel !== 'function') {
  throw new Error('ESM export downloadModel is missing from local-ai-sdk-models');
}

const sdkPkgRaw = await readFile(new URL('../../packages/local-ai-sdk/package.json', import.meta.url), 'utf8');
const sdkPkg = JSON.parse(sdkPkgRaw);
if (!sdkPkg.exports?.['.']?.import || !sdkPkg.exports?.['.']?.require || !sdkPkg.exports?.['.']?.types) {
  throw new Error('local-ai-sdk exports map is incomplete');
}
