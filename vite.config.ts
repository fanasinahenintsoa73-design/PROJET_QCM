import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
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
