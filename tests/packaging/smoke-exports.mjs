import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

async function assertPath(path) {
  await access(path, constants.F_OK);
}

await assertPath(new URL('../../packages/local-ai-sdk/dist/index.js', import.meta.url));
await assertPath(new URL('../../packages/local-ai-sdk/dist/react.js', import.meta.url));
await assertPath(new URL('../../packages/local-ai-sdk/dist/llama.js', import.meta.url));
await assertPath(new URL('../../packages/local-ai-sdk/dist/models/node.js', import.meta.url));
await assertPath(new URL('../../packages/local-ai-sdk/dist/models/rn.js', import.meta.url));

const sdkDist = await readFile(new URL('../../packages/local-ai-sdk/dist/index.js', import.meta.url), 'utf8');
if (sdkDist.includes('createLlamaRNProvider')) {
  throw new Error('Core bundle must not expose llama entrypoint symbols');
}
if (sdkDist.includes('downloadModel')) {
  throw new Error('Core bundle must not expose node downloader symbols');
}

const sdkPkgRaw = await readFile(new URL('../../packages/local-ai-sdk/package.json', import.meta.url), 'utf8');
const sdkPkg = JSON.parse(sdkPkgRaw);
if (!sdkPkg.exports?.['.']?.import || !sdkPkg.exports?.['.']?.require || !sdkPkg.exports?.['.']?.types) {
  throw new Error('local-ai-sdk exports map is incomplete');
}
if (!sdkPkg.exports?.['./react'] || !sdkPkg.exports?.['./llama']) {
  throw new Error('Subpath exports for react/llama are missing');
}
if (!sdkPkg.exports?.['./models/node'] || !sdkPkg.exports?.['./models/rn']) {
  throw new Error('Subpath exports for model helpers are missing');
}
