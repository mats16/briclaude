import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';
import path from 'path';

const __dirname = import.meta.dirname;

const homeDir = process.env.HOME ?? '/tmp';

// JSON Schema for environment variables
const schema = {
	type: 'object',
	required: ['DATABASE_URL', 'DATABRICKS_HOST'],
	properties: {
		// Database (required)
		DATABASE_URL: {
			type: 'string',
			description: 'PostgreSQL connection string',
		},
		// Encryption (optional - empty string = plaintext mode)
		ENCRYPTION_KEY: {
			type: 'string',
			description: 'AES-256-GCM encryption key (64 hex chars). Leave empty for plaintext mode (NOT recommended for production).',
		},
		// User and session directories (optional)
		USER_BASE_DIR: {
			type: 'string',
			default: path.join(homeDir, 'users'),
			description: 'The base directory for user directories (e.g. /home/app/users).',
		},
		SESSION_BASE_DIR: {
			type: 'string',
			default: path.join(homeDir, 'ws'),
			description: 'The base directory for working directories (e.g. /home/app/ws).',
		},
		// Warehouse IDs (optional)
		WAREHOUSE_ID_2XS: {
			type: 'string',
      default: '',
			description: 'SQL Warehouse ID for 2XS size',
		},
		WAREHOUSE_ID_XS: {
			type: 'string',
      default: '',
			description: 'SQL Warehouse ID for XS size',
		},
		WAREHOUSE_ID_S: {
			type: 'string',
      default: '',
			description: 'SQL Warehouse ID for S size',
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
      default: `https://${process.env.DATABRICKS_HOST}/serving-endpoints/anthropic`,
      description: 'The base URL for the Anthropic API.',
    },
    ANTHROPIC_DEFAULT_OPUS_MODEL: {
      type: 'string',
      default: 'databricks-claude-opus-4-5',
      description: 'The default OPUS model for the Anthropic API.',
    },
    ANTHROPIC_DEFAULT_SONNET_MODEL: {
      type: 'string',
      default: 'databricks-claude-sonnet-4-5',
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
      description: 'The system PATH for the app user.',
    },
	},
};

declare module 'fastify' {
	interface FastifyInstance {
	  config: { // this should be the same as the confKey in options
      // Database
      DATABASE_URL: string
      // Encryption
      ENCRYPTION_KEY?: string
      // User and working directories
      USER_BASE_DIR: string
      SESSION_BASE_DIR: string
      // Warehouse IDs
      WAREHOUSE_ID_2XS: string
      WAREHOUSE_ID_XS: string
      WAREHOUSE_ID_S: string
      // Databricks Apps defaults
      DATABRICKS_APP_NAME: string
      DATABRICKS_WORKSPACE_ID: string
      DATABRICKS_HOST: string
      DATABRICKS_APP_PORT: number
      DATABRICKS_CLIENT_ID: string
      DATABRICKS_CLIENT_SECRET: string
      // Anthropic
      ANTHROPIC_BASE_URL: string
      ANTHROPIC_DEFAULT_OPUS_MODEL: string
      ANTHROPIC_DEFAULT_SONNET_MODEL: string
      ANTHROPIC_DEFAULT_HAIKU_MODEL: string
      // System
      HOME: string
      PATH: string
	  };
	}
};


export default fp(
	async (fastify) => {
		await fastify.register(fastifyEnv, {
      confKey: 'config',
			schema,
			dotenv: {
				path: path.join(__dirname, '../../.env'), // -> app/.env (parent of backend/)
				debug: true,
			},
		});
		fastify.log.info('Configuration loaded and validated');
	},
	{
		name: 'config',
		// No dependencies - must load first
	}
);
