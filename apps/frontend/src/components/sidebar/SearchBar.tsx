import { useState } from 'react';
import { Search, Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onSubmit?: (query: string) => void;
}

export function SearchBar({ onSearch, onSubmit }: SearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch?.(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      onSubmit?.(query);
    }
  };

  return (
    <div className="px-3 py-2 shrink-0">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Input
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={t('sidebar.searchPlaceholder')}
            className="h-9 bg-muted/50 border-0 pr-8 focus-visible:ring-1"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                >
                  <Image className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Attach image</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => query.trim() && onSubmit?.(query)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t('main.send')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
