import { FastifyPluginAsync } from 'fastify';
import type { AppTemplateCloneRequest, AppTemplateCloneResponse } from '@repo/types';
import { createUserContext } from '../lib/user-context.js';

const GITHUB_REPO_URL = 'https://github.com/databricks/app-templates';

const appTemplatesRoute: FastifyPluginAsync = async fastify => {
  const databricksHost = fastify.config.DATABRICKS_HOST;

  // POST /app-templates/clone - Clone a template to workspace
  fastify.post<{
    Body: AppTemplateCloneRequest;
    Reply: AppTemplateCloneResponse;
  }>('/app-templates/clone', async (request, reply) => {
    const { templateName } = request.body;

    if (!templateName || templateName.trim() === '') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'templateName is required',
        statusCode: 400,
      } as unknown as AppTemplateCloneResponse);
    }

    const ctx = createUserContext(fastify, request);
    const pat = await ctx.getPat();

    if (!pat) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'PAT is not registered',
        statusCode: 401,
      } as unknown as AppTemplateCloneResponse);
    }

    // Get user email to construct workspace path
    const userEmail = request.ctx?.user.email;
    if (!userEmail) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'User email not found',
        statusCode: 400,
      } as unknown as AppTemplateCloneResponse);
    }

    // Construct workspace path: /Workspace/Users/<email>/databricks_apps/<template>-<timestamp>
    const timestamp = Math.floor(Date.now() / 1000);
    const repoName = `${templateName}-${timestamp}`;
    const workspacePath = `/Workspace/Users/${userEmail}/databricks_apps/${repoName}`;

    // Use sparse checkout to clone only the specific template directory
    const gitUrl = `${GITHUB_REPO_URL}.git`;
    const apiUrl = new URL('/api/2.0/repos', `https://${databricksHost}`);

    const createRepoBody = {
      url: gitUrl,
      provider: 'gitHub',
      path: workspacePath,
      sparse_checkout: {
        patterns: [templateName],
      },
    };

    fastify.log.info(`Creating repo at ${workspacePath} from template ${templateName}`);

    const repoResponse = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${pat}`,
      },
      body: JSON.stringify(createRepoBody),
    });

    const data = (await repoResponse.json()) as AppTemplateCloneResponse;

    if (!repoResponse.ok) {
      fastify.log.error({ status: repoResponse.status, data }, 'Databricks API error');
      return reply.status(repoResponse.status).send(data);
    }

    return reply.status(201).send(data);
  });
};

export default appTemplatesRoute;
