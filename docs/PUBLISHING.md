# Publishing to npm

The **root** package (`local-ai-sdk-monorepo`) is `private: true` and is **not** published.
Primary public package target is **`local-ai-sdk`**.

## Package architecture for npm

`local-ai-sdk` is published as one package with split subpath entrypoints:

- `local-ai-sdk` (core engine, RN-safe)
- `local-ai-sdk/react`
- `local-ai-sdk/llama`
- `local-ai-sdk/models/node`
- `local-ai-sdk/models/rn`

The exports map uses conditional branches (`react-native`, `node`, `import`, `require`) so React Native consumers do not walk Node-only imports.

## Positioning statement for npm

Use this wording consistently in npm metadata and docs:

> Local-first LLM runtime for React Native (`llama.rn`): stateful turns, tool loop orchestration, session persistence, optional memory/RAG, and platform-aware model download entrypoints.

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

## Consumer smoke checks

Before publish, run:

```bash
npm run test:smoke:exports
npm run test:smoke:consumer-pack
```

`test:smoke:consumer-pack` creates a tarball (`npm pack`), installs it into temporary Node and RN-like consumer projects, and verifies that subpath imports resolve without entrypoint breakage.

## Consuming in another project

```bash
npm install local-ai-sdk llama.rn react-native expo
```

See [GETTING-STARTED.md](./GETTING-STARTED.md).
