import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, proxy the API and socket to the server (npm run dev in the root).
const server = 'http://localhost:5001'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': server,
      '/socket.io': { target: server, ws: true },
    },
  },
})
