import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Writes sw.js listing every built file so the whole app is cached on first visit (offline-ready). */
function offlineServiceWorker(): Plugin {
  return {
    name: 'margin-offline-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter(f => !f.endsWith('.map'));
      const extra = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png', 'icons/favicon-64.png', 'icons/wordmark.png'];
      const precache = ['./', './index.html', ...[...files, ...extra].filter(f => f !== 'index.html').map(f => `./${f}`)];
      const version = createHash('sha1').update(files.sort().join('|')).digest('hex').slice(0, 10);
      const template = readFileSync(resolve(__dirname, 'src/sw-template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replaceAll('__VERSION__', () => version)
          .replaceAll('__PRECACHE__', () => JSON.stringify([...new Set(precache)], null, 2)),
      });
    },
  };
}

// base './' keeps every path relative, so the app works from any GitHub Pages address
// (https://you.github.io/margin/) without configuration.
export default defineConfig({
  base: './',
  plugins: [react(), offlineServiceWorker()],
  build: { outDir: 'docs', emptyOutDir: true },
});
