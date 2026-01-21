import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workspaceService } from './workspace.service';
import { ApiClientError } from './api-client';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('workspaceService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mkdirs', () => {
    it('should call the correct endpoint with POST method', async () => {
      const mockResponse = {};
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const path = '/Workspace/Users/test@example.com/databricks_apps';
      await workspaceService.mkdirs(path);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/databricks/workspace/mkdirs', {
        method: 'POST',
        body: JSON.stringify({ path }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should return empty object on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const path = '/Workspace/Users/test@example.com/databricks_apps';
      const result = await workspaceService.mkdirs(path);

      expect(result).toEqual({});
    });

    it('should throw ApiClientError when request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Permission denied', error: 'FORBIDDEN' }),
      });

      const path = '/Workspace/Users/test@example.com/databricks_apps';

      try {
        await workspaceService.mkdirs(path);
        expect.fail('Expected ApiClientError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError);
        expect((error as ApiClientError).statusCode).toBe(403);
        expect((error as ApiClientError).message).toBe('Permission denied');
      }
    });

    it('should throw ApiClientError when server returns 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal server error' }),
      });

      const path = '/Workspace/Users/test@example.com/databricks_apps';

      await expect(workspaceService.mkdirs(path)).rejects.toThrow(ApiClientError);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const path = '/Workspace/Users/test@example.com/databricks_apps';

      await expect(workspaceService.mkdirs(path)).rejects.toThrow('Network error');
    });
  });

  describe('listWorkspace', () => {
    it('should call the correct endpoint with path parameter', async () => {
      const mockResponse = { objects: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const path = '/Workspace/Users/test@example.com';
      await workspaceService.listWorkspace(path);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/api/databricks/workspace/list');
      expect(calledUrl).toContain(encodeURIComponent(path));
    });
  });

  describe('getStatus', () => {
    it('should call the correct endpoint with path parameter', async () => {
      const mockResponse = {
        path: '/Workspace/Users/test@example.com/test',
        object_type: 'DIRECTORY',
        object_id: 123,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const path = '/Workspace/Users/test@example.com/test';
      const result = await workspaceService.getStatus(path);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/api/databricks/workspace/get-status');
      expect(result).toEqual(mockResponse);
    });
  });
});
