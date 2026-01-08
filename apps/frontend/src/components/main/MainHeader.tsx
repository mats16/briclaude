import { GitBranch, ExternalLink, Copy, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface MainHeaderProps {
  title?: string;
  branchName?: string;
}

export function MainHeader({
  title = 'Summarize context content clearly',
  branchName = 'claude/summarize-context-f7NYV',
}: MainHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between h-[50px] px-4 border-b border-border">
      <div className="flex items-center gap-2 min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-1 font-medium text-foreground">
              <span className="truncate max-w-[300px]">{title}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>Rename session</DropdownMenuItem>
            <DropdownMenuItem>Archive session</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete session</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        {branchName && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span className="text-xs truncate max-w-[150px]">{branchName}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{branchName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy session ID</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button variant="outline" size="sm" className="gap-1.5">
          {t('main.openInCli')}
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
