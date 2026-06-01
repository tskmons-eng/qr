import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@firebase') || id.includes('/firebase/')) return 'vendor-firebase'
          if (id.includes('react')) return 'vendor-react'
          if (id.includes('jspdf')) return 'vendor-jspdf'
          if (id.includes('html2canvas')) return 'vendor-html2canvas'
          if (id.includes('dompurify')) return 'vendor-dompurify'
          if (id.includes('canvg')) return 'vendor-canvg'
          if (id.includes('browser-image-compression')) return 'vendor-image-compression'
          if (id.includes('heic2any')) return 'vendor-heic'
          return undefined
        },
      },
    },
  },
})
