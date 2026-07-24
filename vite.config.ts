import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

const reZW   = /[\u200B-\u200D\uFEFF\u2060]/g;
const reNBSP = /\u00A0/g;
const reQ1   = /[\u2018\u2019\u201A\u201B\u2032\u00B4]/g;
const reQ2   = /[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g;

function stripWeirdChars(): PluginOption {
  return {
    name: 'strip-weird-chars',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.(?:[cm]?[tj]sx?)$/.test(id)) return null;
      const cleaned = code
        .replace(reZW, '')
        .replace(reNBSP, ' ')
        .replace(reQ1, "'")
        .replace(reQ2, '"');
      return cleaned === code ? null : { code: cleaned, map: null };
    },
  };
}

export default defineConfig({
  plugins: [react(), stripWeirdChars()],
  server: { port: 5173, strictPort: false },
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('leaflet')) return 'vendor-leaflet';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('ethers') || id.includes('@metamask')) return 'vendor-web3';
            return 'vendor';
          }
        }
      }
    }
  }
});
