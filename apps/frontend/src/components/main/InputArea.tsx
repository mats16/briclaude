import { useState, useRef, useEffect } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import { Send, Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { TEXTAREA_MAX_HEIGHT_MAIN } from '@/constants';

interface InputAreaProps {
  sessionId?: string;
  onSend?: (content: string) => Promise<void> | void;
  disabled?: boolean;
}

export function InputArea({ sessionId, onSend, disabled }: InputAreaProps) {
  const { t } = useTranslation();
  const storageKey = sessionId ? `chat-draft-${sessionId}` : 'chat-draft-temp';
  const [content, setContent] = useLocalStorageState(storageKey, {
    defaultValue: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, TEXTAREA_MAX_HEIGHT_MAIN)}px`;
    }
  }, [content]);

  const handleSubmit = async () => {
    if (content.trim() && !disabled && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onSend?.(content.trim());
        setContent('');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
      <div className="relative w-full max-w-[735px] mx-auto pointer-events-auto">
        <div className="relative flex flex-col rounded-xl border border-border bg-background p-2 shadow-lg">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('main.inputPlaceholder')}
            disabled={disabled}
            className="min-h-[40px] max-h-[150px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none px-1 py-0"
            rows={1}
          />
          <div className="flex items-center justify-between shrink-0 mt-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <Image className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Attach image</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleSubmit}
                    disabled={!content.trim() || disabled || isSubmitting}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('main.send')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
