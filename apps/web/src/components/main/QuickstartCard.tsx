import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickstartCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}

export function QuickstartCard({ icon: Icon, title, description, onClick }: QuickstartCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border border-border bg-card',
        'flex flex-col gap-2 text-left h-full',
        'transition-colors hover:bg-accent hover:border-accent-foreground/20',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-sm text-foreground leading-tight">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
    </button>
  );
}
