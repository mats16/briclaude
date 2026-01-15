import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { SkillInfo, SkillDetail } from '@repo/types';

/** プリセットリポジトリ */
const PRESET_REPOS = [
  {
    label: 'Anthropic',
    url: 'https://github.com/anthropics/skills',
  },
  {
    label: 'Databricks',
    url: 'https://github.com/mats16/claude-agent-databricks',
  },
];

/** GitHub APIのディレクトリエントリ型 */
interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

interface SkillsContentProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function SkillsContent({ isSidebarOpen, onToggleSidebar }: SkillsContentProps) {
  const { t } = useTranslation();
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
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);

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
    setSelectedSkillName(null);
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
    setSelectedSkillName(null);
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

  // スキルを選択
  const handleSelectSkillName = (skillName: string) => {
    if (selectedSkillName === skillName) {
      setSelectedSkillName(null);
    } else {
      setSelectedSkillName(skillName);
    }
  };

  // Gitインポート
  const handleImport = async () => {
    setIsImporting(true);
    setImportError(null);
    // スキル選択時はパスを更新
    const finalForm = selectedSkillName
      ? { ...importForm, path: `${importForm.path}/${selectedSkillName}` }
      : importForm;
    try {
      await skillService.importFromGit(finalForm);
      setShowImportDialog(false);
      setImportForm({ repository_url: '', path: 'skills', branch: 'main' });
      setAvailableSkills([]);
      setSelectedSkillName(null);
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

  // サイドバートグルボタンを表示するかどうか
  const showSidebarToggle = isSidebarOpen !== undefined && onToggleSidebar !== undefined;

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
        <div className="flex items-center gap-3">
          {showSidebarToggle && !isSidebarOpen && (
            <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <line x1="9" x2="9" y1="3" y2="21" />
              </svg>
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold">{t('skills.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('skills.description')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Gitインポートダイアログ */}
          <Dialog
            open={showImportDialog}
            onOpenChange={open => {
              setShowImportDialog(open);
              if (!open) {
                setAvailableSkills([]);
                setSelectedSkillName(null);
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
                /* スキル一覧表示画面 */
                <div className="flex flex-col h-[400px]">
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAvailableSkills([]);
                        setSelectedSkillName(null);
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
                    <div>
                      <DialogTitle>{t('skills.importDialog.selectSkill')}</DialogTitle>
                      <DialogDescription className="text-xs mt-1">
                        {importForm.repository_url}
                      </DialogDescription>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 rounded-md border">
                    <div className="p-2 space-y-1">
                      {availableSkills.map(skillName => (
                        <button
                          key={skillName}
                          type="button"
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-md transition-colors ${
                            selectedSkillName === skillName
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => handleSelectSkillName(skillName)}
                        >
                          <span>{skillName}</span>
                          {selectedSkillName === skillName && <Check className="h-4 w-4" />}
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
                    disabled={isImporting || !selectedSkillName}
                    className="w-full mt-4"
                  >
                    {isImporting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {t('skills.importDialog.submit')}
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
                      {skill.metadata?.source && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded">
                          Imported
                        </span>
                      )}
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
                  {previewSkill.metadata?.source && (
                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded font-normal">
                      Imported
                    </span>
                  )}
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
