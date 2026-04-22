const fs = require('node:fs');

function assertExists(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing build output: ${path}`);
  }
}

assertExists('./packages/local-ai-sdk/dist/index.cjs');

const sdkDist = fs.readFileSync('./packages/local-ai-sdk/dist/index.cjs', 'utf8');
if (!sdkDist.includes('createLlamaRNProvider')) {
  throw new Error('CJS bundle does not expose createLlamaRNProvider symbol');
}
if (!sdkDist.includes('downloadModel')) {
  throw new Error('CJS bundle does not expose downloadModel symbol');
}
