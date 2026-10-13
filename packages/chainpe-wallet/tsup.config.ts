import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  entry: { index: 'src/index.ts' },
  // Inline the shared Arc constants so the MCPB bundle needs no unpublished package.
  noExternal: ['@chainpearc/sdk'],
  define: { __PKG_VERSION__: JSON.stringify(version) },
  format: ['esm'],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node'
  }
})
