import { FastifyPluginAsync } from 'fastify';
import type { HealthCheckResponse } from '@repo/types';

const healthRoute: FastifyPluginAsync = async fastify => {
  fastify.get<{ Reply: HealthCheckResponse }>('/health', async (_request, reply) => {
    const response: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'claude-code-on-databricks',
    };

    return reply.send(response);
  });
};

export default healthRoute;
