import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true permet d'ouvrir l'app depuis un téléphone sur le même réseau Wi-Fi
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
