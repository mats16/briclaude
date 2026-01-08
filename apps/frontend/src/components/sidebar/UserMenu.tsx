import { Globe, LogOut, Check, Settings, AlertCircle, RefreshCw } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';

interface UserMenuProps {
  userName?: string;
  userEmail?: string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function UserMenu({ userName, userEmail, isLoading, error, onRetry }: UserMenuProps) {
  const { t, i18n } = useTranslation();

  const displayName = userName || 'User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  if (isLoading) {
    return (
      <div className="px-3 h-[50px] flex items-center border-t border-border shrink-0">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 h-[50px] flex items-center gap-2 border-t border-border shrink-0">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs truncate">{t('user.loadError')}</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label={t('common.retry')}
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 h-[50px] flex items-center border-t border-border shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full hover:ring-2 hover:ring-primary/50 transition-all">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col">
            <span>{displayName}</span>
            {userEmail && (
              <span className="text-xs font-normal text-muted-foreground">{userEmail}</span>
            )}
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
                <span className={i18n.language !== 'en' ? 'ml-6' : ''}>{t('language.en')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLanguage('ja')}>
                {i18n.language === 'ja' && <Check className="h-4 w-4 mr-2" />}
                <span className={i18n.language !== 'ja' ? 'ml-6' : ''}>{t('language.ja')}</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem>
            <Settings className="h-4 w-4 mr-2" />
            {t('user.settings')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            {t('user.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
