import { FastifyPluginAsync } from 'fastify';
import OpenAI from 'openai';
import type { GenerateTitleRequest, GenerateTitleResponse, ApiError } from '@repo/types';

// Constants for title generation
const TITLE_GENERATION_PROMPT = `Generate a short, concise title (3-6 words) for a coding session based on the following first message. Respond with only the title, no quotes, markdown, or extra text.

Message: `;

const MAX_TOKENS = 50;
const FALLBACK_TITLE = 'General coding session';

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

const titleRoute: FastifyPluginAsync = async fastify => {
  fastify.post<{
    Body: GenerateTitleRequest;
    Reply: GenerateTitleResponse | ApiError;
  }>('/generate_title', async (request, reply) => {
    const { first_session_message } = request.body;

    // Validation
    if (!first_session_message || typeof first_session_message !== 'string') {
      const error: ApiError = {
        error: 'ValidationError',
        message: 'first_session_message is required and must be a non-empty string',
        statusCode: 400,
      };
      return reply.status(400).send(error);
    }

    const accessToken = request.ctx?.user.oboAccessToken;
    if (!accessToken) {
      const error: ApiError = {
        error: 'Unauthorized',
        message: 'Access token is required',
        statusCode: 401,
      };
      return reply.status(401).send(error);
    }

    try {
      const model = fastify.config.ANTHROPIC_DEFAULT_HAIKU_MODEL;
      const client = new OpenAI({
        baseURL: `https://${fastify.config.DATABRICKS_HOST}/serving-endpoints/${model}`,
        apiKey: accessToken,
      });

      const response = await client.chat.completions.create({
        model,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: TITLE_GENERATION_PROMPT + first_session_message,
          },
        ],
      });

      const rawTitle = response.choices[0]?.message?.content;
      const generatedTitle = rawTitle ? cleanTitle(rawTitle) : FALLBACK_TITLE;

      return reply.send({
        title: generatedTitle || FALLBACK_TITLE,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to generate title');

      const apiError: ApiError = {
        error: 'InternalServerError',
        message: 'Failed to generate title',
        statusCode: 500,
      };
      return reply.status(500).send(apiError);
    }
  });
};

export default titleRoute;
