import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, GitBranch, ChevronDown, Check, Plus, X } from 'lucide-react';
import type { WorkspaceSelection, WorkspaceObjectType } from '@repo/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { extractNameFromPath } from '@/lib/workspace';
import { useRecentWorkspaces } from '@/hooks/useRecentWorkspaces';
import { useUser } from '@/hooks/useUser';
import { WorkspaceBrowserModal } from './WorkspaceBrowserModal';

interface WorkspaceSelectorProps {
  value: WorkspaceSelection | null;
  onChange: (selection: WorkspaceSelection | null) => void;
  disabled?: boolean;
}

/**
 * オブジェクトタイプに応じたアイコンを返す
 */
function getIcon(objectType?: WorkspaceObjectType) {
  if (objectType === 'REPO') {
    return GitBranch;
  }
  return Folder;
}

export function WorkspaceSelector({ value, onChange, disabled = false }: WorkspaceSelectorProps) {
  const { t } = useTranslation();
  const { user } = useUser();
  const { recentWorkspaces, addRecentWorkspace } = useRecentWorkspaces();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ユーザーホームパスを構築
  const userHomePath = user?.name ? `/Workspace/Users/${user.name}` : '/Workspace';

  const handleSelect = useCallback(
    (selection: WorkspaceSelection) => {
      onChange(selection);
      addRecentWorkspace(selection.path, selection.object_id, selection.object_type);
    },
    [onChange, addRecentWorkspace]
  );

  const handleModalSelect = useCallback(
    (selection: WorkspaceSelection) => {
      handleSelect(selection);
    },
    [handleSelect]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  const displayName = value ? extractNameFromPath(value.path) : t('workspace.select');
  const Icon = getIcon(value?.object_type);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-between h-10 px-3 font-normal',
              !value && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{displayName}</span>
            </div>
            <div className="flex items-center gap-1">
              {value && (
                <span
                  role="button"
                  tabIndex={0}
                  className="p-1 hover:bg-accent rounded"
                  onClick={handleClear}
                  onPointerDown={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleClear(e as unknown as React.MouseEvent);
                    }
                  }}
                  aria-label={t('workspace.clear')}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
          {recentWorkspaces.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                {t('workspace.recent')}
              </DropdownMenuLabel>
              {recentWorkspaces.map(workspace => {
                const ItemIcon = getIcon(workspace.object_type);
                const isSelected = value?.path === workspace.path;

                return (
                  <DropdownMenuItem
                    key={workspace.path}
                    onClick={() =>
                      handleSelect({
                        path: workspace.path,
                        name: workspace.name,
                        object_type: workspace.object_type ?? 'DIRECTORY',
                        object_id: workspace.object_id,
                      })
                    }
                    className="flex items-start gap-3 py-2"
                  >
                    <ItemIcon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{workspace.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{workspace.path}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>{t('workspace.selectOther')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <WorkspaceBrowserModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSelect={handleModalSelect}
        initialPath={userHomePath}
        selectableTypes={['DIRECTORY', 'REPO']}
      />
    </>
  );
}
