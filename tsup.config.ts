import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'bin/agents': 'bin/agents.ts' },
    format: ['esm'],
    target: 'node18',
    clean: true,
    sourcemap: true,
    banner: { js: '#!/usr/bin/env node' },
    noExternal: [],
    external: [/^node:/, /^@inquirer/, 'inquirer', 'commander', 'chalk', 'zod'],
  },
  {
    entry: { 'src/index': 'src/index.ts' },
    format: ['esm'],
    target: 'node18',
    sourcemap: true,
    dts: true,
    external: [/^node:/, 'zod'],
  },
]);
