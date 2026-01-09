import fp from 'fastify-plugin';
import OpenAI from 'openai';

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Creates an OpenAI client configured for Databricks serving endpoints.
     * @param accessToken - The user's OAuth access token for authentication
     * @param model - The model name to use (determines the endpoint URL)
     */
    createOpenAIClient: (accessToken: string, model: string) => OpenAI;
  }
}

export default fp(
  async fastify => {
    const createOpenAIClient = (accessToken: string, model: string): OpenAI => {
      return new OpenAI({
        baseURL: `https://${fastify.config.DATABRICKS_HOST}/serving-endpoints/${model}`,
        apiKey: accessToken,
      });
    };

    fastify.decorate('createOpenAIClient', createOpenAIClient);

    fastify.log.info('OpenAI client factory registered');
  },
  {
    name: 'openai-client',
    dependencies: ['config'],
  }
);
