import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)
            ) {
              return 'react-vendor'
            }
            if (
              /[\\/]node_modules[\\/](framer-motion|lucide-react)[\\/]/.test(id)
            ) {
              return 'ui-vendor'
            }
          }
        },
      },
    },
  },
})
