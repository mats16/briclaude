export interface ClaudeModel {
  id: string;
  name: string;
  shortName?: string;
  descriptionKey?: string;
}

// セッション作成用モデル
export const SESSION_MODELS: ClaudeModel[] = [
  {
    id: 'opus',
    name: 'Opus 4.5',
    shortName: 'Opus 4.5',
    descriptionKey: 'sidebar.model.opusDesc',
  },
  {
    id: 'sonnet',
    name: 'Sonnet 4.5',
    shortName: 'Sonnet 4.5',
    descriptionKey: 'sidebar.model.sonnetDesc',
  },
  {
    id: 'haiku',
    name: 'Haiku 4.5',
    shortName: 'Haiku 4.5',
    descriptionKey: 'sidebar.model.haikuDesc',
  },
];

// サイドバーのエージェント選択用
export const AGENT_MODELS: ClaudeModel[] = [
  { id: 'claude-agent-databricks', name: 'claude-agent-databricks' },
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku', name: 'Claude Haiku' },
];

export const DEFAULT_SESSION_MODEL = SESSION_MODELS[1]; // Sonnet
export const DEFAULT_AGENT_MODEL = AGENT_MODELS[0];
