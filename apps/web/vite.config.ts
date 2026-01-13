import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { ClientRequest } from 'http';
import detectPort from 'detect-port';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT_FILE_PATH = path.join(__dirname, '../../.api-port');

// APIポートをファイルから読み込み（リトライ機能付き）
async function getApiPort(maxRetries = 10, retryDelay = 500): Promise<number> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const content = await fs.readFile(PORT_FILE_PATH, 'utf-8');
      const port = parseInt(content.trim(), 10);
      if (!isNaN(port)) {
        console.log(`✓ API server port detected: ${port}`);
        return port;
      }
    } catch {
      // ファイルがまだ存在しない場合は待機
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // フォールバック
  console.warn('⚠ Could not detect API port, falling back to 8000');
  return 8000;
}

export default defineConfig(async ({ mode }) => {
  // Load env file from project root
  const env = loadEnv(mode, '../../', '');

  // APIポートを取得
  const apiPort = await getApiPort();

  // Viteポートを検出
  const desiredVitePort = 3000;
  const vitePort = await detectPort(desiredVitePort);

  if (desiredVitePort !== vitePort) {
    console.log(`⚠ Port ${desiredVitePort} is in use, using ${vitePort} instead`);
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: vitePort,
      headers: {
        'Cache-Control': 'no-store',
      },
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            proxy.on('proxyReqWs', (proxyReq: any, _req: any, _socket: any, _options: any, _head: any) => {
              injectHeaders(proxyReq);
            });
          },
        },
      },
    },
  };
});
