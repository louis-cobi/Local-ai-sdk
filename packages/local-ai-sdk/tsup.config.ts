import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/react.ts',
    'src/llama.ts',
    'src/models/node.ts',
    'src/models/rn.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  target: 'es2019',
  external: ['react', 'react-native', 'llama.rn', '@op-engineering/op-sqlite', 'expo-vector-search'],
});
