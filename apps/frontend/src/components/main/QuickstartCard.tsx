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
        'w-full p-4 rounded-lg border border-border bg-card',
        'flex items-start gap-4 text-left',
        'transition-colors hover:bg-accent hover:border-accent-foreground/20',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
      )}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
      </div>
    </button>
  );
}
