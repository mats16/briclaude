import { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const MODELS = [
  { id: 'claude-agent-databricks', name: 'claude-agent-databricks' },
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku', name: 'Claude Haiku' },
] as const;

interface ModelSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState(value || MODELS[0].id);

  const handleChange = (newValue: string) => {
    setSelectedModel(newValue);
    onChange?.(newValue);
  };

  return (
    <div className="px-3 py-2 shrink-0">
      <div className="flex items-center gap-2">
        <Select value={selectedModel} onValueChange={handleChange}>
          <SelectTrigger className="flex-1 h-9 bg-muted/50 border-0 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">
                <SelectValue />
              </span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 shrink-0 whitespace-nowrap">
          <Sparkles className="h-4 w-4 mr-1" />
          {t('sidebar.model.default')}
        </Button>
      </div>
    </div>
  );
}
