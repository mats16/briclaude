import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Folder,
  GitBranch,
  FileText,
  FileCode,
  Database,
  BarChart3,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import type { WorkspaceObjectType, WorkspaceObjectInfo, WorkspaceSelection } from '@repo/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { extractNameFromPath, safeSanitizePath } from '@/lib/workspace';
import { workspaceService, ApiClientError } from '@/services';
import { WorkspaceBreadcrumb } from './WorkspaceBreadcrumb';

interface WorkspaceBrowserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selection: WorkspaceSelection) => void;
  /** 初期表示パス */
  initialPath?: string;
  /** 選択可能なオブジェクトタイプ（デフォルト: DIRECTORY, REPO） */
  selectableTypes?: WorkspaceObjectType[];
  /** モーダルタイトル（デフォルト: 翻訳キーから取得） */
  title?: string;
  /** モーダル説明（デフォルト: 翻訳キーから取得） */
  description?: string;
}

const DEFAULT_SELECTABLE_TYPES: WorkspaceObjectType[] = ['DIRECTORY', 'REPO'];

/**
 * オブジェクトタイプに応じたアイコンを返す
 */
function getObjectIcon(objectType: WorkspaceObjectType) {
  switch (objectType) {
    case 'DIRECTORY':
      return Folder;
    case 'REPO':
      return GitBranch;
    case 'NOTEBOOK':
      return FileCode;
    case 'FILE':
      return FileText;
    case 'MLFLOW_EXPERIMENT':
      return BarChart3;
    case 'LIBRARY':
    case 'DASHBOARD':
    default:
      return Database;
  }
}

export function WorkspaceBrowserModal({
  open,
  onOpenChange,
  onSelect,
  initialPath = '/Workspace',
  selectableTypes = DEFAULT_SELECTABLE_TYPES,
  title,
  description,
}: WorkspaceBrowserModalProps) {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState(initialPath);
  // currentPath の object_type と object_id を追跡（ナビゲーション時に更新）
  const [currentObjectType, setCurrentObjectType] = useState<WorkspaceObjectType>('DIRECTORY');
  const [currentObjectId, setCurrentObjectId] = useState<number | undefined>(undefined);
  const [objects, setObjects] = useState<WorkspaceObjectInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<WorkspaceObjectInfo | null>(null);

  // モーダルが開いた時にパスをリセット
  useEffect(() => {
    if (open) {
      setCurrentPath(initialPath);
      setCurrentObjectType('DIRECTORY'); // 初期パスは通常 DIRECTORY
      setCurrentObjectId(undefined);
      setSelectedItem(null);
      setError(null);
      setSelectError(null);
    }
  }, [open, initialPath]);

  // パスが変わったらオブジェクト一覧を取得
  useEffect(() => {
    if (!open) return;

    const fetchObjects = async () => {
      setIsLoading(true);
      setError(null);
      setSelectedItem(null);

      try {
        const listResponse = await workspaceService.listWorkspace(currentPath);

        // パスでソート（ディレクトリを先に、その後名前順）
        const sorted = (listResponse.objects ?? []).sort((a, b) => {
          // ディレクトリを先に
          if (a.object_type === 'DIRECTORY' && b.object_type !== 'DIRECTORY') return -1;
          if (a.object_type !== 'DIRECTORY' && b.object_type === 'DIRECTORY') return 1;
          // リポジトリを次に
          if (a.object_type === 'REPO' && b.object_type !== 'REPO') return -1;
          if (a.object_type !== 'REPO' && b.object_type === 'REPO') return 1;
          // 名前順
          return extractNameFromPath(a.path).localeCompare(extractNameFromPath(b.path));
        });
        setObjects(sorted);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError(t('workspace.error'));
        }
        setObjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchObjects();
  }, [open, currentPath, t]);

  const handleNavigate = useCallback(
    (path: string, objectType: WorkspaceObjectType = 'DIRECTORY', objectId?: number) => {
      setCurrentPath(safeSanitizePath(path));
      setCurrentObjectType(objectType);
      setCurrentObjectId(objectId);
    },
    []
  );

  const handleItemDoubleClick = useCallback(
    (item: WorkspaceObjectInfo) => {
      // ディレクトリまたはリポジトリの場合はナビゲート
      if (item.object_type === 'DIRECTORY' || item.object_type === 'REPO') {
        handleNavigate(item.path, item.object_type, item.object_id);
        return;
      }

      // 選択可能なタイプの場合は即座に選択して閉じる
      if (selectableTypes.includes(item.object_type)) {
        onSelect({
          path: item.path,
          name: extractNameFromPath(item.path),
          object_type: item.object_type,
          object_id: item.object_id,
        });
        onOpenChange(false);
      }
    },
    [selectableTypes, onSelect, onOpenChange, handleNavigate]
  );

  const isSelectable = (item: WorkspaceObjectInfo) => selectableTypes.includes(item.object_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title ?? t('workspace.browserTitle')}</DialogTitle>
          <DialogDescription>{description ?? t('workspace.browserDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* パンくずナビゲーション */}
          <div className="border-b pb-2">
            <WorkspaceBreadcrumb path={currentPath} onNavigate={handleNavigate} />
          </div>

          {/* オブジェクト一覧 */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t('workspace.loading')}</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : objects.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">{t('workspace.empty')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {objects.map(item => {
                  const Icon = getObjectIcon(item.object_type);
                  const name = extractNameFromPath(item.path);
                  const selectable = isSelectable(item);
                  const isSelected = selectedItem?.path === item.path;
                  const isDirectory = item.object_type === 'DIRECTORY';
                  const canOpen = isDirectory || item.object_type === 'REPO';

                  return (
                    <div
                      key={item.path}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-md transition-colors',
                        'hover:bg-accent',
                        isSelected && 'bg-accent',
                        !selectable && !isDirectory && 'opacity-50'
                      )}
                    >
                      <button
                        type="button"
                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                        onClick={() => {
                          if (selectable) {
                            setSelectedItem(prev => (prev?.path === item.path ? null : item));
                          }
                        }}
                        onDoubleClick={() => handleItemDoubleClick(item)}
                        disabled={!selectable && !isDirectory}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5 shrink-0',
                            isDirectory && 'text-amber-500',
                            item.object_type === 'REPO' && 'text-green-500',
                            item.object_type === 'NOTEBOOK' && 'text-blue-500'
                          )}
                        />
                        <span className="font-medium truncate">{name}</span>
                      </button>
                      {canOpen && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() =>
                            handleNavigate(item.path, item.object_type, item.object_id)
                          }
                          aria-label={t('workspace.open')}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* 現在のフルパス表示 */}
          <div className="px-1 pt-2 border-t flex items-center gap-2">
            <span className="text-sm text-foreground shrink-0">Path:</span>
            <p
              className={cn(
                'text-sm font-mono truncate',
                selectedItem ? 'text-foreground' : 'text-muted-foreground'
              )}
              style={{ direction: 'rtl', textAlign: 'left' }}
            >
              {selectedItem?.path ?? currentPath}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
          {selectError && (
            <p className="text-sm text-destructive w-full sm:w-auto sm:flex-1 sm:mr-2">
              {selectError}
            </p>
          )}
          <div className="flex gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('workspace.cancel')}
            </Button>
            <Button
              onClick={async () => {
                // リストから選択されたアイテムがある場合はそのまま使用
                if (selectedItem) {
                  onSelect({
                    path: selectedItem.path,
                    name: extractNameFromPath(selectedItem.path),
                    object_type: selectedItem.object_type,
                    object_id: selectedItem.object_id,
                  });
                  onOpenChange(false);
                  return;
                }

                // 現在のフォルダを選択する場合
                // object_id が既にある場合（ナビゲーション経由）はそのまま使用
                if (currentObjectId !== undefined) {
                  onSelect({
                    path: currentPath,
                    name: extractNameFromPath(currentPath),
                    object_type: currentObjectType,
                    object_id: currentObjectId,
                  });
                  onOpenChange(false);
                  return;
                }

                // 初期パスで object_id がない場合は getStatus で取得
                setIsSelecting(true);
                setSelectError(null); // エラーをクリアして再試行可能に
                try {
                  const statusResponse = await workspaceService.getStatus(currentPath);
                  setCurrentObjectId(statusResponse.object_id);
                  setCurrentObjectType(statusResponse.object_type);
                  onSelect({
                    path: currentPath,
                    name: extractNameFromPath(currentPath),
                    object_type: statusResponse.object_type,
                    object_id: statusResponse.object_id,
                  });
                  onOpenChange(false);
                } catch (err) {
                  if (err instanceof ApiClientError) {
                    setSelectError(err.message);
                  } else {
                    setSelectError(t('workspace.error'));
                  }
                } finally {
                  setIsSelecting(false);
                }
              }}
              disabled={isSelecting}
            >
              {isSelecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('workspace.loading')}
                </>
              ) : (
                t('workspace.selectCurrentFolder')
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
