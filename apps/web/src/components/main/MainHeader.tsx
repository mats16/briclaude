import { useState } from 'react';
import { GitBranch, ChevronDown, Pencil, Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
interface MainHeaderProps {
  title?: string;
  branchName?: string;
  onTitleUpdate?: (newTitle: string) => Promise<void>;
  onArchive?: () => Promise<void>;
}

export function MainHeader({
  title = 'New Session',
  branchName,
  onTitleUpdate,
  onArchive,
}: MainHeaderProps) {
  const { t } = useTranslation();
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenRenameDialog = () => {
    setNewTitle(title);
    setIsRenameDialogOpen(true);
  };

  const handleRename = async () => {
    if (!onTitleUpdate || newTitle.trim() === '') return;

    setIsSubmitting(true);
    try {
      await onTitleUpdate(newTitle.trim());
      setIsRenameDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchive) return;
    await onArchive();
  };

  return (
    <>
      <div className="flex items-center justify-between h-[50px] px-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-1 font-medium text-foreground">
                <span className="truncate max-w-[300px]">{title}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-0">
              <DropdownMenuItem onClick={handleOpenRenameDialog}>
                <Pencil className="h-4 w-4" />
                {t('main.renameSession')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4" />
                {t('main.archiveSession')}
              </DropdownMenuItem>
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
        </div>
      </div>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('main.renameSession')}</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder={t('main.sessionTitlePlaceholder')}
            onKeyDown={e => {
              if (e.key === 'Enter' && !isSubmitting) {
                handleRename();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRename} disabled={isSubmitting || newTitle.trim() === ''}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
