import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { ThinkingIndicator } from './ThinkingIndicator';

beforeEach(async () => {
  vi.useFakeTimers();
  await i18n.init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          main: {
            thinking: 'Thinking…',
          },
        },
      },
      ja: {
        translation: {
          main: {
            thinking: 'Thinking…',
          },
        },
      },
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderWithI18n(component: React.ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
}

describe('ThinkingIndicator', () => {
  it('role="status"属性を持つ', () => {
    renderWithI18n(<ThinkingIndicator />);

    const statusElement = screen.getByRole('status');
    expect(statusElement).toBeTruthy();
  });

  it('aria-live="polite"属性を持つ', () => {
    renderWithI18n(<ThinkingIndicator />);

    const statusElement = screen.getByRole('status');
    expect(statusElement.getAttribute('aria-live')).toBe('polite');
  });

  it('3つのToyBrickアイコンが表示される', () => {
    const { container } = renderWithI18n(<ThinkingIndicator />);

    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBe(3);
  });

  it('アイコンにaria-hidden="true"が設定されたコンテナがある', () => {
    const { container } = renderWithI18n(<ThinkingIndicator />);

    const hiddenContainer = container.querySelector('[aria-hidden="true"]');
    expect(hiddenContainer).toBeTruthy();
  });

  it('各アイコンにanimate-waveクラスがある', () => {
    const { container } = renderWithI18n(<ThinkingIndicator />);

    const icons = container.querySelectorAll('svg.animate-wave');
    expect(icons.length).toBe(3);
  });

  it('各アイコンに異なる色クラスがある', () => {
    const { container } = renderWithI18n(<ThinkingIndicator />);

    expect(container.querySelector('.text-purple-500')).toBeTruthy();
    expect(container.querySelector('.text-pink-500')).toBeTruthy();
    expect(container.querySelector('.text-blue-500')).toBeTruthy();
  });

  it('各アイコンに異なるanimationDelayが設定される', () => {
    const { container } = renderWithI18n(<ThinkingIndicator />);

    const icons = container.querySelectorAll('svg');
    expect((icons[0] as SVGSVGElement).style.animationDelay).toBe('0ms');
    expect((icons[1] as SVGSVGElement).style.animationDelay).toBe('120ms');
    expect((icons[2] as SVGSVGElement).style.animationDelay).toBe('240ms');
  });

  it('タイプライターエフェクトで文字が表示される', () => {
    const { container } = renderWithI18n(<ThinkingIndicator />);

    // 初期状態
    const textSpan = container.querySelector('.text-muted-foreground');
    expect(textSpan?.textContent).toBe('|'); // カーソルのみ

    // 1文字表示
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(textSpan?.textContent).toBe('T|');
  });
});
