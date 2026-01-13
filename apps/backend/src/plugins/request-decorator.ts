import fp from 'fastify-plugin';
import crypto from 'node:crypto';

interface RequestUser {
  /** The user identifier provided by the IdP. */
  id: string;
  /** The user name provided by the IdP. */
  name: string;
  /** The user email provided by the IdP. */
  email: string;
  /** The user's access token as on-behalf-of-user authorization */
  oboAccessToken: string;
}

interface RequestContext {
  /** The original host or domain requested by the client. */
  host: string;
  /** The UUID of the request. */
  requestId: string;
  /** The IP address of the client that made the original request. */
  realIp: string;
  /** The user information from Databricks Apps headers. */
  user: RequestUser;
}

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext | null;
  }
}

export default fp(
  async (fastify, _record) => {
    // Add request context decorator
    fastify.decorateRequest('ctx', null);

    // Add onRequest hook for extracting request context
    fastify.addHook('onRequest', async (req, _reply) => {
      const userEmail = (req.headers['x-forwarded-email'] ?? '') as string;
      req.ctx = {
        host: (req.headers['x-forwarded-host'] as string) ?? req.hostname,
        requestId: (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
        realIp: (req.headers['x-real-ip'] as string) ?? req.ip,
        user: {
          id: (req.headers['x-forwarded-user'] ?? '') as string,
          name: (req.headers['x-forwarded-preferred-username'] ?? '') as string,
          email: userEmail,
          oboAccessToken: (req.headers['x-forwarded-access-token'] ?? '') as string,
        },
      };
    });
  },
  { name: 'request-decorator' }
);
