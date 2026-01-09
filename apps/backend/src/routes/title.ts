import { FastifyPluginAsync } from 'fastify';
import OpenAI from 'openai';
import type { GenerateTitleRequest, GenerateTitleResponse } from '@repo/types';

const titleRoute: FastifyPluginAsync = async fastify => {
  fastify.post<{ Body: GenerateTitleRequest; Reply: GenerateTitleResponse }>(
    '/generate_title',
    async (request, reply) => {
      const { first_session_message } = request.body;

      if (!first_session_message || typeof first_session_message !== 'string') {
        return reply.status(400).send({
          title: 'General coding session',
        });
      }

      try {
        const client = new OpenAI({
          baseURL: `https://${fastify.config.DATABRICKS_HOST}/serving-endpoints/${fastify.config.ANTHROPIC_DEFAULT_HAIKU_MODEL}`,
          apiKey: request.ctx?.user.oboAccessToken || '',
        });

        const response = await client.chat.completions.create({
          model: fastify.config.ANTHROPIC_DEFAULT_HAIKU_MODEL,
          max_tokens: 50,
          messages: [
            {
              role: 'user',
              content: `Generate a short, concise title (3-6 words) for a coding session based on the following first message. Respond with only the title, no quotes or extra text.\n\nMessage: ${first_session_message}`,
            },
          ],
        });

        const generatedTitle =
          response.choices[0]?.message?.content?.trim() || 'General coding session';

        return reply.send({
          title: generatedTitle,
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to generate title');
        return reply.send({
          title: 'General coding session',
        });
      }
    }
  );
};

export default titleRoute;
