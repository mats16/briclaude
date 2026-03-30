import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';
import path from 'path';

const __dirname = import.meta.dirname;

// JSON Schema for environment variables
const schema = {
  type: 'object',
  required: ['DATABASE_URL', 'ENCRYPTION_KEY', 'DATABRICKS_HOST'],
  properties: {
    // Server
    NODE_ENV: {
      type: 'string',
      default: 'development',
      enum: ['development', 'production', 'test'],
      description: 'Node environment (development, production, or test)',
    },
    PORT: {
      type: 'integer',
      default: 8003,
      description:
        'Server port (used in development, overridden by DATABRICKS_APP_PORT in production)',
    },
    // Database (required)
    DATABASE_URL: {
      type: 'string',
      description: 'PostgreSQL connection string',
    },
    DISABLE_AUTO_MIGRATION: {
      type: 'boolean',
      default: false,
      description: 'Disable automatic database migration on startup',
    },
    // Encryption (required)
    ENCRYPTION_KEY: {
      type: 'string',
      minLength: 64,
      maxLength: 64,
      pattern: '^[0-9a-fA-F]{64}$',
      description:
        'AES-256-GCM encryption key (64 hex chars). Must be valid hexadecimal characters only.',
    },
    // User directories (optional)
    USER_BASE_DIR: {
      type: 'string',
      default: path.join(__dirname, '../../../../tmp/users'), // -> project root tmp/users
      description: 'The base directory for user directories (default: ./tmp/users).',
    },
    // Databricks Apps defaults
    DATABRICKS_APP_NAME: {
      type: 'string',
      default: '',
      description: 'The name of the running app.',
    },
    DATABRICKS_WORKSPACE_ID: {
      type: 'string',
      default: '',
      description: 'The unique ID for the Databricks workspace the app belongs to.',
    },
    DATABRICKS_HOST: {
      type: 'string',
      description: 'Databricks workspace host (without protocol)',
    },
    DATABRICKS_APP_PORT: {
      type: 'integer',
      default: 8000,
      description: 'The network port the app should listen on.',
    },
    DATABRICKS_CLIENT_ID: {
      type: 'string',
      default: '',
      description: 'The client ID for the Databricks service principal assigned to the app.',
    },
    DATABRICKS_CLIENT_SECRET: {
      type: 'string',
      default: '',
      description: 'The OAuth secret for the Databricks service principal assigned to the app.',
    },
    // Anthropic
    ANTHROPIC_BASE_URL: {
      type: 'string',
      default: '',
      description: 'The base URL for the Anthropic API.',
    },
    ANTHROPIC_DEFAULT_OPUS_MODEL: {
      type: 'string',
      default: 'databricks-claude-opus-4-6',
      description: 'The default OPUS model for the Anthropic API.',
    },
    ANTHROPIC_DEFAULT_SONNET_MODEL: {
      type: 'string',
      default: 'databricks-claude-sonnet-4-6',
      description: 'The default SONNET model for the Anthropic API.',
    },
    ANTHROPIC_DEFAULT_HAIKU_MODEL: {
      type: 'string',
      default: 'databricks-claude-haiku-4-5',
      description: 'The default HAIKU model for the Anthropic API.',
    },
    // System
    HOME: {
      type: 'string',
      default: '/home/app',
      description: 'The home directory for the app user.',
    },
    PATH: {
      type: 'string',
      default: '/usr/local/bin:/usr/bin:/bin',
      description: 'The system PATH for the app user.',
    },
    // Event Persistence (In-Memory Batcher)
    EVENT_PERSIST_BATCH_SIZE: {
      type: 'integer',
      default: 10,
      description: 'Number of events to buffer before flushing to DB.',
    },
    EVENT_PERSIST_INTERVAL: {
      type: 'number',
      default: 5.0,
      description: 'Maximum seconds between flushes to DB.',
    },
  },
};

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      NODE_ENV: 'development' | 'production' | 'test';
      /** The network port the app should listen on. (only used in development) */
      PORT: number;
      /** The PostgreSQL connection string. */
      DATABASE_URL: string;
      /** Disable automatic database migration on startup. */
      DISABLE_AUTO_MIGRATION: boolean;
      /** The AES-256-GCM encryption key (64 hex chars). Leave empty for plaintext mode (NOT recommended for production). */
      ENCRYPTION_KEY: string;
      /** The base directory for user directories (e.g. /home/app/users). */
      USER_BASE_DIR: string;
      /** The name of the running app. */
      DATABRICKS_APP_NAME: string;
      /** The unique ID for the Databricks workspace the app belongs to. */
      DATABRICKS_WORKSPACE_ID: string;
      /** The host of the Databricks workspace to which the app belongs. (without protocol) */
      DATABRICKS_HOST: string;
      /** The network port the app should listen on. */
      DATABRICKS_APP_PORT: number;
      /** The client ID for the Databricks service principal assigned to the app. */
      DATABRICKS_CLIENT_ID: string;
      /** The OAuth secret for the Databricks service principal assigned to the app. */
      DATABRICKS_CLIENT_SECRET: string;
      // Anthropic
      ANTHROPIC_BASE_URL: string;
      ANTHROPIC_DEFAULT_OPUS_MODEL: string;
      ANTHROPIC_DEFAULT_SONNET_MODEL: string;
      ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
      // System
      HOME: string;
      PATH: string;
      // Event Persistence (In-Memory Batcher)
      EVENT_PERSIST_BATCH_SIZE: number;
      EVENT_PERSIST_INTERVAL: number;
    };
  }
}

export default fp(
  async fastify => {
    try {
      await fastify.register(fastifyEnv, {
        confKey: 'config',
        schema,
        dotenv:
          process.env.NODE_ENV == 'test'
            ? false
            : {
                path: path.join(__dirname, '../../../../.env'), // -> project root .env
              },
      });
      // Add bin directory to PATH (for databricks-cli and jq)
      fastify.config.PATH = `${fastify.config.HOME}/bin:${fastify.config.PATH}`;
      // Set Anthropic base URL
      fastify.config.ANTHROPIC_BASE_URL = `https://${fastify.config.DATABRICKS_HOST}/serving-endpoints/anthropic`;
      fastify.log.info('Configuration loaded and validated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error({ message }, 'Failed to load configuration');
      throw error;
    }
  },
  {
    name: 'config',
    // No dependencies - must load first
  }
);
