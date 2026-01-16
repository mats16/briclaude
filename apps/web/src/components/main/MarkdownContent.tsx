import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

import type { Element } from 'hast';

/**
 * hast ノードの子要素が単一の p タグかどうかを判定
 */
function hasOnlyParagraphChild(node: Element | undefined): boolean {
  if (!node?.children) return false;

  // element タイプの子要素のみをフィルタ
  const elementChildren = node.children.filter(
    (child): child is Element => child.type === 'element'
  );

  // 単一の p タグの場合
  return elementChildren.length === 1 && elementChildren[0].tagName === 'p';
}

/**
 * 安全なURLかどうかを検証
 * javascript:, data:, vbscript: などの危険なプロトコルをブロック
 */
function isSafeUrl(url: string | undefined): boolean {
  if (!url) return false;

  // 相対URLは安全
  if (url.startsWith('/') || url.startsWith('#') || url.startsWith('.')) {
    return true;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    // 不正なURLはブロック
    return false;
  }
}

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn('max-w-none whitespace-normal', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // コードブロック
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            // ブロックコード（言語指定あり、または複数行）
            if (match || codeString.includes('\n')) {
              return (
                <SyntaxHighlighter
                  style={oneLight}
                  language={match?.[1] || 'text'}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    background: 'hsl(var(--muted))',
                  }}
                  codeTagProps={{
                    style: {
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    },
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              );
            }

            // インラインコード
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          // pre タグ（SyntaxHighlighter が処理するので素通し）
          pre({ children }) {
            return <div className="my-2">{children}</div>;
          },
          // 見出し
          h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mt-2 mb-1">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-bold mt-2 mb-1">{children}</h4>,
          // リスト
          ul: ({ children }) => <ul className="list-disc pl-6 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-2">{children}</ol>,
          li: ({ children, node }) => {
            // 緩いリストの場合、li 内に p タグが生成される
            // その場合は children をそのまま表示（p のマージンは CSS で調整）
            // node を使って p タグのみの場合を検出し、インラインで表示
            if (hasOnlyParagraphChild(node)) {
              // p タグの children を直接展開してインラインで表示
              const childArray = React.Children.toArray(children);
              if (childArray.length === 1 && React.isValidElement(childArray[0])) {
                const pProps = childArray[0].props as { children?: React.ReactNode };
                return <li>{pProps.children}</li>;
              }
            }
            return <li>{children}</li>;
          },
          // 段落
          p: ({ children }) => <p className="my-1">{children}</p>,
          // リンク（安全なURLのみ許可）
          a: ({ href, children }) => {
            if (!isSafeUrl(href)) {
              // 危険なURLはリンクとして表示しない
              return <span className="text-muted-foreground">{children}</span>;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                {children}
              </a>
            );
          },
          // 引用
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-muted-foreground/30 pl-4 my-2 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          // テーブル
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-border text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-border px-3 py-1 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-border px-3 py-1">{children}</td>,
          // 水平線
          hr: () => <hr className="my-4 border-border" />,
          // 強調
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
