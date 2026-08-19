import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // bcryptjs (pure-JS bcrypt) is meaningfully slower than native bcrypt at
    // cost 12 — some tests perform two hash/compare cycles in one test.
    testTimeout: 15000,
  },
})
