import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file from project root
  const env = loadEnv(mode, '../../', '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
          rewriteWsOrigin: true,
          configure: (proxy, _options) => {
            // Helper function to inject headers
            const injectHeaders = (proxyReq: any) => {
              const token = env.DATABRICKS_TOKEN;
              const userName = env.DATABRICKS_USER_NAME;
              const userId = env.DATABRICKS_USER_ID;
              const userEmail = env.DATABRICKS_USER_EMAIL;

              if (token) {
                proxyReq.setHeader('x-forwarded-access-token', token);
              }
              if (userName) {
                proxyReq.setHeader('X-Forwarded-Preferred-Username', userName);
              }
              if (userId) {
                proxyReq.setHeader('X-Forwarded-User', userId);
              }
              if (userEmail) {
                proxyReq.setHeader('X-Forwarded-Email', userEmail);
              }
            };

            // HTTP requests
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              injectHeaders(proxyReq);
            });

            // WebSocket upgrade requests
            proxy.on('proxyReqWs', (proxyReq, _req, _socket, _options, _head) => {
              injectHeaders(proxyReq);
            });
          },
        },
      },
    },
  };
});
