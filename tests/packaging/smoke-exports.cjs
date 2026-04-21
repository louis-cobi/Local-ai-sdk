const fs = require('node:fs');

function assertExists(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing build output: ${path}`);
  }
}

assertExists('./packages/local-ai-sdk/dist/index.cjs');
assertExists('./packages/local-ai-sdk-bundle/dist/index.cjs');
assertExists('./packages/local-ai-sdk-models/dist/index.cjs');

const models = require('../../packages/local-ai-sdk-models/dist/index.cjs');
if (typeof models.downloadModel !== 'function') {
  throw new Error('CJS export downloadModel is missing');
}

const bundlePkg = JSON.parse(fs.readFileSync('./packages/local-ai-sdk-bundle/package.json', 'utf8'));
if (!bundlePkg.exports || !bundlePkg.exports['.']) {
  throw new Error('Bundle package exports map is missing');
}
