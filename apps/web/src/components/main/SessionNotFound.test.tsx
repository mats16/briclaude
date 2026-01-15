import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { SessionNotFound } from './SessionNotFound';
import { SidebarProvider } from '@/components/ui/sidebar';

// Mock window.matchMedia for SidebarProvider's useIsMobile hook
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
          main: {
            sessionNotFound: 'Session not found',
            sessionNotFoundDescription: 'This session may have been deleted or does not exist.',
            goHome: 'Go to Home',
          },
        },
      },
      ja: {
        translation: {
          main: {
            sessionNotFound: 'セッションが見つかりませんでした',
            sessionNotFoundDescription:
              'このセッションは削除されたか、存在しない可能性があります。',
            goHome: 'ホームに戻る',
          },
        },
      },
    },
  });
});

function renderWithProviders(component: React.ReactNode) {
  return render(
    <SidebarProvider defaultOpen={true}>
      <I18nextProvider i18n={i18n}>{component}</I18nextProvider>
    </SidebarProvider>
  );
}

describe('SessionNotFound', () => {
  it('should render session not found message', () => {
    renderWithProviders(<SessionNotFound />);

    expect(screen.getByText('Session not found')).toBeTruthy();
    expect(screen.getByText('This session may have been deleted or does not exist.')).toBeTruthy();
  });

  it('should render go home button', () => {
    renderWithProviders(<SessionNotFound />);

    const button = screen.getByRole('button', { name: /go to home/i });
    expect(button).toBeTruthy();
  });

  it('should call onGoHome when button is clicked', () => {
    const onGoHome = vi.fn();
    renderWithProviders(<SessionNotFound onGoHome={onGoHome} />);

    const button = screen.getByRole('button', { name: /go to home/i });
    fireEvent.click(button);

    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it('should render with Japanese translations', async () => {
    await i18n.changeLanguage('ja');

    renderWithProviders(<SessionNotFound />);

    expect(screen.getByText('セッションが見つかりませんでした')).toBeTruthy();
    expect(
      screen.getByText('このセッションは削除されたか、存在しない可能性があります。')
    ).toBeTruthy();

    // Reset to English
    await i18n.changeLanguage('en');
  });

  it('should render FileQuestion icon container', () => {
    const { container } = renderWithProviders(<SessionNotFound />);

    // Check for the icon container with bg-muted class
    const iconContainer = container.querySelector('.bg-muted');
    expect(iconContainer).toBeTruthy();
  });
});
