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

interface UserFooterExpandedProps {
  displayName: string;
  initials: string;
  databricksHost?: string | null;
  onSettingsOpen: () => void;
}

export function UserFooterExpanded({
  displayName,
  initials,
  databricksHost,
  onSettingsOpen,
}: UserFooterExpandedProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="px-3 h-[50px] flex items-center border-t border-border shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full hover:ring-2 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>
            <span className="truncate">{displayName}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            {t('user.claudeCode')}
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => navigate('/skills')}>
            <Sparkles className="h-4 w-4 mr-2" />
            {t('user.skills')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/agents')}>
            <Bot className="h-4 w-4 mr-2" />
            {t('user.agents')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSettingsOpen}>
            <Settings className="h-4 w-4 mr-2" />
            {t('user.settings')}
          </DropdownMenuItem>
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
  );
}
