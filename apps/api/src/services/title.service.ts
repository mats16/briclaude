import OpenAI from 'openai';
import crypto from 'node:crypto';

// Constants
const MAX_TOKENS = 100;
const FALLBACK_TITLE = 'General coding session';
const FALLBACK_APP_BASE = 'session';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const APP_NAME_PREFIX = 'claude-';
const RANDOM_SUFFIX_LENGTH = 6;
const MAX_APP_NAME_LENGTH = 30;
// Derived: MAX_APP_NAME_LENGTH - APP_NAME_PREFIX.length - 1 (separator) - RANDOM_SUFFIX_LENGTH
const MAX_APP_BASE_LENGTH = MAX_APP_NAME_LENGTH - APP_NAME_PREFIX.length - 1 - RANDOM_SUFFIX_LENGTH;

// Prompt for title generation
const TITLE_GENERATION_PROMPT = `<task>
Generate a session title and app identifier based on the user's first message.
</task>

<instructions>
<title_rules>
- 3-6 words, concise and descriptive
- Capture the main purpose of the session
- No quotes, markdown, or extra formatting
</title_rules>

<app_name_base_rules>
- Lowercase, kebab-case (e.g., "react-form", "api-test")
- 2-${MAX_APP_BASE_LENGTH} characters only
- Alphanumeric and hyphens only
- Describe the project or technology briefly
</app_name_base_rules>
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
        description: `A short kebab-case identifier (2-${MAX_APP_BASE_LENGTH} characters)`,
        minLength: 2,
        maxLength: MAX_APP_BASE_LENGTH,
      },
    },
    required: ['title', 'app_name_base'],
    additionalProperties: false,
  },
};

/**
 * Escapes XML special characters to prevent prompt injection.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
 *
 * Processing order:
 * 1. Trim whitespace and convert to lowercase
 * 2. Replace invalid characters with hyphens
 * 3. Normalize consecutive hyphens to single hyphen
 * 4. Remove leading/trailing hyphens
 * 5. Truncate to max length (and remove any trailing hyphens from truncation)
 */
function cleanAppBase(rawAppBase: string): string {
  const cleaned = rawAppBase
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphen
    .replace(/-+/g, '-') // Normalize consecutive hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // Truncate if needed, then remove any trailing hyphens caused by truncation
  if (cleaned.length > MAX_APP_BASE_LENGTH) {
    return cleaned.slice(0, MAX_APP_BASE_LENGTH).replace(/-+$/, '') || FALLBACK_APP_BASE;
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
 * Format: claude-{base}-{6-char-hex}
 */
function constructAppName(appNameBase: string): string {
  const suffix = generateRandomSuffix();

  let base = appNameBase;
  if (base.length > MAX_APP_BASE_LENGTH) {
    base = base.slice(0, MAX_APP_BASE_LENGTH).replace(/-+$/, '');
  }

  return `${APP_NAME_PREFIX}${base}-${suffix}`;
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

    const prompt = TITLE_GENERATION_PROMPT.replace('{{MESSAGE}}', escapeXml(firstSessionMessage));

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
      title,
      appName: constructAppName(appNameBase),
    };
  }
}
