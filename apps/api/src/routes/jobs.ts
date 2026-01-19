import { FastifyPluginAsync } from 'fastify';
import type { JobsListQuerystring, JobRunsListQuerystring } from '@repo/types';
import { createUserContext } from '../lib/user-context.js';

const jobsRoute: FastifyPluginAsync = async fastify => {
  const databricksHost = fastify.config.DATABRICKS_HOST;

  // GET /jobs/list - List jobs
  fastify.get<{
    Querystring: JobsListQuerystring;
  }>('/jobs/list', async (request, reply) => {
    const ctx = createUserContext(fastify, request);
    const authProvider = await ctx.getAuthProvider();

    if (authProvider.type !== 'pat') {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'PAT is not registered',
        statusCode: 401,
      });
    }

    const pat = await authProvider.getToken();

    const url = new URL('/api/2.2/jobs/list', `https://${databricksHost}`);

    const { limit, offset, name, expand_tasks } = request.query;
    if (limit !== undefined) url.searchParams.set('limit', String(limit));
    if (offset !== undefined) url.searchParams.set('offset', String(offset));
    if (name !== undefined) url.searchParams.set('name', name);
    if (expand_tasks !== undefined) url.searchParams.set('expand_tasks', String(expand_tasks));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${pat}`,
      },
    });

    const data = await response.json();
    return reply.status(response.status).send(data);
  });

  // GET /jobs/runs/list - List job runs
  fastify.get<{
    Querystring: JobRunsListQuerystring;
  }>('/jobs/runs/list', async (request, reply) => {
    const ctx = createUserContext(fastify, request);
    const authProvider = await ctx.getAuthProvider();

    if (authProvider.type !== 'pat') {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'PAT is not registered',
        statusCode: 401,
      });
    }

    const pat = await authProvider.getToken();

    const url = new URL('/api/2.2/jobs/runs/list', `https://${databricksHost}`);

    const {
      job_id,
      limit,
      offset,
      active_only,
      completed_only,
      run_type,
      expand_tasks,
      start_time_from,
      start_time_to,
    } = request.query;

    if (job_id !== undefined) url.searchParams.set('job_id', String(job_id));
    if (limit !== undefined) url.searchParams.set('limit', String(limit));
    if (offset !== undefined) url.searchParams.set('offset', String(offset));
    if (active_only !== undefined) url.searchParams.set('active_only', String(active_only));
    if (completed_only !== undefined)
      url.searchParams.set('completed_only', String(completed_only));
    if (run_type !== undefined) url.searchParams.set('run_type', run_type);
    if (expand_tasks !== undefined) url.searchParams.set('expand_tasks', String(expand_tasks));
    if (start_time_from !== undefined)
      url.searchParams.set('start_time_from', String(start_time_from));
    if (start_time_to !== undefined) url.searchParams.set('start_time_to', String(start_time_to));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${pat}`,
      },
    });

    const data = await response.json();
    return reply.status(response.status).send(data);
  });
};

export default jobsRoute;
