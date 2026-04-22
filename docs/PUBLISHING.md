# Publishing to npm

The **root** package (`local-ai-sdk-monorepo`) is `private: true` and is **not** published. You publish each workspace under `packages/` separately.

## Prerequisites

1. An [npm](https://www.npmjs.com/) account and `npm login` on your machine.  
2. Built artifacts: from the repo root, run `npm run build`.  
3. **Unique package names** on the public registry. Pick scoped names if needed, e.g. `@your-scope/local-ai-sdk`.

## Versioning

Bump `version` in each package you publish. Keep `local-ai-sdk`’s dependency versions on `local-ai-sdk-llama` and `local-ai-sdk-models` in sync.

## Publish order (first release)

`local-ai-sdk` depends on the other two; **`local-ai-sdk-llama` only peers `llama.rn`** (types come from `import type` + devDependency).

1. `packages/local-ai-sdk-models` — no internal deps  
2. `packages/local-ai-sdk-llama` — no runtime dep on `local-ai-sdk`  
3. `packages/local-ai-sdk` — depends on 1 and 2  
4. `packages/local-ai-sdk-bundle` (deprecated alias) — depends only on `local-ai-sdk`  

The root `npm run build` script builds in this order.

## Commands (from repository root)

Dry run (recommended):

```bash
npm run build
npm publish -w local-ai-sdk-models --dry-run
npm publish -w local-ai-sdk-llama --dry-run
npm publish -w local-ai-sdk --dry-run
npm publish -w local-ai-sdk-bundle --dry-run
```

Publish:

```bash
npm publish -w local-ai-sdk-models
npm publish -w local-ai-sdk-llama
npm publish -w local-ai-sdk
npm publish -w local-ai-sdk-bundle
```

## Monorepo metadata (optional)

In each published `package.json`, set `repository`, `homepage`, and `bugs` so npm links to your Git host. Example:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/your-org/local-ai-sdk.git",
  "directory": "packages/local-ai-sdk"
}
```

## Prepack

Each package runs `prepack` → `npm run build` so `dist/` is fresh when publishing from a clean clone.

## Consuming in another project

```bash
npm install local-ai-sdk llama.rn react
```

See [GETTING-STARTED.md](./GETTING-STARTED.md).
