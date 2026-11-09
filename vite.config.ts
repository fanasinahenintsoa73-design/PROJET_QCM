import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Écrit dist/version.json avec le nom du bundle d'entrée.
 * Le site compare ce fichier à son propre script pour détecter un déploiement.
 */
function versionFile(): Plugin {
  return {
    name: 'medqcm-version-file',
    apply: 'build',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(
        (item) => item.type === 'chunk' && item.isEntry,
      )
      const version = entry && entry.type === 'chunk' ? entry.fileName : 'unknown'
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(
          { version, builtAt: new Date().toISOString() },
          null,
          2,
        ),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFile()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['.localhost', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
    watch: {
      ignored: ['**/.playwright-mcp/**', '**/dist/**'],
    },
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['.localhost', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
})
