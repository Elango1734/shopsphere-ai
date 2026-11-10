/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Every `@shopsphere/*` package source file uses Node-ESM-style relative
 * imports with a `.js` extension that actually points at a sibling `.ts`
 * file (the same convention apps/api runs under tsx and apps/mobile runs
 * under a custom Metro resolver for). Vite/esbuild resolves an explicit
 * `.js` specifier literally and won't fall back to `.ts`, so without this
 * plugin every workspace package import fails to resolve in dev and build.
 */
function workspaceTsExtensionResolver(): Plugin {
  return {
    name: 'shopsphere-workspace-ts-extension-resolver',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.') || !source.endsWith('.js')) return null;
      const basedir = path.dirname(importer);
      const withoutExt = source.slice(0, -3);
      for (const ext of ['.ts', '.tsx']) {
        const candidate = path.resolve(basedir, withoutExt + ext);
        if (fs.existsSync(candidate)) return candidate;
      }
      return null;
    }
  };
}

export default defineConfig({
  plugins: [workspaceTsExtensionResolver(), react()],
  server: {
    port: 5173
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: true
  }
});
