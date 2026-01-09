import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Trash2, Eye, EyeOff, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tokenService } from '@/services';
import type { TokenInfo } from '@repo/types';

interface UserSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  databricksHost?: string | null;
}

export function UserSettingsModal({ open, onOpenChange, databricksHost }: UserSettingsModalProps) {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [existingToken, setExistingToken] = useState<TokenInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tokenService.getTokens();
      const databricksToken = response.tokens.find(
        tk => tk.provider === 'databricks' && tk.auth_type === 'pat'
      );
      setExistingToken(databricksToken || null);
    } catch {
      setError(t('settings.token.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // モーダルが開いたときにトークン情報を取得
  useEffect(() => {
    if (open) {
      fetchTokens();
      setIsReplacing(false);
      setToken('');
      setError(null);
      setSuccess(null);
    }
  }, [open, fetchTokens]);

  const handleSave = async () => {
    if (!token.trim()) {
      setError(t('settings.token.emptyError'));
      return;
    }

    if (!token.startsWith('dapi')) {
      setError(t('settings.token.formatError'));
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await tokenService.registerToken({
        provider: 'databricks',
        auth_type: 'pat',
        token: token.trim(),
      });
      setSuccess(t('settings.token.saveSuccess'));
      setToken('');
      setIsReplacing(false);
      await fetchTokens();
    } catch {
      setError(t('settings.token.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      await tokenService.deleteToken({
        provider: 'databricks',
        auth_type: 'pat',
      });
      setSuccess(t('settings.token.deleteSuccess'));
      setExistingToken(null);
    } catch {
      setError(t('settings.token.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReplace = () => {
    setIsReplacing(true);
    setError(null);
    setSuccess(null);
  };

  const handleCancelReplace = () => {
    setIsReplacing(false);
    setToken('');
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription>{t('settings.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Databricks PAT セクション */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              {t('settings.token.label')}
            </Label>

            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : existingToken && !isReplacing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <span className="font-mono text-sm">{existingToken.masked_token}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {t('settings.token.registered')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleReplace} className="flex-1">
                    {t('settings.token.replace')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder={t('settings.token.placeholder')}
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  {isReplacing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelReplace}
                      className="flex-1"
                    >
                      {t('common.cancel')}
                    </Button>
                  )}
                  <Button onClick={handleSave} disabled={isSaving} size="sm" className="flex-1">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {t('settings.token.save')}
                  </Button>
                </div>
              </div>
            )}

            {/* ヘルプテキスト */}
            <p className="text-xs text-muted-foreground">{t('settings.token.help')}</p>

            {/* PAT 作成ページへのリンク */}
            {databricksHost && (
              <a
                href={`https://${databricksHost}/settings/user/developer/access-tokens`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {t('settings.token.createLink')}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* メッセージ表示 */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-md text-sm">
              <Check className="h-4 w-4 shrink-0" />
              {success}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
