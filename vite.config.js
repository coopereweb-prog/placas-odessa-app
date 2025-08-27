import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Otimizações para produção
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar Google Maps em chunk próprio
          'google-maps': ['@react-google-maps/api'],
          // Separar Supabase em chunk próprio
          'supabase': ['@supabase/supabase-js'],
          // Separar UI components
          'ui': ['lucide-react', '@radix-ui/react-tabs'],
          // Chunk do React
          'react-vendor': ['react', 'react-dom']
        }
      }
    },
    // Aumentar limite de aviso para chunks grandes
    chunkSizeWarningLimit: 1000,
    // Otimizações adicionais
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs em produção
        drop_debugger: true
      }
    }
  },
  // Configurações para desenvolvimento
  server: {
    port: 5173,
    host: true, // Permite acesso externo
    open: false
  },
  // Otimizações de dependências
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@react-google-maps/api',
      '@supabase/supabase-js',
      'lucide-react'
    ]
  }
})
