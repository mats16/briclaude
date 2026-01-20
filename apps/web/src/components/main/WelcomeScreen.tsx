import { useState, useRef, useEffect, useCallback } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { useTranslation } from 'react-i18next';
import {
  Send,
  Image,
  ChevronDown,
  Check,
  Loader2,
  Bug,
  Rocket,
  Construction,
  DatabaseZap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QuickstartCard } from './QuickstartCard';
import { QuickstartModal, QuickstartType } from './QuickstartModal';
import { ImagePreview } from './ImagePreview';
import { DropZoneOverlay } from './DropZoneOverlay';
import { WorkspaceSelector } from '@/components/workspace/WorkspaceSelector';
import { useImageAttachment } from '@/hooks/useImageAttachment';
import { useDragDrop } from '@/hooks/useDragDrop';
import { useRecentWorkspaces } from '@/hooks/useRecentWorkspaces';
import { useUser } from '@/hooks/useUser';
import { buildMessageContent } from '@/lib/content-builder';
import { SESSION_MODELS, DEFAULT_SESSION_MODEL, TEXTAREA_MAX_HEIGHT_MAIN } from '@/constants';
import type { UserMessageContentBlock, WorkspaceSelection } from '@repo/types';

interface WelcomeScreenProps {
  onNewSession?: (
    content: UserMessageContentBlock[],
    modelId: string,
    workspaceSelection: WorkspaceSelection | null,
    enableDatabricksApps: boolean,
    enableDatabricksSqlWrite: boolean
  ) => Promise<void> | void;
  sessionError?: string | null;
}

export function WelcomeScreen({ onNewSession, sessionError }: WelcomeScreenProps) {
  const { t } = useTranslation();
  const { hasPat } = useUser();
  const [selectedQuickstart, setSelectedQuickstart] = useState<QuickstartType | null>(null);
  const [content, setContent] = useLocalStorageState('chat-draft-new-session', {
    defaultValue: '',
  });
  const [selectedModelId, setSelectedModelId] = useLocalStorageState('selected-model-id', {
    defaultValue: DEFAULT_SESSION_MODEL.id,
  });
  const selectedModel = SESSION_MODELS.find(m => m.id === selectedModelId) ?? DEFAULT_SESSION_MODEL;
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceSelection | null>(null);
  const [enableDatabricksApps, setEnableDatabricksApps] = useState(false);
  const [enableDatabricksSqlWrite, setEnableDatabricksSqlWrite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addRecentWorkspace } = useRecentWorkspaces();

  // 画像添付フック
  const { images, isProcessing, addImages, removeImage, clearImages, hasImages } =
    useImageAttachment({
      onError: message => {
        // TODO: トーストで表示
        console.error(message);
      },
    });

  // ドラッグ&ドロップフック
  const { isDragging } = useDragDrop(containerRef, {
    onDrop: addImages,
    disabled: isSubmitting,
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, TEXTAREA_MAX_HEIGHT_MAIN)}px`;
    }
  }, [content]);

  const handleSubmit = async () => {
    const hasContent = content.trim() || hasImages;
    if (!hasContent || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const messageContent = buildMessageContent(content.trim(), images);
      // Workspace選択があれば履歴に追加
      if (selectedWorkspace) {
        addRecentWorkspace(
          selectedWorkspace.path,
          selectedWorkspace.object_id,
          selectedWorkspace.object_type
        );
      }
      await onNewSession?.(
        messageContent,
        selectedModel.id,
        selectedWorkspace,
        enableDatabricksApps,
        enableDatabricksSqlWrite
      );
      setContent('');
      clearImages();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        addImages(files);
      }
      // 同じファイルを再選択できるようにリセット
      e.target.value = '';
    },
    [addImages]
  );

  const canSubmit = (content.trim() || hasImages) && !isSubmitting;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const quickstarts = [
    {
      type: 'lakeflow' as const,
      icon: Bug,
      title: t('welcome.quickstarts.lakeflow.title'),
      description: t('welcome.quickstarts.lakeflow.description'),
    },
    {
      type: 'databricksApps' as const,
      icon: Rocket,
      title: t('welcome.quickstarts.databricksApps.title'),
      description: t('welcome.quickstarts.databricksApps.description'),
    },
    {
      type: 'tbd' as const,
      icon: Construction,
      title: t('welcome.quickstarts.tbd.title'),
      description: t('welcome.quickstarts.tbd.description'),
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {/* Title */}
      <div className="w-full max-w-3xl mb-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground">{t('welcome.heading')}</h1>
      </div>

      {/* Workspace Selector */}
      <div className="w-full max-w-3xl mb-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <WorkspaceSelector
                  value={selectedWorkspace}
                  onChange={setSelectedWorkspace}
                  disabled={isSubmitting || !hasPat}
                />
              </div>
            </TooltipTrigger>
            {!hasPat && (
              <TooltipContent>
                <p>{t('workspace.patRequired')}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Chat Input Area */}
      <div ref={containerRef} className="relative w-full max-w-3xl mb-6">
        <DropZoneOverlay isVisible={isDragging} />
        <div className="relative flex flex-col rounded-xl border border-border bg-background p-3 shadow-sm">
          {/* 画像プレビュー */}
          <ImagePreview images={images} onRemove={removeImage} disabled={isSubmitting} />

          <Textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('sidebar.newSessionPlaceholder')}
            className="min-h-[60px] max-h-[150px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none px-1 py-0 text-base"
            rows={2}
          />
          <div className="flex items-center justify-between shrink-0 mt-2">
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleImageButtonClick}
                      disabled={isSubmitting || isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Image className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('sidebar.attachImage')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('h-8 w-8 shrink-0', enableDatabricksApps && 'bg-red-500/10')}
                      onClick={() => setEnableDatabricksApps(prev => !prev)}
                      disabled={isSubmitting}
                    >
                      <Rocket
                        className={cn(
                          'h-4 w-4',
                          enableDatabricksApps
                            ? 'text-red-500 stroke-[2.5]'
                            : 'text-muted-foreground'
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('welcome.databricksAppsToggle')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8 shrink-0',
                        enableDatabricksSqlWrite && 'bg-orange-500/10'
                      )}
                      onClick={() => setEnableDatabricksSqlWrite(prev => !prev)}
                      disabled={isSubmitting}
                    >
                      <DatabaseZap
                        className={cn(
                          'h-4 w-4',
                          enableDatabricksSqlWrite
                            ? 'text-orange-500 stroke-[2.5]'
                            : 'text-muted-foreground'
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('welcome.databricksSqlWriteToggle')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {selectedModel.shortName}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {SESSION_MODELS.map(model => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => setSelectedModelId(model.id)}
                      className="flex items-start justify-between py-2"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{model.name}</span>
                        {model.descriptionKey && (
                          <span className="text-xs text-muted-foreground">
                            {t(model.descriptionKey)}
                          </span>
                        )}
                      </div>
                      {selectedModel.id === model.id && (
                        <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('sidebar.startSession')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        {sessionError && (
          <div className="mt-2 px-1">
            <p className="text-sm text-destructive">{sessionError}</p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Quickstart Cards - Horizontal Layout */}
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-3">
        {quickstarts.map(qs => (
          <QuickstartCard
            key={qs.type}
            icon={qs.icon}
            title={qs.title}
            description={qs.description}
            onClick={() => setSelectedQuickstart(qs.type)}
          />
        ))}
      </div>

      {/* Quickstart Modal */}
      <QuickstartModal
        open={selectedQuickstart !== null}
        onOpenChange={open => !open && setSelectedQuickstart(null)}
        quickstartType={selectedQuickstart}
        onFillPrompt={(prompt, workspaceSelection, enableApps) => {
          setContent(prompt);
          if (workspaceSelection) {
            setSelectedWorkspace(workspaceSelection);
            addRecentWorkspace(
              workspaceSelection.path,
              workspaceSelection.object_id,
              workspaceSelection.object_type
            );
          }
          if (enableApps) {
            setEnableDatabricksApps(true);
          }
        }}
      />
    </div>
  );
}
