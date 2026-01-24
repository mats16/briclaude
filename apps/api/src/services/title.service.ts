import OpenAI from 'openai';
import crypto from 'node:crypto';

// Constants for title generation
const TITLE_GENERATION_PROMPT = `<task>
Generate a session title and app identifier based on the user's first message.
</task>

<instructions>
<title_rules>
- 3-6 words, concise and descriptive
- Capture the main purpose of the session
- No quotes, markdown, or extra formatting
</title_rules>

<app_base_rules>
- Lowercase, kebab-case (e.g., "react-form", "api-test")
- 2-16 characters only
- Alphanumeric and hyphens only
- Describe the project or technology briefly
</app_base_rules>
</instructions>

<input_message>
{{MESSAGE}}
</input_message>`;

// JSON Schema for structured output
const TITLE_GENERATION_SCHEMA = {
  name: 'title_generation',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'A concise session title (3-6 words)',
      },
      app_name_base: {
        type: 'string',
        description: 'A short kebab-case identifier (2-16 characters)',
      },
    },
    required: ['title', 'app_name_base'],
    additionalProperties: false,
  },
} as const;

const MAX_TOKENS = 100;
const FALLBACK_TITLE = 'General coding session';
const FALLBACK_APP_BASE = 'session';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const APP_NAME_PREFIX = 'claude-';
const RANDOM_SUFFIX_LENGTH = 6;
const MAX_APP_NAME_LENGTH = 30;
// claude- (7) + base + - (1) + suffix (6) = 14 + base, so base max = 16
const MAX_APP_BASE_LENGTH = 16;

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

/**
 * Parses the JSON response from the LLM.
 * Extracts title and app_base from the structured output.
 */
function parseJsonResponse(response: string): { title: string; appNameBase: string } {
  try {
    const parsed = JSON.parse(response) as { title?: string; app_name_base?: string };

    return {
      title: parsed.title ? cleanTitle(parsed.title) : FALLBACK_TITLE,
      appNameBase: parsed.app_name_base ? cleanAppBase(parsed.app_name_base) : FALLBACK_APP_BASE,
    };
  } catch {
    return {
      title: FALLBACK_TITLE,
      appNameBase: FALLBACK_APP_BASE,
    };
  }
}

/**
 * Cleans and validates the app_base string.
 * - Converts to lowercase
 * - Replaces invalid characters with hyphens
 * - Trims to max length
 * - Removes leading/trailing hyphens
 */
function cleanAppBase(rawAppBase: string): string {
  let cleaned = rawAppBase
    .trim()
    .toLowerCase()
    // Replace any non-alphanumeric characters (except hyphen) with hyphen
    .replace(/[^a-z0-9-]/g, '-')
    // Replace multiple consecutive hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');

  // Truncate to max length
  if (cleaned.length > MAX_APP_BASE_LENGTH) {
    cleaned = cleaned.slice(0, MAX_APP_BASE_LENGTH).replace(/-+$/, '');
  }

  return cleaned || FALLBACK_APP_BASE;
}

/**
 * Generates a random hex suffix for app_name.
 */
function generateRandomSuffix(): string {
  return crypto.randomBytes(RANDOM_SUFFIX_LENGTH / 2).toString('hex');
}

/**
 * Constructs the full app_name from the base.
 * Format: claude-{base}-{8-char-hex}
 */
function constructAppName(appBase: string): string {
  const suffix = generateRandomSuffix();
  const appName = `${APP_NAME_PREFIX}${appBase}-${suffix}`;

  // Ensure we don't exceed max length (should not happen with proper base length)
  if (appName.length > MAX_APP_NAME_LENGTH) {
    const excessLength = appName.length - MAX_APP_NAME_LENGTH;
    const truncatedBase = appBase.slice(0, appBase.length - excessLength).replace(/-+$/, '');
    return `${APP_NAME_PREFIX}${truncatedBase}-${suffix}`;
  }

  return appName;
}

export interface TitleServiceConfig {
  databricksHost: string;
  model: string;
}

export interface GenerateTitleParams {
  firstSessionMessage: string;
  accessToken: string;
}

export interface GenerateTitleResult {
  title: string;
  appName: string;
}

export class TitleService {
  private readonly config: TitleServiceConfig;

  constructor(config: TitleServiceConfig) {
    this.config = config;
  }

  /**
   * Generates a title and app_name for a coding session based on the first message.
   * Uses a single LLM call with XML-structured prompt and structured JSON output.
   * @throws Error if the LLM call fails
   */
  async generateTitle(params: GenerateTitleParams): Promise<GenerateTitleResult> {
    const { firstSessionMessage, accessToken } = params;

    const client = new OpenAI({
      baseURL: `https://${this.config.databricksHost}/serving-endpoints`,
      apiKey: accessToken,
      timeout: REQUEST_TIMEOUT_MS,
    });

    const prompt = TITLE_GENERATION_PROMPT.replace('{{MESSAGE}}', firstSessionMessage);

    const response = await client.chat.completions.create({
      model: this.config.model,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: TITLE_GENERATION_SCHEMA,
      },
    });

    const rawContent = response.choices[0]?.message?.content;

    if (!rawContent) {
      return {
        title: FALLBACK_TITLE,
        appName: constructAppName(FALLBACK_APP_BASE),
      };
    }

    const { title, appNameBase } = parseJsonResponse(rawContent);

    return {
      title: title || FALLBACK_TITLE,
      appName: constructAppName(appNameBase),
    };
  }
}
