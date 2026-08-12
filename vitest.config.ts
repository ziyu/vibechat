import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/api/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@config': resolve(__dirname, './config.ts'),
      '@libs': resolve(__dirname, './libs'),
      '@vibechat/api-contracts': resolve(__dirname, './packages/api-contracts/src'),
      '@vibechat/product-client': resolve(__dirname, './packages/product-client/src'),
      '@vibechat/product-core': resolve(__dirname, './packages/product-core/src'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
});
