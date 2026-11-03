import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: ['./test/global-setup.js'],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://fino:fino@localhost:5432/fino_test',
      JWT_SECRET: 'test-secret',
      MP_WEBHOOK_SECRET: 'test-webhook',
      NODE_ENV: 'test',
    },
  },
})
