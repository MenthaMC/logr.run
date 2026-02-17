import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: false,
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('recharts')) {
            return 'charts';
          }
          if (id.includes('lucide-react')) {
            return 'icons';
          }
        }
      }
    }
  }
});
