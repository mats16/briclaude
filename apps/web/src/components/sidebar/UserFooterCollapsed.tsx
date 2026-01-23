import { useNavigate } from 'react-router-dom';
import { Globe, Check, Settings, ExternalLink, Sparkles, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface UserFooterCollapsedProps {
  displayName: string;
  initials: string;
  databricksHost?: string | null;
  onSettingsOpen: () => void;
}

export function UserFooterCollapsed({
  displayName,
  initials,
  databricksHost,
  onSettingsOpen,
}: UserFooterCollapsedProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <>
      {/* Icon buttons for collapsed state */}
      <div className="flex flex-col items-center gap-1 py-2 mt-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate('/skills')}
              aria-label={t('user.skills')}
              className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('user.skills')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate('/agents')}
              aria-label={t('user.agents')}
              className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
            >
              <Bot className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('user.agents')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onSettingsOpen}
              aria-label={t('user.settings')}
              className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('user.settings')}</TooltipContent>
        </Tooltip>
      </div>

      {/* User avatar */}
      <div className="h-[50px] flex items-center justify-center border-t border-border shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={displayName}
              className="rounded-full hover:ring-2 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
            >
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="right" className="w-72">
            <DropdownMenuLabel>
              <span className="truncate">{displayName}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Globe className="h-4 w-4 mr-2" />
                {t('user.language')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                  {i18n.language === 'en' && <Check className="h-4 w-4 mr-2" />}
                  <span className={i18n.language !== 'en' ? 'ml-6' : ''}>English</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('ja')}>
                  {i18n.language === 'ja' && <Check className="h-4 w-4 mr-2" />}
                  <span className={i18n.language !== 'ja' ? 'ml-6' : ''}>日本語</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a
                href={databricksHost ? `https://${databricksHost}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('user.databricksConsole')}
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
