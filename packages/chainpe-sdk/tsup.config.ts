import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', arc: 'src/arc.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'node18'
})
