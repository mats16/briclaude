import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { ClientRequest } from 'http';

const __dirname = import.meta.dirname;

export default defineConfig(async ({ mode }) => {
  // Load env file from project root
  const env = loadEnv(mode, '../../', '');

  return {
    plugins: [react()],
    define: {
      'import.meta.env.DATABRICKS_HOST': JSON.stringify(env.DATABRICKS_HOST || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3003,
      headers: {
        'Cache-Control': 'no-store',
      },
      proxy: {
        '/api': {
          target: `http://localhost:8003`,
          changeOrigin: true,
          ws: true,
          rewriteWsOrigin: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          configure: (proxy: any, _options: any) => {
            // Helper function to inject headers
            const injectHeaders = (proxyReq: ClientRequest) => {
              const token = env.DATABRICKS_TOKEN;
              const userName = env.DATABRICKS_USER_NAME;
              const userId = env.DATABRICKS_USER_ID;
              const userEmail = env.DATABRICKS_USER_EMAIL;

              if (token) {
                proxyReq.setHeader('x-forwarded-access-token', token);
              }
              if (userName) {
                proxyReq.setHeader('x-forwarded-preferred-username', userName);
              }
              if (userId) {
                proxyReq.setHeader('x-forwarded-user', userId);
              }
              if (userEmail) {
                proxyReq.setHeader('x-forwarded-email', userEmail);
              }
            };

            // HTTP requests
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            proxy.on('proxyReq', (proxyReq: any, _req: any, _res: any) => {
              injectHeaders(proxyReq);
            });

            // WebSocket upgrade requests
            proxy.on(
              'proxyReqWs',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (proxyReq: any, _req: any, _socket: any, _options: any, _head: any) => {
                injectHeaders(proxyReq);
              }
            );
          },
        },
      },
    },
  };
});
