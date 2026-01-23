import { FastifyPluginAsync } from 'fastify';
import type {
  AgentListResponse,
  AgentDetailResponse,
  AgentCreateRequest,
  AgentCreateResponse,
  AgentImportRequest,
  AgentImportResponse,
  AgentUpdateRequest,
  AgentUpdateResponse,
  AgentDeleteResponse,
  AgentBackupResponse,
  AgentRestoreResponse,
  ApiError,
} from '@repo/types';
import {
  listAgents,
  getAgent,
  createAgent,
  importAgentsFromGit,
  updateAgent,
  deleteAgent,
  backupAgentsToWorkspace,
  restoreAgentsFromWorkspace,
} from '../services/agent.service.js';
import { createUserContext } from '../lib/user-context.js';

const userAgentsRoute: FastifyPluginAsync = async fastify => {
  /**
   * GET /user/agents
   * エージェント一覧取得
   */
  fastify.get<{
    Reply: AgentListResponse | ApiError;
  }>('/user/agents', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    try {
      const ctx = createUserContext(fastify, request);
      const agents = await listAgents(ctx);
      return reply.send({ agents });
    } catch (error) {
      request.log.error(error, 'Failed to list agents');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to list agents',
        statusCode: 500,
      });
    }
  });

  /**
   * GET /user/agents/:name
   * エージェント詳細取得
   */
  fastify.get<{
    Params: { name: string };
    Reply: AgentDetailResponse | ApiError;
  }>('/user/agents/:name', async (request, reply) => {
    const { user } = request.ctx!;
    const { name } = request.params;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    try {
      const ctx = createUserContext(fastify, request);
      const agent = await getAgent(ctx, name);

      if (!agent) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `Agent '${name}' not found`,
          statusCode: 404,
        });
      }

      return reply.send({ agent });
    } catch (error) {
      // バリデーションエラーは 400 Bad Request を返す
      if (error instanceof Error && error.message.includes('Invalid agent name')) {
        return reply.status(400).send({
          error: 'BadRequest',
          message: error.message,
          statusCode: 400,
        });
      }

      request.log.error(error, 'Failed to get agent');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to get agent',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /user/agents
   * エージェント登録
   */
  fastify.post<{
    Body: AgentCreateRequest;
    Reply: AgentCreateResponse | ApiError;
  }>('/user/agents', async (request, reply) => {
    const { user } = request.ctx!;
    const { name, version, description, content, tools } = request.body;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    // バリデーション: 必須フィールドチェック
    if (!name || !version || !description || !content) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Missing required fields: name, version, description, content',
        statusCode: 400,
      });
    }

    // バリデーション: バージョンフォーマット（semver）
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Invalid version format. Use semantic versioning (e.g., 1.0.0)',
        statusCode: 400,
      });
    }

    try {
      const ctx = createUserContext(fastify, request);
      const authorName = user.name || undefined;
      const agent = await createAgent(
        ctx,
        { name, version, description, content, tools },
        authorName
      );

      return reply.status(201).send({
        success: true,
        message: 'Agent created successfully',
        agent,
      });
    } catch (error) {
      request.log.error(error, 'Failed to create agent');

      // バリデーションエラーは 400 Bad Request を返す
      if (error instanceof Error && error.message.includes('Invalid agent name')) {
        return reply.status(400).send({
          error: 'BadRequest',
          message: error.message,
          statusCode: 400,
        });
      }

      // 重複エラーの場合
      if ((error as Error).message?.includes('already exists')) {
        return reply.status(409).send({
          error: 'Conflict',
          message: `Agent '${name}' already exists`,
          statusCode: 409,
        });
      }

      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to create agent',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /user/agents/import
   * Gitリポジトリからインポート（複数パス対応）
   */
  fastify.post<{
    Body: AgentImportRequest;
    Reply: AgentImportResponse | ApiError;
  }>('/user/agents/import', async (request, reply) => {
    const { user } = request.ctx!;
    const { repository_url, paths, branch } = request.body;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    // バリデーション: 必須フィールドチェック
    if (!repository_url || !paths || !Array.isArray(paths) || paths.length === 0) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Missing required fields: repository_url, paths (non-empty array)',
        statusCode: 400,
      });
    }

    // バリデーション: パス配列のサイズ制限（DoS対策）
    const MAX_PATHS = 20;
    if (paths.length > MAX_PATHS) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: `Too many paths specified. Maximum is ${MAX_PATHS}.`,
        statusCode: 400,
      });
    }

    // バリデーション: 各パスが有効な文字列であることを確認
    const invalidPaths = paths.filter(
      p => typeof p !== 'string' || p.trim() === '' || p.includes('\0')
    );
    if (invalidPaths.length > 0) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Invalid path in paths array: each path must be a non-empty string',
        statusCode: 400,
      });
    }

    // バリデーション: 重複パスのチェック
    const uniquePaths = new Set(paths);
    if (uniquePaths.size !== paths.length) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Duplicate paths detected. Each path must be unique.',
        statusCode: 400,
      });
    }

    // バリデーション: URLフォーマット（HTTPSまたはSSH）
    const isHttps = repository_url.startsWith('https://');
    const isSsh = repository_url.startsWith('git@');
    if (!isHttps && !isSsh) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Invalid repository URL. Must be HTTPS or SSH format.',
        statusCode: 400,
      });
    }

    try {
      const ctx = createUserContext(fastify, request);
      const importedAgents = await importAgentsFromGit(ctx, {
        repository_url,
        paths,
        branch: branch ?? 'main',
      });

      return reply.status(201).send({
        success: true,
        message: `Successfully imported ${importedAgents.length} agent(s)`,
        imported_agents: importedAgents,
      });
    } catch (error) {
      request.log.error(error, 'Failed to import agents from Git');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to import agents from Git repository',
        statusCode: 500,
      });
    }
  });

  /**
   * PUT /user/agents/:name
   * エージェント更新
   */
  fastify.put<{
    Params: { name: string };
    Body: AgentUpdateRequest;
    Reply: AgentUpdateResponse | ApiError;
  }>('/user/agents/:name', async (request, reply) => {
    const { user } = request.ctx!;
    const { name } = request.params;
    const { raw_content } = request.body;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    // バリデーション: raw_content が必須
    if (!raw_content) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'raw_content is required',
        statusCode: 400,
      });
    }

    try {
      const ctx = createUserContext(fastify, request);
      const agent = await updateAgent(ctx, name, { raw_content });

      if (!agent) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `Agent '${name}' not found`,
          statusCode: 404,
        });
      }

      return reply.send({
        success: true,
        message: 'Agent updated successfully',
        agent,
      });
    } catch (error) {
      // バリデーションエラーは 400 Bad Request を返す
      if (error instanceof Error && error.message.includes('Invalid agent name')) {
        return reply.status(400).send({
          error: 'BadRequest',
          message: error.message,
          statusCode: 400,
        });
      }

      request.log.error(error, 'Failed to update agent');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to update agent',
        statusCode: 500,
      });
    }
  });

  /**
   * DELETE /user/agents/:name
   * エージェント削除
   */
  fastify.delete<{
    Params: { name: string };
    Reply: AgentDeleteResponse | ApiError;
  }>('/user/agents/:name', async (request, reply) => {
    const { user } = request.ctx!;
    const { name } = request.params;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    try {
      const ctx = createUserContext(fastify, request);
      const deleted = await deleteAgent(ctx, name);

      if (!deleted) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `Agent '${name}' not found`,
          statusCode: 404,
        });
      }

      return reply.send({
        success: true,
        message: 'Agent deleted successfully',
      });
    } catch (error) {
      // バリデーションエラーは 400 Bad Request を返す
      if (error instanceof Error && error.message.includes('Invalid agent name')) {
        return reply.status(400).send({
          error: 'BadRequest',
          message: error.message,
          statusCode: 400,
        });
      }

      request.log.error(error, 'Failed to delete agent');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to delete agent',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /user/agents/backup
   * エージェントを Workspace にバックアップ
   */
  fastify.post<{
    Reply: AgentBackupResponse | ApiError;
  }>('/user/agents/backup', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    try {
      const ctx = createUserContext(fastify, request);
      const result = await backupAgentsToWorkspace(ctx);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to backup agents');

      // PAT未登録エラー
      if ((error as Error).message?.includes('PAT is required')) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'PAT is required for backup operation',
          statusCode: 401,
        });
      }

      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to backup agents to Workspace',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /user/agents/restore
   * Workspace からエージェントをリストア
   */
  fastify.post<{
    Reply: AgentRestoreResponse | ApiError;
  }>('/user/agents/restore', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    try {
      const ctx = createUserContext(fastify, request);
      const result = await restoreAgentsFromWorkspace(ctx);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to restore agents');

      // PAT未登録エラー
      if ((error as Error).message?.includes('PAT is required')) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'PAT is required for restore operation',
          statusCode: 401,
        });
      }

      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to restore agents from Workspace',
        statusCode: 500,
      });
    }
  });
};

export default userAgentsRoute;
