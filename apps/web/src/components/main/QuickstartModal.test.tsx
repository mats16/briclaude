import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { QuickstartModal } from './QuickstartModal';
import { workspaceService, reposService } from '@/services';
import type { ReposCreateResponse } from '@repo/types';

// Mock services
vi.mock('@/services', () => ({
  workspaceService: {
    mkdirs: vi.fn(),
    getStatus: vi.fn(),
  },
  reposService: {
    createRepo: vi.fn(),
  },
  jobsService: {
    getJobRuns: vi.fn(),
    getJobRunOutput: vi.fn(),
  },
}));

// Mock useUser hook
vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: {
      email: 'test@example.com',
      userName: 'Test User',
      userId: 'user-123',
    },
    hasPat: true,
    isLoading: false,
  }),
}));

// Mock fetch for GitHub API
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock window.matchMedia
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Set up i18n for testing
beforeEach(async () => {
  await i18n.init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          quickstart: {
            databricksApps: {
              title: 'Databricks Apps Templates',
              description: 'Clone a template to get started',
              clone: 'Clone',
              cloning: 'Cloning...',
              cloneError: 'Failed to clone template',
              fetchError: 'Failed to fetch templates',
              presetPrompt: 'Deploy {{templateName}} from {{path}}',
            },
          },
          workspace: {
            patRequired: 'PAT is required',
          },
          common: {
            loading: 'Loading...',
            close: 'Close',
          },
        },
      },
    },
  });

  // Reset mocks
  vi.clearAllMocks();

  // Mock GitHub API response
  mockFetch.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve([
        {
          name: 'hello-world',
          path: 'hello-world',
          html_url: 'https://github.com/test',
          type: 'dir',
        },
        {
          name: 'data-dashboard',
          path: 'data-dashboard',
          html_url: 'https://github.com/test2',
          type: 'dir',
        },
      ]),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderQuickstartModal(props: Partial<React.ComponentProps<typeof QuickstartModal>> = {}) {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    quickstartType: 'databricksApps' as const,
    onFillPrompt: vi.fn(),
  };

  return render(
    <I18nextProvider i18n={i18n}>
      <QuickstartModal {...defaultProps} {...props} />
    </I18nextProvider>
  );
}

describe('QuickstartModal - Databricks Apps', () => {
  describe('handleClone', () => {
    it('should call mkdirs before createRepo when cloning', async () => {
      const onFillPrompt = vi.fn();
      const mockRepoResponse: ReposCreateResponse = {
        id: 123,
        path: '/Workspace/Users/test@example.com/databricks_apps/hello-world-1234567890',
        url: 'https://github.com/databricks/app-templates',
        provider: 'gitHub',
        branch: 'main',
        head_commit_id: 'abc123def456',
      };

      vi.mocked(workspaceService.mkdirs).mockResolvedValue({});
      vi.mocked(reposService.createRepo).mockResolvedValue(mockRepoResponse);
      vi.mocked(workspaceService.getStatus).mockResolvedValue({
        path: `${mockRepoResponse.path}/hello-world`,
        object_type: 'DIRECTORY',
        object_id: 456,
      });

      renderQuickstartModal({ onFillPrompt });

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeTruthy();
      });

      // Select template
      const templateCard = screen.getByText('Hello World').closest('button');
      if (templateCard) {
        fireEvent.click(templateCard);
      }

      // Click clone button
      const cloneButton = screen.getByRole('button', { name: /clone/i });
      fireEvent.click(cloneButton);

      // Verify mkdirs is called first with correct path
      await waitFor(() => {
        expect(workspaceService.mkdirs).toHaveBeenCalledTimes(1);
        expect(workspaceService.mkdirs).toHaveBeenCalledWith(
          '/Workspace/Users/test@example.com/databricks_apps'
        );
      });

      // Verify createRepo is called after mkdirs
      await waitFor(() => {
        expect(reposService.createRepo).toHaveBeenCalledTimes(1);
      });

      // Verify the order: mkdirs should be called before createRepo
      const mkdirsCalls = vi.mocked(workspaceService.mkdirs).mock.invocationCallOrder[0];
      const createRepoCalls = vi.mocked(reposService.createRepo).mock.invocationCallOrder[0];
      expect(mkdirsCalls).toBeLessThan(createRepoCalls);
    });

    it('should show error when mkdirs fails', async () => {
      const onFillPrompt = vi.fn();

      vi.mocked(workspaceService.mkdirs).mockRejectedValue(new Error('Permission denied'));

      renderQuickstartModal({ onFillPrompt });

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeTruthy();
      });

      // Select template
      const templateCard = screen.getByText('Hello World').closest('button');
      if (templateCard) {
        fireEvent.click(templateCard);
      }

      // Click clone button
      const cloneButton = screen.getByRole('button', { name: /clone/i });
      fireEvent.click(cloneButton);

      // Verify error message is shown
      await waitFor(() => {
        expect(screen.getByText('Failed to clone template')).toBeTruthy();
      });

      // Verify createRepo was NOT called since mkdirs failed
      expect(reposService.createRepo).not.toHaveBeenCalled();

      // Verify onFillPrompt was NOT called
      expect(onFillPrompt).not.toHaveBeenCalled();
    });

    it('should show error when createRepo fails after successful mkdirs', async () => {
      const onFillPrompt = vi.fn();

      vi.mocked(workspaceService.mkdirs).mockResolvedValue({});
      vi.mocked(reposService.createRepo).mockRejectedValue(new Error('Clone failed'));

      renderQuickstartModal({ onFillPrompt });

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeTruthy();
      });

      // Select template
      const templateCard = screen.getByText('Hello World').closest('button');
      if (templateCard) {
        fireEvent.click(templateCard);
      }

      // Click clone button
      const cloneButton = screen.getByRole('button', { name: /clone/i });
      fireEvent.click(cloneButton);

      // Verify error message is shown
      await waitFor(() => {
        expect(screen.getByText('Failed to clone template')).toBeTruthy();
      });

      // Verify mkdirs was called
      expect(workspaceService.mkdirs).toHaveBeenCalledTimes(1);

      // Verify onFillPrompt was NOT called
      expect(onFillPrompt).not.toHaveBeenCalled();
    });

    it('should call onFillPrompt on successful clone', async () => {
      const onFillPrompt = vi.fn();
      const mockRepoResponse: ReposCreateResponse = {
        id: 123,
        path: '/Workspace/Users/test@example.com/databricks_apps/hello-world-1234567890',
        url: 'https://github.com/databricks/app-templates',
        provider: 'gitHub',
        branch: 'main',
        head_commit_id: 'abc123def456',
      };

      vi.mocked(workspaceService.mkdirs).mockResolvedValue({});
      vi.mocked(reposService.createRepo).mockResolvedValue(mockRepoResponse);
      vi.mocked(workspaceService.getStatus).mockResolvedValue({
        path: `${mockRepoResponse.path}/hello-world`,
        object_type: 'DIRECTORY',
        object_id: 456,
      });

      renderQuickstartModal({ onFillPrompt });

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Hello World')).toBeTruthy();
      });

      // Select template
      const templateCard = screen.getByText('Hello World').closest('button');
      if (templateCard) {
        fireEvent.click(templateCard);
      }

      // Click clone button
      const cloneButton = screen.getByRole('button', { name: /clone/i });
      fireEvent.click(cloneButton);

      // Verify onFillPrompt is called with correct arguments
      await waitFor(() => {
        expect(onFillPrompt).toHaveBeenCalledTimes(1);
        expect(onFillPrompt).toHaveBeenCalledWith(
          expect.stringContaining('hello-world'),
          expect.objectContaining({
            path: expect.stringContaining('hello-world'),
            name: 'hello-world',
            object_type: 'DIRECTORY',
            object_id: 456,
          }),
          true
        );
      });
    });
  });
});
