import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkspaceBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

interface BreadcrumbSegment {
  name: string;
  path: string;
}

/**
 * パスをパンくずセグメントに分割する
 * 例: /Workspace/Users/john -> [{name: 'Workspace', path: '/Workspace'}, ...]
 */
function parsePath(path: string): BreadcrumbSegment[] {
  const segments = path.split('/').filter(Boolean);
  const result: BreadcrumbSegment[] = [];
  let currentPath = '';

  for (const segment of segments) {
    currentPath += '/' + segment;
    result.push({
      name: segment,
      path: currentPath,
    });
  }

  return result;
}

export function WorkspaceBreadcrumb({ path, onNavigate }: WorkspaceBreadcrumbProps) {
  const segments = parsePath(path);

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto" aria-label="Breadcrumb">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 shrink-0"
        onClick={() => onNavigate('/Workspace')}
      >
        <Home className="h-4 w-4" />
      </Button>

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;

        return (
          <div key={segment.path} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {isLast ? (
              <span className="px-2 py-1 font-medium truncate max-w-[200px]">{segment.name}</span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => onNavigate(segment.path)}
              >
                <span className="truncate max-w-[150px]">{segment.name}</span>
              </Button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
