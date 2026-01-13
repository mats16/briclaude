import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  splitPathToSegments,
  BREADCRUMB_SEGMENT_MAX_WIDTH,
  BREADCRUMB_LAST_SEGMENT_MAX_WIDTH,
} from '@/lib/workspace';

interface WorkspaceBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

export function WorkspaceBreadcrumb({ path, onNavigate }: WorkspaceBreadcrumbProps) {
  const segments = splitPathToSegments(path);

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
              <span
                className="px-2 py-1 font-medium truncate"
                style={{ maxWidth: BREADCRUMB_LAST_SEGMENT_MAX_WIDTH }}
              >
                {segment.name}
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => onNavigate(segment.path)}
              >
                <span className="truncate" style={{ maxWidth: BREADCRUMB_SEGMENT_MAX_WIDTH }}>
                  {segment.name}
                </span>
              </Button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
