import { build } from './app.js';

const start = async () => {
  const app = await build();

  try {
    // Use PORT in development, DATABRICKS_APP_PORT in production
    const port =
      app.config.NODE_ENV === 'production' ? app.config.DATABRICKS_APP_PORT : app.config.PORT;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
