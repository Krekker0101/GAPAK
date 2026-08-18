import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8080';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 600,
      minify: 'esbuild',
      cssCodeSplit: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            router: ['react-router-dom'],
            query: ['@tanstack/react-query'],
            motion: ['motion'],
            icons: ['lucide-react'],
          },
        },
      },
    },
    server: {
	  // The React app runs on :3000. Forward API calls only; Vite's SPA
	  // fallback continues to handle browser routes such as /posts and /chats.
	  proxy: {
		'/api/v1': {
		  target: apiTarget,
		  changeOrigin: true,
		},
	  },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
