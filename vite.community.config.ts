import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
function localLeaderboard(): Plugin {
  return {
    name: 'campus-local-leaderboard',
    apply: 'serve',
    config() {
      const target = process.env.CAMPUS_LOCAL_API;
      if (!target || !/^http:\/\/127\.0\.0\.1:\d+$/.test(target))
        throw new Error('请用 npm run dev 同时启动游戏和本地排行榜。');
      return {
        server: {
          watch: { ignored: ['**/.wrangler/**'] },
          proxy: {
            '/api': {
              target,
              // The browser talks to Vite on the same origin. Only a loopback worker is reachable.
              configure(proxy) {
                proxy.on('proxyReq', (request) =>
                  request.removeHeader('origin'),
                );
              },
            },
          },
        },
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/leaderboard.json') return next();
        const protocol = server.config.server.https ? 'https' : 'http';
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(
          JSON.stringify({ apiBase: `${protocol}://${req.headers.host}` }),
        );
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), localLeaderboard()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
});
