import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Las peticiones a /api se reenvian al backend, de modo que el navegador
    // ve un solo origen y no hace falta relajar la politica de CORS en
    // desarrollo. En produccion la direccion de la API se toma de
    // VITE_API_URL en tiempo de compilacion.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    // La vista previa sirve la compilación de producción y reenvía /api igual
    // que el servidor de desarrollo, de modo que el paquete construido se
    // puede probar contra el backend local sin recompilarlo.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
