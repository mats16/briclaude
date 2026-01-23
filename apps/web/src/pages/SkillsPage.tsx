import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Plus,
  GitBranch,
  Trash2,
  Loader2,
  AlertCircle,
  FileText,
  Eye,
  Pencil,
  Check,
  ChevronsUpDown,
  Upload,
  Download,
  TriangleAlert,
  ChevronDown,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { skillService } from '@/services';
import { useUser } from '@/hooks/useUser';
import type { SkillInfo, SkillDetail } from '@repo/types';

/** プリセットリポジトリ */
const PRESET_REPOS = [
  {
    label: 'Anthropic',
    url: 'https://github.com/anthropics/skills',
  },
  {
    label: 'Databricks',
    url: 'https://github.com/mats16/briclaude',
  },
];

/** GitHub APIのディレクトリエントリ型 */
interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

/** metadata.sourceからGitHub repository情報を抽出 */
const parseGitHubSource = (source: string): { owner: string; repo: string } | null => {
  const match = source.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
};

export function SkillsContent() {
  const { t } = useTranslation();
  const { user } = useUser();
  const workspacePath = user?.name
    ? `/Workspace/Users/${user.name}/.claude/skills`
    : '/Workspace/Users/{username}/.claude/skills';
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ダイアログ状態
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // フォーム状態（作成）
  const [createForm, setCreateForm] = useState({
    name: '',
    version: '1.0.0',
    description: '',
    content: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // フォーム状態（インポート）
  const [importForm, setImportForm] = useState({
    repository_url: '',
    path: 'skills',
    branch: 'main',
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // リポジトリ選択コンボボックス
  const [repoComboOpen, setRepoComboOpen] = useState(false);

  // スキル一覧
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [selectedSkillNames, setSelectedSkillNames] = useState<Set<string>>(new Set());

  // 削除中のスキル名
  const [deletingSkill, setDeletingSkill] = useState<string | null>(null);

  // プレビュー状態
  const [previewSkill, setPreviewSkill] = useState<SkillDetail | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // 編集モード状態
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedRawContent, setEditedRawContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // バックアップ/リストア状態
  const [syncAction, setSyncAction] = useState<'backup' | 'restore'>('backup');
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // スキル一覧取得
  const fetchSkills = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await skillService.getSkills();
      setSkills(response.skills);
    } catch {
      setError(t('skills.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // スキル作成
  const handleCreate = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      await skillService.createSkill(createForm);
      setShowCreateDialog(false);
      setCreateForm({ name: '', version: '1.0.0', description: '', content: '' });
      await fetchSkills();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('skills.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  // GitHub URLからAPIのURLを生成
  const buildGitHubApiUrl = (repoUrl: string, path: string): string | null => {
    // https://github.com/owner/repo または https://github.com/owner/repo.git
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!match) return null;
    const [, owner, repo] = match;
    return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  };

  // リポジトリURLを選択/入力
  const handleSelectRepo = (url: string) => {
    setImportForm(f => ({ ...f, repository_url: url }));
    setAvailableSkills([]);
    setSelectedSkillNames(new Set());
    setImportError(null);
    setRepoComboOpen(false);
  };

  // スキル一覧を取得
  const fetchAvailableSkills = async () => {
    const apiUrl = buildGitHubApiUrl(importForm.repository_url, importForm.path);
    if (!apiUrl) {
      setImportError(t('skills.importDialog.invalidUrl'));
      return;
    }
    setIsLoadingSkills(true);
    setImportError(null);
    setAvailableSkills([]);
    setSelectedSkillNames(new Set());
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Failed to fetch');
      const data: GitHubContent[] = await response.json();
      const skillNames = data
        .filter(item => item.type === 'dir')
        .map(item => item.name)
        .sort();
      setAvailableSkills(skillNames);
    } catch {
      setImportError(t('skills.importDialog.fetchError'));
    } finally {
      setIsLoadingSkills(false);
    }
  };

  // スキルを選択（複数選択対応）
  const handleSelectSkillName = (skillName: string) => {
    setSelectedSkillNames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(skillName)) {
        newSet.delete(skillName);
      } else {
        newSet.add(skillName);
      }
      return newSet;
    });
  };

  // 全選択/全解除
  const handleSelectAll = () => {
    if (selectedSkillNames.size === availableSkills.length) {
      setSelectedSkillNames(new Set());
    } else {
      setSelectedSkillNames(new Set(availableSkills));
    }
  };

  // Gitインポート（複数パス対応）
  const handleImport = async () => {
    setIsImporting(true);
    setImportError(null);
    // 選択されたスキルのパス配列を構築
    const paths =
      selectedSkillNames.size > 0
        ? Array.from(selectedSkillNames).map(name => `${importForm.path}/${name}`)
        : [importForm.path];
    try {
      await skillService.importFromGit({
        repository_url: importForm.repository_url,
        paths,
        branch: importForm.branch,
      });
      setShowImportDialog(false);
      setImportForm({ repository_url: '', path: 'skills', branch: 'main' });
      setAvailableSkills([]);
      setSelectedSkillNames(new Set());
      await fetchSkills();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('skills.importError'));
    } finally {
      setIsImporting(false);
    }
  };

  // スキル削除
  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('skills.deleteConfirm', { name }))) return;

    setDeletingSkill(name);
    try {
      await skillService.deleteSkill(name);
      await fetchSkills();
    } catch {
      setError(t('skills.deleteError'));
    } finally {
      setDeletingSkill(null);
    }
  };

  // スキルプレビュー
  const handlePreview = async (name: string) => {
    setIsLoadingPreview(true);
    setShowPreviewDialog(true);
    try {
      const response = await skillService.getSkill(name);
      setPreviewSkill(response.skill);
    } catch {
      setError(t('skills.fetchError'));
      setShowPreviewDialog(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // プレビューダイアログを閉じる
  const handleClosePreview = () => {
    setShowPreviewDialog(false);
    setPreviewSkill(null);
    setIsEditMode(false);
    setEditedRawContent('');
    setSaveError(null);
  };

  // 編集モードに入る
  const handleEnterEditMode = () => {
    if (previewSkill) {
      setEditedRawContent(previewSkill.raw_content);
      setIsEditMode(true);
      setSaveError(null);
    }
  };

  // 編集モードをキャンセル
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedRawContent('');
    setSaveError(null);
  };

  // スキルを保存
  const handleSaveSkill = async () => {
    if (!previewSkill) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await skillService.updateSkill(previewSkill.name, {
        raw_content: editedRawContent,
      });
      // 更新後にプレビューを再取得
      const response = await skillService.getSkill(previewSkill.name);
      setPreviewSkill(response.skill);
      setIsEditMode(false);
      setEditedRawContent('');
      await fetchSkills();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('skills.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  // バックアップ
  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupError(null);
    try {
      await skillService.backup();
      setShowBackupDialog(false);
      toast.success(t('skills.backupDialog.success'));
      await fetchSkills();
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : t('skills.backupDialog.error'));
    } finally {
      setIsBackingUp(false);
    }
  };

  // リストア
  const handleRestore = async () => {
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await skillService.restore();
      setShowRestoreDialog(false);
      toast.success(t('skills.restoreDialog.success'));
      await fetchSkills();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : t('skills.restoreDialog.error'));
    } finally {
      setIsRestoring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold">{t('skills.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('skills.description')}</p>
        </div>
        <div className="flex gap-2">
          {/* バックアップ/リストア スプリットボタン */}
          <div className="flex">
            <Button
              variant="outline"
              size="sm"
              className="rounded-r-none border-r-0 min-w-[140px] justify-start"
              onClick={() =>
                syncAction === 'backup' ? setShowBackupDialog(true) : setShowRestoreDialog(true)
              }
            >
              {syncAction === 'backup' ? (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t('skills.backup')}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t('skills.restore')}
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-l-none px-2">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSyncAction('backup')}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t('skills.backup')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSyncAction('restore')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('skills.restore')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* バックアップダイアログ */}
          <Dialog
            open={showBackupDialog}
            onOpenChange={open => {
              setShowBackupDialog(open);
              if (!open) setBackupError(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('skills.backupDialog.title')}</DialogTitle>
                <DialogDescription className="space-y-1">
                  <span>{t('skills.backupDialog.description')}</span>
                  <code className="block text-xs bg-muted px-2 py-1 rounded break-all">
                    {workspacePath}
                  </code>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-start gap-3 p-3 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-md text-sm">
                  <TriangleAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p>{t('skills.backupDialog.warning')}</p>
                </div>
                {backupError && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {backupError}
                  </div>
                )}
                <Button onClick={handleBackup} disabled={isBackingUp} className="w-full">
                  {isBackingUp && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('skills.backupDialog.submit')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* リストアダイアログ */}
          <Dialog
            open={showRestoreDialog}
            onOpenChange={open => {
              setShowRestoreDialog(open);
              if (!open) setRestoreError(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('skills.restoreDialog.title')}</DialogTitle>
                <DialogDescription className="space-y-1">
                  <span>{t('skills.restoreDialog.description')}</span>
                  <code className="block text-xs bg-muted px-2 py-1 rounded break-all">
                    {workspacePath}
                  </code>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-start gap-3 p-3 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-md text-sm">
                  <TriangleAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p>{t('skills.restoreDialog.warning')}</p>
                </div>
                {restoreError && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {restoreError}
                  </div>
                )}
                <Button onClick={handleRestore} disabled={isRestoring} className="w-full">
                  {isRestoring && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('skills.restoreDialog.submit')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Gitインポートダイアログ */}
          <Dialog
            open={showImportDialog}
            onOpenChange={open => {
              setShowImportDialog(open);
              if (!open) {
                setAvailableSkills([]);
                setSelectedSkillNames(new Set());
                setImportForm({ repository_url: '', path: 'skills', branch: 'main' });
                setImportError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <GitBranch className="h-4 w-4 mr-2" />
                {t('skills.importFromGit')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              {availableSkills.length > 0 ? (
                /* スキル一覧表示画面（複数選択対応） */
                <div className="flex flex-col h-[400px]">
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAvailableSkills([]);
                        setSelectedSkillNames(new Set());
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </Button>
                    <div className="flex-1">
                      <DialogTitle>{t('skills.importDialog.selectSkills')}</DialogTitle>
                      <DialogDescription className="text-xs mt-1">
                        {importForm.repository_url}
                      </DialogDescription>
                    </div>
                  </div>
                  {/* 全選択ボタン */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-sm text-muted-foreground">
                      {t('skills.importDialog.selectedCount', { count: selectedSkillNames.size })}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                      {selectedSkillNames.size === availableSkills.length
                        ? t('skills.importDialog.deselectAll')
                        : t('skills.importDialog.selectAll')}
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 rounded-md border">
                    <div className="p-2 space-y-1">
                      {availableSkills.map(skillName => (
                        <button
                          key={skillName}
                          type="button"
                          role="checkbox"
                          aria-checked={selectedSkillNames.has(skillName)}
                          aria-label={`Select skill ${skillName}`}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors ${
                            selectedSkillNames.has(skillName)
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => handleSelectSkillName(skillName)}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              selectedSkillNames.has(skillName)
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground'
                            }`}
                          >
                            {selectedSkillNames.has(skillName) && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <span>{skillName}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  {importError && (
                    <div className="flex items-center gap-2 mt-3 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {importError}
                    </div>
                  )}
                  <Button
                    onClick={handleImport}
                    disabled={isImporting || selectedSkillNames.size === 0}
                    className="w-full mt-4"
                  >
                    {isImporting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {selectedSkillNames.size > 0
                      ? t('skills.importDialog.submitCount', { count: selectedSkillNames.size })
                      : t('skills.importDialog.submit')}
                  </Button>
                </div>
              ) : (
                /* リポジトリ入力画面 */
                <>
                  <DialogHeader>
                    <DialogTitle>{t('skills.importDialog.title')}</DialogTitle>
                    <DialogDescription>{t('skills.importDialog.description')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* リポジトリURL（Combobox） */}
                    <div className="space-y-2">
                      <Label>{t('skills.importDialog.repositoryUrl')}</Label>
                      <Popover open={repoComboOpen} onOpenChange={setRepoComboOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={repoComboOpen}
                            className="w-full justify-between font-normal"
                          >
                            {importForm.repository_url ||
                              t('skills.importDialog.selectOrEnterRepo')}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                          <Command>
                            <CommandInput
                              placeholder={t('skills.importDialog.repositoryUrlPlaceholder')}
                              value={importForm.repository_url}
                              onValueChange={value => {
                                setImportForm(f => ({ ...f, repository_url: value }));
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>{t('skills.importDialog.enterCustomUrl')}</CommandEmpty>
                              <CommandGroup heading={t('skills.importDialog.presets')}>
                                {PRESET_REPOS.map(repo => (
                                  <CommandItem
                                    key={repo.url}
                                    value={repo.url}
                                    onSelect={() => handleSelectRepo(repo.url)}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        importForm.repository_url === repo.url
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    <span className="font-medium">{repo.label}</span>
                                    <span className="ml-2 text-xs text-muted-foreground truncate">
                                      {repo.url}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* パスとブランチ */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{t('skills.importDialog.path')}</Label>
                        <Input
                          placeholder={t('skills.importDialog.pathPlaceholder')}
                          value={importForm.path}
                          onChange={e => setImportForm(f => ({ ...f, path: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('skills.importDialog.branch')}</Label>
                        <Input
                          placeholder={t('skills.importDialog.branchPlaceholder')}
                          value={importForm.branch}
                          onChange={e => setImportForm(f => ({ ...f, branch: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* エラー表示 */}
                    {importError && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        {importError}
                      </div>
                    )}

                    {/* スキル一覧取得ボタン */}
                    <Button
                      onClick={fetchAvailableSkills}
                      disabled={isLoadingSkills || !importForm.repository_url}
                      className="w-full"
                    >
                      {isLoadingSkills && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {t('skills.importDialog.fetchSkills')}
                    </Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* 新規作成ダイアログ */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t('skills.createNew')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('skills.createDialog.title')}</DialogTitle>
                <DialogDescription>{t('skills.createDialog.description')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('skills.createDialog.name')}</Label>
                    <Input
                      placeholder={t('skills.createDialog.namePlaceholder')}
                      value={createForm.name}
                      onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('skills.createDialog.version')}</Label>
                    <Input
                      placeholder={t('skills.createDialog.versionPlaceholder')}
                      value={createForm.version}
                      onChange={e => setCreateForm(f => ({ ...f, version: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('skills.createDialog.skillDescription')}</Label>
                  <Input
                    placeholder={t('skills.createDialog.descriptionPlaceholder')}
                    value={createForm.description}
                    onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('skills.createDialog.content')}</Label>
                  <Textarea
                    placeholder={t('skills.createDialog.contentPlaceholder')}
                    value={createForm.content}
                    onChange={e => setCreateForm(f => ({ ...f, content: e.target.value }))}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
                {createError && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {createError}
                  </div>
                )}
                <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('skills.createDialog.submit')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-hidden p-4">
        {/* エラー表示 */}
        {error && (
          <div className="flex items-center gap-2 p-4 mb-4 bg-destructive/10 text-destructive rounded-md">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* スキル一覧 */}
        <ScrollArea className="h-full">
          {skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>{t('skills.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {skills.map(skill => (
                <div
                  key={skill.name}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handlePreview(skill.name)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{skill.name}</h3>
                      {skill.version && (
                        <span className="text-xs px-2 py-0.5 bg-muted rounded">
                          {skill.version}
                        </span>
                      )}
                      {skill.metadata?.source &&
                        (() => {
                          const githubInfo = parseGitHubSource(skill.metadata.source);
                          if (githubInfo) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded">
                                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                                {githubInfo.owner}/{githubInfo.repo}
                              </span>
                            );
                          }
                          return (
                            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded">
                              {skill.metadata.source}
                            </span>
                          );
                        })()}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">
                      {skill.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={e => {
                        e.stopPropagation();
                        handlePreview(skill.name);
                      }}
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={e => handleDelete(skill.name, e)}
                      disabled={deletingSkill === skill.name}
                    >
                      {deletingSkill === skill.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* プレビューダイアログ */}
      <Dialog open={showPreviewDialog} onOpenChange={handleClosePreview}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden">
          {isLoadingPreview ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : previewSkill ? (
            <div className="flex flex-col flex-1 min-h-0">
              <DialogHeader className="shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  {previewSkill.name}
                  {previewSkill.version && (
                    <span className="text-xs px-2 py-0.5 bg-muted rounded font-normal">
                      {previewSkill.version}
                    </span>
                  )}
                  {previewSkill.metadata?.source &&
                    (() => {
                      const githubInfo = parseGitHubSource(previewSkill.metadata.source);
                      if (githubInfo) {
                        return (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded font-normal">
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            {githubInfo.owner}/{githubInfo.repo}
                          </span>
                        );
                      }
                      return (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded font-normal">
                          {previewSkill.metadata.source}
                        </span>
                      );
                    })()}
                  {isEditMode && (
                    <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded font-normal">
                      {t('skills.previewDialog.editing')}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription
                  className={`whitespace-pre-wrap line-clamp-3 ${isEditMode ? 'invisible h-0 m-0' : ''}`}
                >
                  {previewSkill.description}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex flex-col flex-1 min-w-0 min-h-0">
                <Label className="text-sm font-medium mb-2">
                  {isEditMode ? 'SKILL.md' : t('skills.previewDialog.content')}
                </Label>
                {isEditMode ? (
                  <div className="flex-1 rounded-md border overflow-hidden">
                    <Editor
                      height="100%"
                      defaultLanguage="yaml"
                      value={editedRawContent}
                      onChange={value => setEditedRawContent(value || '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                      theme="vs-dark"
                    />
                  </div>
                ) : (
                  <div className="flex-1 rounded-md border overflow-y-auto">
                    <div className="p-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-code:before:content-none prose-code:after:content-none prose-pre:p-0 prose-pre:bg-transparent">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre: ({ children }) => (
                              <div className="my-3 rounded-lg bg-zinc-900 overflow-x-auto">
                                <pre className="text-zinc-100 p-4 text-sm whitespace-pre">
                                  {children}
                                </pre>
                              </div>
                            ),
                            code: props => {
                              const { children, className } = props;
                              // className があるか、children に改行が含まれる場合はブロック
                              const hasNewline =
                                typeof children === 'string' && children.includes('\n');
                              const isBlock = !!className || hasNewline;
                              if (isBlock) {
                                return (
                                  <code className="text-zinc-100 font-mono block">{children}</code>
                                );
                              }
                              return (
                                <code className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 rounded text-sm font-mono">
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {previewSkill.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
                {saveError && (
                  <div className="flex items-center gap-2 mt-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {saveError}
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-4">
                  {isEditMode ? (
                    <>
                      <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                        {t('skills.previewDialog.cancel')}
                      </Button>
                      <Button onClick={handleSaveSkill} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {t('skills.previewDialog.save')}
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={handleEnterEditMode}>
                      <Pencil className="h-4 w-4 mr-2" />
                      {t('skills.previewDialog.edit')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 後方互換性のためのエクスポート（単独ページとして使用する場合）
export function SkillsPage() {
  return <SkillsContent />;
}
