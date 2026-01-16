import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { Send, Image, Loader2, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { TEXTAREA_MAX_HEIGHT_MAIN } from '@/constants';
import { useImageAttachment } from '@/hooks/useImageAttachment';
import { useDragDrop } from '@/hooks/useDragDrop';
import { buildMessageContent } from '@/lib/content-builder';
import { ImagePreview } from './ImagePreview';
import { DropZoneOverlay } from './DropZoneOverlay';
import type { UserMessageContentBlock } from '@repo/types';

interface InputAreaProps {
  sessionId?: string;
  onSend?: (content: UserMessageContentBlock[]) => Promise<void> | void;
  onAbort?: () => Promise<boolean>;
  isAgentThinking?: boolean;
  disabled?: boolean;
}

export function InputArea({
  sessionId,
  onSend,
  onAbort,
  isAgentThinking = false,
  disabled,
}: InputAreaProps) {
  const { t } = useTranslation();
  const storageKey = sessionId ? `chat-draft-${sessionId}` : 'chat-draft-temp';
  const [content, setContent] = useLocalStorageState(storageKey, {
    defaultValue: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAborting, setIsAborting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 画像添付フック
  const { images, isProcessing, addImages, removeImage, clearImages, hasImages } =
    useImageAttachment({
      onError: message => {
        toast.error(message);
      },
    });

  // ドラッグ&ドロップフック
  const { isDragging } = useDragDrop(containerRef, {
    onDrop: addImages,
    disabled: disabled || isSubmitting,
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, TEXTAREA_MAX_HEIGHT_MAIN)}px`;
    }
  }, [content]);

  const handleSubmit = async () => {
    const hasContent = content.trim() || hasImages;
    if (!hasContent || disabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const messageContent = buildMessageContent(content.trim(), images);
      await onSend?.(messageContent);
      setContent('');
      clearImages();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        addImages(imageFiles);
      }
    },
    [addImages]
  );

  const handleAbort = async () => {
    if (isAborting || !onAbort) return;

    setIsAborting(true);
    try {
      await onAbort();
    } finally {
      setIsAborting(false);
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

  const canSubmit = useMemo(
    () => (content.trim() || hasImages) && !disabled && !isSubmitting,
    [content, hasImages, disabled, isSubmitting]
  );

  // 停止ボタン表示条件：テキストがブランク かつ 画像もなし かつ thinking 中
  const showStopButton = isAgentThinking && !content.trim() && !hasImages;

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
      <div ref={containerRef} className="relative w-full max-w-[735px] mx-auto pointer-events-auto">
        <DropZoneOverlay isVisible={isDragging} />
        <div className="relative flex flex-col rounded-xl border border-border bg-background p-2 shadow-lg">
          {/* 画像プレビュー */}
          <ImagePreview
            images={images}
            onRemove={removeImage}
            disabled={disabled || isSubmitting}
          />

          <Textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={t('main.inputPlaceholder')}
            disabled={disabled}
            className="min-h-[40px] max-h-[150px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none px-1 py-0"
            rows={1}
          />
          <div className="flex items-center justify-between shrink-0 mt-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleImageButtonClick}
                    disabled={disabled || isSubmitting || isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Image className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('main.attachImage')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {showStopButton ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleAbort}
                      disabled={isAborting}
                    >
                      {isAborting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('main.stop')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
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
                    <p>{t('main.send')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

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
    </div>
  );
}
