import { useState, useEffect } from 'react';
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;
let highlighterInstance: Highlighter | null = null;

// よく使う言語のみをバンドル
const BUNDLED_LANGUAGES: BundledLanguage[] = [
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'json',
  'html',
  'css',
  'python',
  'sql',
  'bash',
  'yaml',
  'markdown',
];

async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light'],
      langs: BUNDLED_LANGUAGES,
    });
  }

  highlighterInstance = await highlighterPromise;
  return highlighterInstance;
}

/**
 * ファイルパスから言語を推測
 */
export function getLanguageFromPath(filePath: string): BundledLanguage {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const langMap: Record<string, BundledLanguage> = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    tsx: 'tsx',
    jsx: 'jsx',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'css',
    py: 'python',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    md: 'markdown',
    mdx: 'markdown',
  };

  return langMap[ext ?? ''] ?? 'typescript';
}

interface UseShikiResult {
  highlighter: Highlighter | null;
  isLoading: boolean;
}

export function useShiki(): UseShikiResult {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(highlighterInstance);
  const [isLoading, setIsLoading] = useState(!highlighterInstance);

  useEffect(() => {
    if (highlighterInstance) {
      setHighlighter(highlighterInstance);
      setIsLoading(false);
      return;
    }

    getHighlighter().then(h => {
      setHighlighter(h);
      setIsLoading(false);
    });
  }, []);

  return { highlighter, isLoading };
}

/**
 * コードをハイライトしてトークン配列を返す
 */
export function highlightCode(
  highlighter: Highlighter,
  code: string,
  lang: BundledLanguage
): Array<Array<{ content: string; color?: string }>> {
  const result = highlighter.codeToTokens(code, {
    lang,
    theme: 'github-light',
  });

  return result.tokens.map(line =>
    line.map(token => ({
      content: token.content,
      color: token.color,
    }))
  );
}
