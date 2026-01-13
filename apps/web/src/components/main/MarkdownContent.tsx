import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // コードブロック
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match && !className;

          if (isInline) {
            return (
              <code
                className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <div className="relative my-2">
              {match && (
                <div className="absolute top-0 right-0 px-2 py-1 text-xs text-muted-foreground bg-muted rounded-bl">
                  {match[1]}
                </div>
              )}
              <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                <code className="text-sm font-mono" {...props}>
                  {children}
                </code>
              </pre>
            </div>
          );
        },
        // pre タグ
        pre({ children }) {
          return <>{children}</>;
        },
        // 見出し
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-bold mt-2 mb-1">{children}</h3>
        ),
        // リスト
        ul: ({ children }) => (
          <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="ml-2">{children}</li>,
        // 段落
        p: ({ children }) => <p className="my-1">{children}</p>,
        // リンク
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
          >
            {children}
          </a>
        ),
        // 引用
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-muted-foreground/30 pl-4 my-2 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        // テーブル
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full border-collapse border border-border">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-border px-3 py-1 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-3 py-1">{children}</td>
        ),
        // 水平線
        hr: () => <hr className="my-4 border-border" />,
        // 強調
        strong: ({ children }) => (
          <strong className="font-bold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
