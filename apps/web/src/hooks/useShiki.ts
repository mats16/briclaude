import { useState, useEffect } from 'react';
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';

/**
 * @fileoverview Shiki シンタックスハイライターのためのReactフック
 *
 * このモジュールは Shiki ライブラリを使用したコードハイライト機能を提供します。
 * シングルトンパターンでハイライターインスタンスを管理し、複数コンポーネント間で共有します。
 *
 * ## 対応言語
 * - JavaScript/TypeScript (js, mjs, cjs, ts, mts, cts, tsx, jsx)
 * - Web (html, htm, css, scss)
 * - Data (json, yaml, yml)
 * - Backend (python, sql)
 * - Shell (bash, sh, zsh)
 * - Documentation (markdown, md, mdx)
 *
 * ## テーマ
 * - github-light (固定)
 *
 * ## 使用例
 * ```tsx
 * import { useShiki, highlightCode, getLanguageFromPath } from '@/hooks/useShiki';
 *
 * function CodeBlock({ code, filePath }: { code: string; filePath: string }) {
 *   const { highlighter, isLoading } = useShiki();
 *   const lang = getLanguageFromPath(filePath);
 *
 *   if (isLoading || !highlighter) return <pre>{code}</pre>;
 *
 *   const tokens = highlightCode(highlighter, code, lang);
 *   return (
 *     <pre>
 *       {tokens.map((line, i) => (
 *         <div key={i}>
 *           {line.map((token, j) => (
 *             <span key={j} style={{ color: token.color }}>{token.content}</span>
 *           ))}
 *         </div>
 *       ))}
 *     </pre>
 *   );
 * }
 * ```
 *
 * ## 制限事項
 * - 対応していない言語は typescript として扱われます
 * - ダークテーマは未サポート
 * - 大量のコード（数千行）では遅延読み込みを検討してください
 */

let highlighterPromise: Promise<Highlighter> | null = null;
let highlighterInstance: Highlighter | null = null;

/**
 * バンドルされている対応言語のリスト
 * パフォーマンスのため、よく使う言語のみを含めています
 */
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
 * ファイルパスの拡張子から対応する言語を推測する
 *
 * @param filePath - ファイルパス（例: 'src/index.ts', 'styles.css'）
 * @returns 推測された言語。対応する言語がない場合は 'typescript' を返す
 *
 * @example
 * ```typescript
 * getLanguageFromPath('src/App.tsx')       // 'tsx'
 * getLanguageFromPath('package.json')      // 'json'
 * getLanguageFromPath('unknown.xyz')       // 'typescript'（フォールバック）
 * ```
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

/**
 * useShiki フックの戻り値の型
 */
interface UseShikiResult {
  /** Shiki ハイライターインスタンス（読み込み前は null） */
  highlighter: Highlighter | null;
  /** ハイライターの読み込み中かどうか */
  isLoading: boolean;
}

/**
 * Shiki シンタックスハイライターを取得するReactフック
 *
 * ハイライターインスタンスはシングルトンとして管理され、
 * 複数のコンポーネント間で共有されます。
 *
 * @returns {UseShikiResult} highlighter と isLoading を含むオブジェクト
 *
 * @example
 * ```tsx
 * const { highlighter, isLoading } = useShiki();
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (!highlighter) return <pre>{code}</pre>;
 *
 * const tokens = highlightCode(highlighter, code, 'typescript');
 * ```
 */
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
 *
 * @param highlighter - Shiki ハイライターインスタンス
 * @param code - ハイライトするコード文字列
 * @param lang - ハイライトに使用する言語（BUNDLED_LANGUAGES のいずれか）
 * @returns 行ごとのトークン配列。各トークンは content と color を持つ
 *
 * @example
 * ```typescript
 * const tokens = highlightCode(highlighter, 'const x = 1;', 'typescript');
 * // tokens[0] = [{ content: 'const', color: '#0000ff' }, { content: ' x', color: '#000000' }, ...]
 * ```
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
