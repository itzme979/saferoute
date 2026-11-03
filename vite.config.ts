/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/** Serves the Vercel functions in api/ during `npm run dev` (Vercel runs them in production). */
function devApi(): Plugin {
  return {
    name: 'saferoute-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/news', async (req, res) => {
        try {
          const mod = (await server.ssrLoadModule('/api/news.ts')) as { default: (r: Request) => Promise<Response> };
          const out = await mod.default(new Request(`http://localhost${req.originalUrl ?? req.url}`));
          res.statusCode = out.status;
          out.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await out.text());
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
        },
      },
    },
    chunkSizeWarningLimit: 1100,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
