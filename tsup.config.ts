import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library entry - clean build without CLI or server
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    splitting: true,
    sourcemap: false,
    clean: true,
    external: ['react', 'jotai', 'mongodb'],
  },
  // MongoDB storage adapter - separate bundle with mongodb included
  {
    entry: ['src/storage/mongodb-entry.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/storage',
    splitting: false,
    sourcemap: false,
    external: ['react', 'jotai'],
  },
  // JSONL storage adapter - separate bundle with Node.js dependencies
  {
    entry: ['src/storage/jsonl-entry.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/storage',
    splitting: false,
    sourcemap: false,
    external: ['react', 'jotai'],
  },
  // Server entry - separate bundle with all dependencies bundled
  {
    entry: ['src/server/entry.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/server',
    splitting: false,
    sourcemap: false,
    external: ['react', 'jotai'],
  },
  // Server CLI entry - separate CJS bundle with all dependencies
  {
    entry: ['src/server/cli.ts'],
    format: ['cjs'],
    dts: false,
    outDir: 'dist',
    noExternal: ['mongodb'],
  },
]);
