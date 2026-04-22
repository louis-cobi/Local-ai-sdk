# Publishing to npm

The **root** package (`local-ai-sdk-monorepo`) is `private: true` and is **not** published.
Primary public package target is **`local-ai-sdk`**.

## Prerequisites

1. An [npm](https://www.npmjs.com/) account and `npm login` on your machine.  
2. Built artifacts: from the repo root, run `npm run build`.  
3. **Unique package names** on the public registry. Pick scoped names if needed, e.g. `@your-scope/local-ai-sdk`.

## Versioning

Bump `version` in `packages/local-ai-sdk/package.json` for public releases.
Legacy packages can keep internal versions when not published.

## Commands (from repository root)

Dry run (recommended):

```bash
npm run release:check
npm publish -w local-ai-sdk --dry-run
```

Publish:

```bash
npm publish -w local-ai-sdk
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

`local-ai-sdk` runs `prepack` → `npm run build` so `dist/` is fresh when publishing from a clean clone.

## Consuming in another project

```bash
npm install local-ai-sdk llama.rn react
```

See [GETTING-STARTED.md](./GETTING-STARTED.md).
