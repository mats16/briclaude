import { build } from './app.js';

const start = async () => {
  const app = await build();

  try {
    const isDevelopment = app.config.NODE_ENV === 'development';
    const port = isDevelopment ? app.config.PORT : app.config.DATABRICKS_APP_PORT;

    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
