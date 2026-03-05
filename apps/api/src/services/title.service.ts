import OpenAI from 'openai';

// Constants for title generation
const TITLE_GENERATION_PROMPT = `Generate a short, concise title (3-6 words) for a coding session based on the following first message. Respond with only the title, no quotes, markdown, or extra text.

Message: `;

const MAX_TOKENS = 50;
const FALLBACK_TITLE = 'General coding session';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Cleans up the generated title by removing common LLM artifacts.
 * - Removes surrounding quotes (single, double, backticks)
 * - Removes markdown formatting
 * - Trims whitespace
 */
function cleanTitle(rawTitle: string): string {
  let cleaned = rawTitle.trim();

  // Remove surrounding quotes (", ', `)
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('`') && cleaned.endsWith('`'))
  ) {
    cleaned = cleaned.slice(1, -1);
  }

  // Remove markdown bold/italic
  cleaned = cleaned.replace(/\*\*/g, '').replace(/\*/g, '');

  // Remove markdown code formatting
  cleaned = cleaned.replace(/`/g, '');

  return cleaned.trim();
}

const FALLBACK_APP_NAME = 'general-coding-session';
const APP_NAME_MAX_LENGTH = 30;

/**
 * Converts a title string into a Databricks Apps-compatible slug.
 * - Lowercase, alphanumeric + hyphens only
 * - Prefixed with 'a-' if first character is not a letter
 * - Max 30 characters, trimmed at hyphen boundary
 * - Falls back to 'general-coding-session' if empty
 */
export function slugifyTitle(title: string): string {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Prefix with 'a-' if first character is not a letter
  if (slug && !/^[a-z]/.test(slug)) {
    slug = `a-${slug}`;
  }

  // Trim to max length, avoiding trailing hyphen
  if (slug.length > APP_NAME_MAX_LENGTH) {
    slug = slug.slice(0, APP_NAME_MAX_LENGTH).replace(/-+$/, '');
  }

  return slug || FALLBACK_APP_NAME;
}

export interface TitleServiceConfig {
  databricksHost: string;
  model: string;
}

export interface GenerateTitleParams {
  firstSessionMessage: string;
  accessToken: string;
}

export class TitleService {
  private readonly config: TitleServiceConfig;

  constructor(config: TitleServiceConfig) {
    this.config = config;
  }

  /**
   * Generates a title for a coding session based on the first message.
   * @throws Error if the LLM call fails
   */
  async generateTitle(params: GenerateTitleParams): Promise<{ title: string; appName: string }> {
    const { firstSessionMessage, accessToken } = params;

    const client = new OpenAI({
      baseURL: `https://${this.config.databricksHost}/serving-endpoints`,
      apiKey: accessToken,
      timeout: REQUEST_TIMEOUT_MS,
    });

    const response = await client.chat.completions.create({
      model: this.config.model,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: TITLE_GENERATION_PROMPT + firstSessionMessage,
        },
      ],
    });

    const rawTitle = response.choices[0]?.message?.content;
    const title = (rawTitle ? cleanTitle(rawTitle) : FALLBACK_TITLE) || FALLBACK_TITLE;
    const appName = slugifyTitle(title);

    return { title, appName };
  }
}
