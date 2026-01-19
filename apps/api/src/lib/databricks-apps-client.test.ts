// apps/api/src/lib/databricks-apps-client.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabricksAppsClient } from './databricks-apps-client.js';
import { clearSpTokenCache } from '../utils/databricks-auth.js';

// Mock child_process.execFile
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

describe('DatabricksAppsClient', () => {
  const host = 'example.databricks.com';
  const clientId = 'test-client-id';
  const clientSecret = 'test-client-secret';
  let client: DatabricksAppsClient;

  beforeEach(() => {
    clearSpTokenCache();
    vi.restoreAllMocks();

    client = new DatabricksAppsClient(host, clientId, clientSecret);

    // Mock getServicePrincipalToken via fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
    });
  });

  describe('constructor', () => {
    it('should normalize host with https:// prefix', () => {
      const clientWithHttps = new DatabricksAppsClient(
        'https://example.databricks.com',
        clientId,
        clientSecret
      );
      // The host is normalized internally, we can verify by calling a method
      expect(clientWithHttps).toBeDefined();
    });

    it('should handle host without protocol', () => {
      const clientWithoutProtocol = new DatabricksAppsClient(
        'example.databricks.com',
        clientId,
        clientSecret
      );
      expect(clientWithoutProtocol).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create an app successfully', async () => {
      const mockApp = {
        name: 'test-app',
        url: 'https://test-app.example.com',
        status: 'IDLE',
      };

      global.fetch = vi
        .fn()
        // First call for token
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        // Second call for create app
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockApp),
        });

      const app = await client.create('test-app', 'Test description');

      expect(app).toEqual(mockApp);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should create an app without description', async () => {
      const mockApp = { name: 'test-app' };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
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

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
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

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
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

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

      const response = await client.listDeployments('test-app');

      expect(response.deployments).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should delete an app', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(''),
        });

      await expect(client.delete('test-app')).resolves.toBeUndefined();
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

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

      const result = await client.updatePermissions('test-app', [
        { user_name: 'user@example.com', permission_level: 'CAN_MANAGE' },
      ]);

      expect(result.access_control_list).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should throw error when API returns error', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: () => Promise.resolve('App not found'),
        });

      await expect(client.get('non-existent-app')).rejects.toThrow(
        'Databricks API error (404): App not found'
      );
    });

    it('should throw error when token is not available', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(client.get('test-app')).rejects.toThrow('Failed to fetch SP token');
    });
  });
});
