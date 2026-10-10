import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    proxy: {
      '/api/callmebot': {
        target: 'https://api.callmebot.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/callmebot/, ''),
      },
      '/api/textbelt': {
        target: 'https://textbelt.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/textbelt/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
})