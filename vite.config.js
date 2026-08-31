import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/dashboard': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  // npm run preview 도 dev 와 동일하게 main 으로 라우팅. vite 5.x 부터
  // preview proxy 는 server.proxy 와 별개로 명시 필요.
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/dashboard': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  build: {
    // CF Pages reads from dist/. Old legacy build wrote to ../public for
    // Express static serving.
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
