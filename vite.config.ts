import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Carica le variabili d'ambiente dal file .env se presente
  // Fix: Use '.' instead of process.cwd() to avoid TS error "Property 'cwd' does not exist on type 'Process'"
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    // 'base: ./' è FONDAMENTALE per far funzionare l'app in sottocartelle di SharePoint
    base: './', 
    define: {
      // Questo inietta la tua API KEY nel codice compilato in modo sicuro
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      // Ottimizzazione per ridurre il numero di file generati
      rollupOptions: {
        output: {
          manualChunks: undefined,
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    }
  }
})