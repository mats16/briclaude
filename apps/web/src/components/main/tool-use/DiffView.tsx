import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Diff from 'diff';
import { cn } from '@/lib/utils';
import { useShiki, getLanguageFromPath, highlightCode } from '@/hooks/useShiki';
import type { DiffLine } from './types';

const MAX_VISIBLE_LINES = 20;

/**
 * CSS color 値をサニタイズする
 * Shiki は信頼できるライブラリだが、念のため不正な値を除外
 */
function sanitizeColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  // 有効な CSS color 形式のみ許可: #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba(), hsl(), hsla(), 色名
  const validColorPattern =
    /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|[a-zA-Z]+)$/;
  return validColorPattern.test(color) ? color : undefined;
}

interface DiffViewProps {
  oldText: string;
  newText: string;
  filePath?: string;
  className?: string;
}

/**
 * 2つのテキストの差分を計算して DiffLine 配列を返す
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const changes = Diff.diffLines(oldText, newText);
  const lines: DiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const change of changes) {
    const changeLines = change.value.replace(/\n$/, '').split('\n');

    for (const line of changeLines) {
      if (change.added) {
        lines.push({
          type: 'added',
          content: line,
          newLineNumber: newLineNum++,
        });
      } else if (change.removed) {
        lines.push({
          type: 'removed',
          content: line,
          oldLineNumber: oldLineNum++,
        });
      } else {
        lines.push({
          type: 'unchanged',
          content: line,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      }
    }
  }

  return lines;
}

/**
 * 新規ファイル用の DiffLine 配列を返す（全行が追加）
 */
export function computeNewFileDiff(content: string): DiffLine[] {
  if (!content) return [];

  const lines = content.split('\n');
  return lines.map((line, index) => ({
    type: 'added' as const,
    content: line,
    newLineNumber: index + 1,
  }));
}

export function DiffView({ oldText, newText, filePath, className }: DiffViewProps) {
  const diffLines = useMemo(() => computeDiff(oldText, newText), [oldText, newText]);

  return <DiffDisplay lines={diffLines} filePath={filePath} className={className} />;
}

interface DiffDisplayProps {
  lines: DiffLine[];
  filePath?: string;
  className?: string;
}

export function DiffDisplay({ lines, filePath, className }: DiffDisplayProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const { highlighter } = useShiki();

  const lang = filePath ? getLanguageFromPath(filePath) : 'typescript';

  const shouldCollapse = lines.length > MAX_VISIBLE_LINES;
  const visibleLines = isExpanded ? lines : lines.slice(0, MAX_VISIBLE_LINES);

  // パフォーマンス最適化: 全行を事前にハイライトし、表示時にスライス
  // isExpanded に依存しないことで、展開/折りたたみ時の再計算を防ぐ
  const allHighlightedLines = useMemo(() => {
    if (!highlighter) return null;

    const code = lines.map(l => l.content).join('\n');
    return highlightCode(highlighter, code, lang);
  }, [highlighter, lines, lang]);

  const highlightedLines = allHighlightedLines?.slice(
    0,
    isExpanded ? undefined : MAX_VISIBLE_LINES
  );

  if (lines.length === 0) return null;
  const hiddenLinesCount = lines.length - MAX_VISIBLE_LINES;

  // 行番号の最大桁数を計算（0 をフォールバックに含めることで -Infinity を防ぐ）
  const maxOldLineNum = Math.max(...lines.map(l => l.oldLineNumber ?? 0), 0);
  const maxNewLineNum = Math.max(...lines.map(l => l.newLineNumber ?? 0), 0);
  const oldLineWidth = Math.max(String(maxOldLineNum).length, 1);
  const newLineWidth = Math.max(String(maxNewLineNum).length, 1);

  return (
    <div className={cn('mt-1 ml-4 overflow-hidden', className)}>
      <div className="flex items-start gap-1 text-muted-foreground">
        <span className="select-none" aria-hidden="true">
          └
        </span>
        <div className="flex-1 overflow-hidden">
          <div className="overflow-x-auto rounded border border-border text-xs font-mono">
            {visibleLines.map((line, index) => (
              <DiffLineRow
                key={index}
                line={line}
                tokens={highlightedLines?.[index]}
                oldLineWidth={oldLineWidth}
                newLineWidth={newLineWidth}
              />
            ))}
          </div>
          {shouldCollapse && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              {isExpanded
                ? t('tools.collapse')
                : t('tools.showFullDiff', { count: hiddenLinesCount })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface DiffLineRowProps {
  line: DiffLine;
  tokens?: Array<{ content: string; color?: string }>;
  oldLineWidth: number;
  newLineWidth: number;
}

function DiffLineRow({ line, tokens, oldLineWidth, newLineWidth }: DiffLineRowProps) {
  return (
    <div
      className={cn(
        'flex',
        line.type === 'added' && 'bg-green-100 dark:bg-green-950/50',
        line.type === 'removed' && 'bg-red-100 dark:bg-red-950/50'
      )}
    >
      {/* 旧行番号 */}
      <span
        className="select-none text-muted-foreground/60 text-right px-1 border-r border-border shrink-0"
        style={{ minWidth: `${oldLineWidth + 1}ch` }}
      >
        {line.oldLineNumber ?? ''}
      </span>
      {/* 新行番号 */}
      <span
        className="select-none text-muted-foreground/60 text-right px-1 border-r border-border shrink-0"
        style={{ minWidth: `${newLineWidth + 1}ch` }}
      >
        {line.newLineNumber ?? ''}
      </span>
      {/* +/- 記号 */}
      <span
        className={cn(
          'select-none px-1 shrink-0',
          line.type === 'added' && 'text-green-600 dark:text-green-400',
          line.type === 'removed' && 'text-red-600 dark:text-red-400'
        )}
      >
        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
      </span>
      {/* コンテンツ（シンタックスハイライト） */}
      <span className="whitespace-pre px-1">
        {tokens
          ? tokens.map((token, i) => (
              <span key={i} style={{ color: sanitizeColor(token.color) }}>
                {token.content}
              </span>
            ))
          : line.content || ' '}
      </span>
    </div>
  );
}
