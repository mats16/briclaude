import { Globe, LogOut, Check, Settings } from 'lucide-react';
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

interface UserMenuProps {
  userName?: string;
  userEmail?: string;
}

export function UserMenu({ userName = 'User', userEmail }: UserMenuProps) {
  const { t, i18n } = useTranslation();

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

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
            <span>{userName}</span>
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
