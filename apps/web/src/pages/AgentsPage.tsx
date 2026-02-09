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
import { agentService } from '@/services';
import { useUser } from '@/hooks/useUser';
import type { AgentInfo, AgentDetail } from '@repo/types';

/** プリセットリポジトリの型 */
interface PresetRepo {
  label: string;
  url: string;
  defaultPath: string;
  defaultBranch: string;
}

/** プリセットリポジトリ */
const PRESET_REPOS: PresetRepo[] = [
  {
    label: 'Awesome',
    url: 'https://github.com/VoltAgent/awesome-claude-code-subagents',
    defaultPath: 'categories/05-data-ai',
    defaultBranch: 'main',
  },
];

/** 利用可能なツール一覧 */
const AVAILABLE_TOOLS = [
  'Task',
  'TaskOutput',
  'Bash',
  'Glob',
  'Grep',
  'ExitPlanMode',
  'Read',
  'Edit',
  'Write',
  'NotebookEdit',
  'WebFetch',
  'TodoWrite',
  'KillShell',
  'AskUserQuestion',
  'Skill',
  'EnterPlanMode',
  'mcp__sql__execute_sql',
  'mcp__sql__execute_sql_read_only',
  'mcp__sql__poll_sql_result',
] as const;

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

export function AgentsContent() {
  const { t } = useTranslation();
  const { user } = useUser();
  const workspacePath = user?.name
    ? `/Workspace/Users/${user.name}/.assistant/agents`
    : '/Workspace/Users/{username}/.assistant/agents';
  const [agents, setAgents] = useState<AgentInfo[]>([]);
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
    tools: [] as string[],
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [toolInput, setToolInput] = useState('');
  const [showToolSuggestions, setShowToolSuggestions] = useState(false);

  // フォーム状態（インポート）
  const [importForm, setImportForm] = useState({
    repository_url: '',
    path: 'agents',
    branch: 'main',
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // リポジトリ選択コンボボックス
  const [repoComboOpen, setRepoComboOpen] = useState(false);

  // スキル一覧
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [selectedAgentNames, setSelectedAgentNames] = useState<Set<string>>(new Set());

  // 削除中のスキル名
  const [deletingAgent, setDeletingAgent] = useState<string | null>(null);

  // プレビュー状態
  const [previewAgent, setPreviewAgent] = useState<AgentDetail | null>(null);
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
  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await agentService.getAgents();
      setAgents(response.agents);
    } catch {
      setError(t('agents.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // スキル作成
  const handleCreate = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      // 配列をカンマ区切り文字列に変換
      const toolsString = createForm.tools.length > 0 ? createForm.tools.join(', ') : undefined;
      await agentService.createAgent({
        ...createForm,
        tools: toolsString,
      });
      setShowCreateDialog(false);
      setCreateForm({ name: '', version: '1.0.0', description: '', content: '', tools: [] });
      await fetchAgents();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('agents.createError'));
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
  const handleSelectRepo = (url: string, defaultPath: string, defaultBranch: string) => {
    setImportForm(f => ({
      ...f,
      repository_url: url,
      path: defaultPath,
      branch: defaultBranch,
    }));
    setAvailableAgents([]);
    setSelectedAgentNames(new Set());
    setImportError(null);
    setRepoComboOpen(false);
  };

  // スキル一覧を取得
  const fetchAvailableAgents = async () => {
    const apiUrl = buildGitHubApiUrl(importForm.repository_url, importForm.path);
    if (!apiUrl) {
      setImportError(t('agents.importDialog.invalidUrl'));
      return;
    }
    setIsLoadingAgents(true);
    setImportError(null);
    setAvailableAgents([]);
    setSelectedAgentNames(new Set());
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Failed to fetch');
      const data: GitHubContent[] = await response.json();
      const agentNames = data
        .filter(
          item => item.type === 'file' && item.name.endsWith('.md') && !item.name.startsWith('.')
        )
        .map(item => item.name.replace(/\.md$/, ''))
        .sort();
      setAvailableAgents(agentNames);
    } catch {
      setImportError(t('agents.importDialog.fetchError'));
    } finally {
      setIsLoadingAgents(false);
    }
  };

  // スキルを選択（複数選択対応）
  const handleSelectAgentName = (agentName: string) => {
    setSelectedAgentNames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentName)) {
        newSet.delete(agentName);
      } else {
        newSet.add(agentName);
      }
      return newSet;
    });
  };

  // 全選択/全解除
  const handleSelectAll = () => {
    if (selectedAgentNames.size === availableAgents.length) {
      setSelectedAgentNames(new Set());
    } else {
      setSelectedAgentNames(new Set(availableAgents));
    }
  };

  // Gitインポート（複数パス対応）
  const handleImport = async () => {
    setIsImporting(true);
    setImportError(null);
    // 選択されたエージェントのパス配列を構築（空文字を除外してパスを結合）
    const paths =
      selectedAgentNames.size > 0
        ? Array.from(selectedAgentNames).map(name =>
            [importForm.path, `${name}.md`].filter(Boolean).join('/')
          )
        : [importForm.path];
    try {
      await agentService.importFromGit({
        repository_url: importForm.repository_url,
        paths,
        branch: importForm.branch,
      });
      setShowImportDialog(false);
      setImportForm({ repository_url: '', path: 'categories/05-data-ai', branch: 'main' });
      setAvailableAgents([]);
      setSelectedAgentNames(new Set());
      await fetchAgents();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('agents.importError'));
    } finally {
      setIsImporting(false);
    }
  };

  // スキル削除
  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('agents.deleteConfirm', { name }))) return;

    setDeletingAgent(name);
    try {
      await agentService.deleteAgent(name);
      await fetchAgents();
    } catch {
      setError(t('agents.deleteError'));
    } finally {
      setDeletingAgent(null);
    }
  };

  // スキルプレビュー
  const handlePreview = async (name: string) => {
    setIsLoadingPreview(true);
    setShowPreviewDialog(true);
    try {
      const response = await agentService.getAgent(name);
      setPreviewAgent(response.agent);
    } catch {
      setError(t('agents.fetchError'));
      setShowPreviewDialog(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // プレビューダイアログを閉じる
  const handleClosePreview = () => {
    setShowPreviewDialog(false);
    setPreviewAgent(null);
    setIsEditMode(false);
    setEditedRawContent('');
    setSaveError(null);
  };

  // 編集モードに入る
  const handleEnterEditMode = () => {
    if (previewAgent) {
      setEditedRawContent(previewAgent.raw_content);
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
  const handleSaveAgent = async () => {
    if (!previewAgent) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await agentService.updateAgent(previewAgent.name, {
        raw_content: editedRawContent,
      });
      // 更新後にプレビューを再取得
      const response = await agentService.getAgent(previewAgent.name);
      setPreviewAgent(response.agent);
      setIsEditMode(false);
      setEditedRawContent('');
      await fetchAgents();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('agents.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  // バックアップ
  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupError(null);
    try {
      await agentService.backup();
      setShowBackupDialog(false);
      toast.success(t('agents.backupDialog.success'));
      await fetchAgents();
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : t('agents.backupDialog.error'));
    } finally {
      setIsBackingUp(false);
    }
  };

  // リストア
  const handleRestore = async () => {
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await agentService.restore();
      setShowRestoreDialog(false);
      toast.success(t('agents.restoreDialog.success'));
      await fetchAgents();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : t('agents.restoreDialog.error'));
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
          <h1 className="text-xl font-bold">{t('agents.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('agents.description')}</p>
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
                  {t('agents.backup')}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t('agents.restore')}
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
                  {t('agents.backup')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSyncAction('restore')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('agents.restore')}
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
                <DialogTitle>{t('agents.backupDialog.title')}</DialogTitle>
                <DialogDescription className="space-y-1">
                  <span>{t('agents.backupDialog.description')}</span>
                  <code className="block text-xs bg-muted px-2 py-1 rounded break-all">
                    {workspacePath}
                  </code>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-start gap-3 p-3 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-md text-sm">
                  <TriangleAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p>{t('agents.backupDialog.warning')}</p>
                </div>
                {backupError && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {backupError}
                  </div>
                )}
                <Button onClick={handleBackup} disabled={isBackingUp} className="w-full">
                  {isBackingUp && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('agents.backupDialog.submit')}
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
                <DialogTitle>{t('agents.restoreDialog.title')}</DialogTitle>
                <DialogDescription className="space-y-1">
                  <span>{t('agents.restoreDialog.description')}</span>
                  <code className="block text-xs bg-muted px-2 py-1 rounded break-all">
                    {workspacePath}
                  </code>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-start gap-3 p-3 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-md text-sm">
                  <TriangleAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p>{t('agents.restoreDialog.warning')}</p>
                </div>
                {restoreError && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {restoreError}
                  </div>
                )}
                <Button onClick={handleRestore} disabled={isRestoring} className="w-full">
                  {isRestoring && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('agents.restoreDialog.submit')}
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
                setAvailableAgents([]);
                setSelectedAgentNames(new Set());
                setImportForm({
                  repository_url: '',
                  path: 'categories/05-data-ai',
                  branch: 'main',
                });
                setImportError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <GitBranch className="h-4 w-4 mr-2" />
                {t('agents.importFromGit')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              {availableAgents.length > 0 ? (
                /* スキル一覧表示画面（複数選択対応） */
                <div className="flex flex-col h-[400px]">
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAvailableAgents([]);
                        setSelectedAgentNames(new Set());
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
                      <DialogTitle>{t('agents.importDialog.selectAgents')}</DialogTitle>
                      <DialogDescription className="text-xs mt-1">
                        {importForm.repository_url}
                      </DialogDescription>
                    </div>
                  </div>
                  {/* 全選択ボタン */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-sm text-muted-foreground">
                      {t('agents.importDialog.selectedCount', { count: selectedAgentNames.size })}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                      {selectedAgentNames.size === availableAgents.length
                        ? t('agents.importDialog.deselectAll')
                        : t('agents.importDialog.selectAll')}
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 rounded-md border">
                    <div className="p-2 space-y-1">
                      {availableAgents.map(agentName => (
                        <button
                          key={agentName}
                          type="button"
                          role="checkbox"
                          aria-checked={selectedAgentNames.has(agentName)}
                          aria-label={`Select agent ${agentName}`}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors ${
                            selectedAgentNames.has(agentName)
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => handleSelectAgentName(agentName)}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              selectedAgentNames.has(agentName)
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground'
                            }`}
                          >
                            {selectedAgentNames.has(agentName) && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <span>{agentName}</span>
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
                    disabled={isImporting || selectedAgentNames.size === 0}
                    className="w-full mt-4"
                  >
                    {isImporting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {selectedAgentNames.size > 0
                      ? t('agents.importDialog.submitCount', { count: selectedAgentNames.size })
                      : t('agents.importDialog.submit')}
                  </Button>
                </div>
              ) : (
                /* リポジトリ入力画面 */
                <>
                  <DialogHeader>
                    <DialogTitle>{t('agents.importDialog.title')}</DialogTitle>
                    <DialogDescription>{t('agents.importDialog.description')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* リポジトリURL（Combobox） */}
                    <div className="space-y-2">
                      <Label>{t('agents.importDialog.repositoryUrl')}</Label>
                      <Popover open={repoComboOpen} onOpenChange={setRepoComboOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={repoComboOpen}
                            className="w-full justify-between font-normal"
                          >
                            {importForm.repository_url ||
                              t('agents.importDialog.selectOrEnterRepo')}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                          <Command>
                            <CommandInput
                              placeholder={t('agents.importDialog.repositoryUrlPlaceholder')}
                              value={importForm.repository_url}
                              onValueChange={value => {
                                setImportForm(f => ({ ...f, repository_url: value }));
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>{t('agents.importDialog.enterCustomUrl')}</CommandEmpty>
                              <CommandGroup heading={t('agents.importDialog.presets')}>
                                {PRESET_REPOS.map(repo => (
                                  <CommandItem
                                    key={repo.url}
                                    value={repo.url}
                                    onSelect={() =>
                                      handleSelectRepo(
                                        repo.url,
                                        repo.defaultPath,
                                        repo.defaultBranch
                                      )
                                    }
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
                        <Label>{t('agents.importDialog.path')}</Label>
                        <Input
                          placeholder={t('agents.importDialog.pathPlaceholder')}
                          value={importForm.path}
                          onChange={e => setImportForm(f => ({ ...f, path: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('agents.importDialog.branch')}</Label>
                        <Input
                          placeholder={t('agents.importDialog.branchPlaceholder')}
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
                      onClick={fetchAvailableAgents}
                      disabled={isLoadingAgents || !importForm.repository_url}
                      className="w-full"
                    >
                      {isLoadingAgents && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {t('agents.importDialog.fetchAgents')}
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
                {t('agents.createNew')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('agents.createDialog.title')}</DialogTitle>
                <DialogDescription>{t('agents.createDialog.description')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('agents.createDialog.name')}</Label>
                    <Input
                      placeholder={t('agents.createDialog.namePlaceholder')}
                      value={createForm.name}
                      onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('agents.createDialog.version')}</Label>
                    <Input
                      placeholder={t('agents.createDialog.versionPlaceholder')}
                      value={createForm.version}
                      onChange={e => setCreateForm(f => ({ ...f, version: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('agents.createDialog.agentDescription')}</Label>
                  <Input
                    placeholder={t('agents.createDialog.descriptionPlaceholder')}
                    value={createForm.description}
                    onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tools (Optional)</Label>
                  <div className="relative">
                    <Input
                      placeholder="Type tool name..."
                      value={toolInput}
                      onChange={e => {
                        setToolInput(e.target.value);
                        setShowToolSuggestions(e.target.value.length > 0);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && toolInput.trim()) {
                          e.preventDefault();
                          const trimmedTool = toolInput.trim();
                          if (!createForm.tools.includes(trimmedTool)) {
                            setCreateForm(f => ({ ...f, tools: [...f.tools, trimmedTool] }));
                          }
                          setToolInput('');
                          setShowToolSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        if (toolInput.length > 0) {
                          setShowToolSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        // 候補クリック時に閉じないよう遅延
                        setTimeout(() => setShowToolSuggestions(false), 200);
                      }}
                    />
                    {showToolSuggestions && toolInput.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                        {AVAILABLE_TOOLS.filter(
                          tool =>
                            tool.toLowerCase().includes(toolInput.toLowerCase()) &&
                            !createForm.tools.includes(tool)
                        ).map(tool => (
                          <button
                            key={tool}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            onMouseDown={e => {
                              e.preventDefault();
                              if (!createForm.tools.includes(tool)) {
                                setCreateForm(f => ({ ...f, tools: [...f.tools, tool] }));
                              }
                              setToolInput('');
                              setShowToolSuggestions(false);
                            }}
                          >
                            {tool}
                          </button>
                        ))}
                        {AVAILABLE_TOOLS.filter(
                          tool =>
                            tool.toLowerCase().includes(toolInput.toLowerCase()) &&
                            !createForm.tools.includes(tool)
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Press Enter to add &quot;{toolInput}&quot;
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {createForm.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {createForm.tools.map(tool => (
                        <span
                          key={tool}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs"
                        >
                          {tool}
                          <button
                            type="button"
                            onClick={() =>
                              setCreateForm(f => ({
                                ...f,
                                tools: f.tools.filter(t => t !== tool),
                              }))
                            }
                            className="hover:text-destructive"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t('agents.createDialog.content')}</Label>
                  <Textarea
                    placeholder={t('agents.createDialog.contentPlaceholder')}
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
                  {t('agents.createDialog.submit')}
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
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>{t('agents.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {agents.map(agent => (
                <div
                  key={agent.name}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handlePreview(agent.name)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{agent.name}</h3>
                      {agent.version && (
                        <span className="text-xs px-2 py-0.5 bg-muted rounded">
                          {agent.version}
                        </span>
                      )}
                      {agent.metadata?.source &&
                        (() => {
                          const githubInfo = parseGitHubSource(agent.metadata.source);
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
                              {agent.metadata.source}
                            </span>
                          );
                        })()}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">
                      {agent.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={e => {
                        e.stopPropagation();
                        handlePreview(agent.name);
                      }}
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={e => handleDelete(agent.name, e)}
                      disabled={deletingAgent === agent.name}
                    >
                      {deletingAgent === agent.name ? (
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
          ) : previewAgent ? (
            <div className="flex flex-col flex-1 min-h-0">
              <DialogHeader className="shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  {previewAgent.name}
                  {previewAgent.version && (
                    <span className="text-xs px-2 py-0.5 bg-muted rounded font-normal">
                      {previewAgent.version}
                    </span>
                  )}
                  {previewAgent.metadata?.source &&
                    (() => {
                      const githubInfo = parseGitHubSource(previewAgent.metadata.source);
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
                          {previewAgent.metadata.source}
                        </span>
                      );
                    })()}
                  {isEditMode && (
                    <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded font-normal">
                      {t('agents.previewDialog.editing')}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription
                  className={`whitespace-pre-wrap line-clamp-3 ${isEditMode ? 'invisible h-0 m-0' : ''}`}
                >
                  {previewAgent.description}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex flex-col flex-1 min-w-0 min-h-0">
                <Label className="text-sm font-medium mb-2">
                  {isEditMode ? 'SKILL.md' : t('agents.previewDialog.content')}
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
                          {previewAgent.content}
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
                        {t('agents.previewDialog.cancel')}
                      </Button>
                      <Button onClick={handleSaveAgent} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {t('agents.previewDialog.save')}
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={handleEnterEditMode}>
                      <Pencil className="h-4 w-4 mr-2" />
                      {t('agents.previewDialog.edit')}
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
export function AgentsPage() {
  return <AgentsContent />;
}
