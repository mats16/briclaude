import { FastifyPluginAsync } from 'fastify';
import type {
  GitHubContentItem,
  AppTemplate,
  AppTemplatesResponse,
  AppTemplateCloneRequest,
  AppTemplateCloneResponse,
} from '@repo/types';
import { createUserContext } from '../lib/user-context.js';

const GITHUB_REPO_OWNER = 'databricks';
const GITHUB_REPO_NAME = 'app-templates';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents`;
const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

const appTemplatesRoute: FastifyPluginAsync = async fastify => {
  const databricksHost = fastify.config.DATABRICKS_HOST;

  // GET /app-templates - List available templates
  fastify.get<{
    Reply: AppTemplatesResponse;
  }>('/app-templates', async (_request, reply) => {
    try {
      // Fetch repository contents from GitHub API
      const response = await fetch(GITHUB_API_URL, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Briclaude-App',
        },
      });

      if (!response.ok) {
        fastify.log.error(`GitHub API error: ${response.status} ${response.statusText}`);
        return reply.status(response.status).send({
          templates: [],
        });
      }

      const contents = (await response.json()) as GitHubContentItem[];

      // Filter directories only (each directory is a template)
      const templates: AppTemplate[] = contents
        .filter(item => item.type === 'dir' && !item.name.startsWith('.'))
        .map(item => ({
          name: item.name,
          url: item.html_url,
          description: formatTemplateName(item.name),
        }));

      return reply.send({ templates });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to fetch app templates');
      return reply.status(500).send({
        templates: [],
      });
    }
  });

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

/**
 * Convert kebab-case template name to human-readable format
 */
function formatTemplateName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default appTemplatesRoute;
