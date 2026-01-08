import { useState, useRef, useEffect } from 'react';
import { Send, Image, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
<<<<<<< HEAD
import { SESSION_MODELS, DEFAULT_SESSION_MODEL, TEXTAREA_MAX_HEIGHT_SIDEBAR } from '@/constants';

interface NewSessionInputProps {
  onSubmit?: (content: string, modelId: string) => Promise<void> | void;
=======

const CLAUDE_MODELS = [
  { id: 'opus', name: 'Opus 4.5', shortName: 'Opus 4.5', descriptionKey: 'sidebar.model.opusDesc' },
  { id: 'sonnet', name: 'Sonnet 4.5', shortName: 'Sonnet 4.5', descriptionKey: 'sidebar.model.sonnetDesc' },
  { id: 'haiku', name: 'Haiku 4.5', shortName: 'Haiku 4.5', descriptionKey: 'sidebar.model.haikuDesc' },
];

interface NewSessionInputProps {
  onSubmit?: (content: string, modelId: string) => void;
>>>>>>> 6c0290e (Add user route and service for user management)
  disabled?: boolean;
}

export function NewSessionInput({ onSubmit, disabled }: NewSessionInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
<<<<<<< HEAD
  const [selectedModel, setSelectedModel] = useState(DEFAULT_SESSION_MODEL);
  const [isSubmitting, setIsSubmitting] = useState(false);
=======
  const [selectedModel, setSelectedModel] = useState(CLAUDE_MODELS[1]); // Default to Sonnet
>>>>>>> 6c0290e (Add user route and service for user management)
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
<<<<<<< HEAD
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, TEXTAREA_MAX_HEIGHT_SIDEBAR)}px`;
    }
  }, [content]);

  const handleSubmit = async () => {
    if (content.trim() && !disabled && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onSubmit?.(content.trim(), selectedModel.id);
        setContent('');
      } finally {
        setIsSubmitting(false);
      }
=======
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [content]);

  const handleSubmit = () => {
    if (content.trim() && !disabled) {
      onSubmit?.(content.trim(), selectedModel.id);
      setContent('');
>>>>>>> 6c0290e (Add user route and service for user management)
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-3 py-2 shrink-0">
      <div className="flex flex-col rounded-xl border border-border bg-background p-2">
        <Textarea
          ref={textareaRef}
          value={content}
<<<<<<< HEAD
          onChange={e => setContent(e.target.value)}
=======
          onChange={(e) => setContent(e.target.value)}
>>>>>>> 6c0290e (Add user route and service for user management)
          onKeyDown={handleKeyDown}
          placeholder={t('sidebar.newSessionPlaceholder')}
          disabled={disabled}
          className="min-h-[36px] max-h-[120px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none px-1 py-0 text-sm"
          rows={1}
        />
        <div className="flex items-center justify-between shrink-0 mt-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
<<<<<<< HEAD
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
=======
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                >
>>>>>>> 6c0290e (Add user route and service for user management)
                  <Image className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('sidebar.attachImage')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {selectedModel.shortName}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
<<<<<<< HEAD
                {SESSION_MODELS.map(model => (
=======
                {CLAUDE_MODELS.map((model) => (
>>>>>>> 6c0290e (Add user route and service for user management)
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => setSelectedModel(model)}
                    className="flex items-start justify-between py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{model.name}</span>
<<<<<<< HEAD
                      {model.descriptionKey && (
                        <span className="text-xs text-muted-foreground">
                          {t(model.descriptionKey)}
                        </span>
                      )}
=======
                      <span className="text-xs text-muted-foreground">
                        {t(model.descriptionKey)}
                      </span>
>>>>>>> 6c0290e (Add user route and service for user management)
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
                    className="h-7 w-7 shrink-0"
                    onClick={handleSubmit}
<<<<<<< HEAD
                    disabled={!content.trim() || disabled || isSubmitting}
=======
                    disabled={!content.trim() || disabled}
>>>>>>> 6c0290e (Add user route and service for user management)
                  >
                    <Send className="h-3.5 w-3.5" />
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
    </div>
  );
}
