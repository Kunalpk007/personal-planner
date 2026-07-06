import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup/localStorage.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'lib/engine/**/*.ts',
        'store/slices/**/*.ts',
        'store/userScope.ts',
      ],
      exclude: ['**/*.d.ts', 'tests/**'],
      thresholds: {
        statements: 99,
        branches:   85,
        functions:  99,
        lines:      99,
      },
    },
  },
})
