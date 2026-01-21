// apps/api/src/lib/databricks-apps-client.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabricksAppsClient } from './databricks-apps-client.js';
import type { AuthProvider } from './databricks-auth.js';

// Mock child_process.execFile
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

describe('DatabricksAppsClient', () => {
  let client: DatabricksAppsClient;
  let mockAuthProvider: AuthProvider;

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock AuthProvider
    mockAuthProvider = {
      type: 'oauth-m2m',
      getToken: vi.fn().mockResolvedValue('test-token'),
      getEnvVars: vi.fn().mockReturnValue({
        DATABRICKS_AUTH_TYPE: 'oauth-m2m',
        DATABRICKS_HOST: 'https://example.databricks.com',
        DATABRICKS_CLIENT_ID: 'test-client-id',
        DATABRICKS_CLIENT_SECRET: 'test-client-secret',
      }),
    };

    client = new DatabricksAppsClient(mockAuthProvider);

    // Mock fetch for API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  describe('constructor', () => {
    it('should get host from authProvider.getEnvVars()', () => {
      expect(mockAuthProvider.getEnvVars).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create an app successfully', async () => {
      const mockApp = {
        name: 'test-app',
        url: 'https://test-app.example.com',
        status: 'IDLE',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApp),
      });

      const app = await client.create('test-app', 'Test description');

      expect(app).toEqual(mockApp);
      expect(mockAuthProvider.getToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should create an app without description', async () => {
      const mockApp = { name: 'test-app' };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApp),
      });

      const app = await client.create('test-app');
      expect(app).toEqual(mockApp);
    });
  });

  describe('deploy', () => {
    it('should deploy an app successfully', async () => {
      const mockDeployment = {
        deployment_id: 'deploy-123',
        status: 'PENDING',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDeployment),
      });

      const deployment = await client.deploy('test-app', '/Workspace/Users/user@example.com/app');

      expect(deployment).toEqual(mockDeployment);
    });
  });

  describe('get', () => {
    it('should get app information', async () => {
      const mockApp = {
        name: 'test-app',
        url: 'https://test-app.example.com',
        status: 'RUNNING',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApp),
      });

      const app = await client.get('test-app');

      expect(app).toEqual(mockApp);
    });
  });

  describe('listDeployments', () => {
    it('should list deployments', async () => {
      const mockResponse = {
        deployments: [
          { deployment_id: 'deploy-1', status: 'SUCCEEDED' },
          { deployment_id: 'deploy-2', status: 'PENDING' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await client.listDeployments('test-app');

      expect(response.deployments).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should delete an app', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      await expect(client.delete('test-app')).resolves.toBeUndefined();
    });

    it('should throw error when delete fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('App not found'),
      });

      await expect(client.delete('non-existent-app')).rejects.toThrow(
        'Databricks API error (404): App not found'
      );
    });
  });

  describe('updatePermissions', () => {
    it('should update permissions', async () => {
      const mockResponse = {
        object_id: 'apps/test-app',
        object_type: 'app',
        access_control_list: [
          {
            user_name: 'user@example.com',
            all_permissions: [{ permission_level: 'CAN_MANAGE', inherited: false }],
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.updatePermissions('test-app', [
        { user_name: 'user@example.com', permission_level: 'CAN_MANAGE' },
      ]);

      expect(result.access_control_list).toHaveLength(1);
    });
  });

  describe('start', () => {
    it('should start an app successfully', async () => {
      const mockApp = {
        name: 'test-app',
        url: 'https://test-app.example.com',
        status: 'STARTING',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApp),
      });

      const app = await client.start('test-app');

      expect(app).toEqual(mockApp);
      expect(mockAuthProvider.getToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.databricks.com/api/2.0/apps/test-app/start',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw error when starting non-existent app', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('App not found'),
      });

      await expect(client.start('non-existent-app')).rejects.toThrow(
        'Databricks API error (404): App not found'
      );
    });
  });

  describe('stop', () => {
    it('should stop an app successfully', async () => {
      const mockApp = {
        name: 'test-app',
        url: 'https://test-app.example.com',
        status: 'STOPPING',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApp),
      });

      const app = await client.stop('test-app');

      expect(app).toEqual(mockApp);
      expect(mockAuthProvider.getToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.databricks.com/api/2.0/apps/test-app/stop',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw error when stopping non-existent app', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('App not found'),
      });

      await expect(client.stop('non-existent-app')).rejects.toThrow(
        'Databricks API error (404): App not found'
      );
    });
  });

  describe('error handling', () => {
    it('should throw error when API returns error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('App not found'),
      });

      await expect(client.get('non-existent-app')).rejects.toThrow(
        'Databricks API error (404): App not found'
      );
    });

    it('should throw error when token is not available', async () => {
      const failingAuthProvider: AuthProvider = {
        type: 'oauth-m2m',
        getToken: vi.fn().mockRejectedValue(new Error('Token not available')),
        getEnvVars: vi.fn().mockReturnValue({
          DATABRICKS_AUTH_TYPE: 'oauth-m2m',
          DATABRICKS_HOST: 'https://example.databricks.com',
          DATABRICKS_CLIENT_ID: 'test-client-id',
          DATABRICKS_CLIENT_SECRET: 'test-client-secret',
        }),
      };

      const failingClient = new DatabricksAppsClient(failingAuthProvider);

      await expect(failingClient.get('test-app')).rejects.toThrow('Token not available');
    });
  });

  describe('AuthProvider types', () => {
    it('should work with PAT auth provider', async () => {
      const patAuthProvider: AuthProvider = {
        type: 'pat',
        getToken: vi.fn().mockResolvedValue('pat-token'),
        getEnvVars: vi.fn().mockReturnValue({
          DATABRICKS_AUTH_TYPE: 'pat',
          DATABRICKS_HOST: 'https://example.databricks.com',
          DATABRICKS_TOKEN: 'pat-token',
        }),
      };

      const patClient = new DatabricksAppsClient(patAuthProvider);

      const mockApp = { name: 'test-app' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApp),
      });

      const app = await patClient.get('test-app');
      expect(app).toEqual(mockApp);
      expect(patAuthProvider.getToken).toHaveBeenCalled();
    });
  });
});
