import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // A shell exporting NODE_ENV=production loads React's production build,
    // which has no act(); tests always run against the development build.
    env: { NODE_ENV: 'test' },
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    server: {
      deps: {
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
    coverage: { enabled: false },
  },
})
