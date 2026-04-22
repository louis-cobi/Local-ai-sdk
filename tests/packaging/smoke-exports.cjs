const fs = require('node:fs');

function assertExists(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing build output: ${path}`);
  }
}

assertExists('./packages/local-ai-sdk/dist/index.cjs');
assertExists('./packages/local-ai-sdk/dist/react.cjs');
assertExists('./packages/local-ai-sdk/dist/llama.cjs');
assertExists('./packages/local-ai-sdk/dist/models/node.cjs');
assertExists('./packages/local-ai-sdk/dist/models/rn.cjs');

const sdkDist = fs.readFileSync('./packages/local-ai-sdk/dist/index.cjs', 'utf8');
if (sdkDist.includes('createLlamaRNProvider')) {
  throw new Error('Core CJS bundle must not expose llama entrypoint symbols');
}
if (sdkDist.includes('downloadModel')) {
  throw new Error('Core CJS bundle must not expose node downloader symbols');
}
