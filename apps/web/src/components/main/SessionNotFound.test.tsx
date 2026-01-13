import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { SessionNotFound } from './SessionNotFound';

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
            sessionNotFoundDescription: 'このセッションは削除されたか、存在しない可能性があります。',
            goHome: 'ホームに戻る',
          },
        },
      },
    },
  });
});

function renderWithI18n(component: React.ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
}

describe('SessionNotFound', () => {
  it('should render session not found message', () => {
    renderWithI18n(<SessionNotFound />);

    expect(screen.getByText('Session not found')).toBeTruthy();
    expect(screen.getByText('This session may have been deleted or does not exist.')).toBeTruthy();
  });

  it('should render go home button', () => {
    renderWithI18n(<SessionNotFound />);

    const button = screen.getByRole('button', { name: /go to home/i });
    expect(button).toBeTruthy();
  });

  it('should call onGoHome when button is clicked', () => {
    const onGoHome = vi.fn();
    renderWithI18n(<SessionNotFound onGoHome={onGoHome} />);

    const button = screen.getByRole('button', { name: /go to home/i });
    fireEvent.click(button);

    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it('should render sidebar toggle button when onToggleSidebar is provided', () => {
    const onToggleSidebar = vi.fn();
    renderWithI18n(<SessionNotFound onToggleSidebar={onToggleSidebar} isSidebarOpen={true} />);

    // The toggle button should be rendered (it's a button with an SVG icon)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(1); // Go Home button + toggle button
  });

  it('should call onToggleSidebar when toggle button is clicked', () => {
    const onToggleSidebar = vi.fn();
    renderWithI18n(<SessionNotFound onToggleSidebar={onToggleSidebar} isSidebarOpen={true} />);

    // First button is the toggle button (in header)
    const buttons = screen.getAllByRole('button');
    const toggleButton = buttons[0]; // Toggle button is first in DOM order
    fireEvent.click(toggleButton);

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('should not render sidebar toggle when onToggleSidebar is not provided', () => {
    renderWithI18n(<SessionNotFound />);

    // Only the Go Home button should be rendered
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(1);
  });

  it('should render with Japanese translations', async () => {
    await i18n.changeLanguage('ja');

    renderWithI18n(<SessionNotFound />);

    expect(screen.getByText('セッションが見つかりませんでした')).toBeTruthy();
    expect(
      screen.getByText('このセッションは削除されたか、存在しない可能性があります。')
    ).toBeTruthy();

    // Reset to English
    await i18n.changeLanguage('en');
  });

  it('should render FileQuestion icon container', () => {
    const { container } = renderWithI18n(<SessionNotFound />);

    // Check for the icon container with bg-muted class
    const iconContainer = container.querySelector('.bg-muted');
    expect(iconContainer).toBeTruthy();
  });
});
