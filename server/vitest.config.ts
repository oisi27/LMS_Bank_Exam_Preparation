import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DB_PATH: path.resolve(__dirname, 'bank_exam_test.db')
    },
    // Run test files sequentially to ensure clean, deterministic SQLite state
    fileParallelism: false,
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 15000
  }
});
