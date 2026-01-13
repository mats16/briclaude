import { build } from './app.js';
import detectPort from 'detect-port';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT_FILE_PATH = path.join(__dirname, '../../../.api-port');

const start = async () => {
  const app = await build();

  try {
    const isDevelopment = app.config.NODE_ENV === 'development';
    const basePort = isDevelopment ? app.config.PORT : app.config.DATABRICKS_APP_PORT;

    if (isDevelopment) {
      // 開発環境: 空きポートを検出
      const availablePort = await detectPort(basePort);

      if (basePort !== availablePort) {
        app.log.warn(`Port ${basePort} is in use, using ${availablePort} instead`);
      }

      // ポート番号をファイルに書き込み
      await fs.writeFile(PORT_FILE_PATH, String(availablePort), 'utf-8');
      app.log.info(`API port written to ${PORT_FILE_PATH}`);

      // プロセス終了時のクリーンアップ
      const cleanup = async () => {
        try {
          await fs.unlink(PORT_FILE_PATH);
          app.log.info('API port file cleaned up');
        } catch {
          // ファイルが存在しない場合は無視
        }
        process.exit(0);
      };

      // exitイベントでは同期処理のみ使用
      const cleanupSync = () => {
        try {
          fsSync.unlinkSync(PORT_FILE_PATH);
        } catch {
          // ファイルが存在しない場合は無視
        }
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('exit', cleanupSync);

      await app.listen({ port: availablePort, host: '0.0.0.0' });
      console.log(`Server listening on http://localhost:${availablePort}`);
    } else {
      // 本番環境: 従来通り
      await app.listen({ port: basePort, host: '0.0.0.0' });
      console.log(`Server listening on http://localhost:${basePort}`);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
