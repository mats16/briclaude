import { FastifyPluginAsync } from 'fastify';
import type {
  SkillListResponse,
  SkillDetailResponse,
  SkillCreateRequest,
  SkillCreateResponse,
  SkillImportRequest,
  SkillImportResponse,
  SkillUpdateRequest,
  SkillUpdateResponse,
  SkillDeleteResponse,
  SkillBackupResponse,
  SkillRestoreResponse,
  ApiError,
} from '@repo/types';
import {
  listSkills,
  getSkill,
  createSkill,
  importSkillsFromGit,
  updateSkill,
  deleteSkill,
  backupSkillsToWorkspace,
  restoreSkillsFromWorkspace,
} from '../services/skill.service.js';
import { createUserContext } from '../lib/user-context.js';

const userSkillsRoute: FastifyPluginAsync = async fastify => {
  /**
   * GET /user/skills
   * スキル一覧取得
   */
  fastify.get<{
    Reply: SkillListResponse | ApiError;
  }>('/user/skills', async (request, reply) => {
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
      const skills = await listSkills(ctx);
      return reply.send({ skills });
    } catch (error) {
      request.log.error(error, 'Failed to list skills');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to list skills',
        statusCode: 500,
      });
    }
  });

  /**
   * GET /user/skills/:name
   * スキル詳細取得
   */
  fastify.get<{
    Params: { name: string };
    Reply: SkillDetailResponse | ApiError;
  }>('/user/skills/:name', async (request, reply) => {
    const { user } = request.ctx!;
    const { name } = request.params;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    // バリデーション: スキル名のフォーマットチェック（英数字、ハイフン、アンダースコアのみ）
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return reply.status(400).send({
        error: 'BadRequest',
        message:
          'Invalid skill name format. Only alphanumeric, hyphens, and underscores are allowed.',
        statusCode: 400,
      });
    }

    try {
      const ctx = createUserContext(fastify, request);
      const skill = await getSkill(ctx, name);

      if (!skill) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `Skill '${name}' not found`,
          statusCode: 404,
        });
      }

      return reply.send({ skill });
    } catch (error) {
      request.log.error(error, 'Failed to get skill');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to get skill',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /user/skills
   * スキル登録
   */
  fastify.post<{
    Body: SkillCreateRequest;
    Reply: SkillCreateResponse | ApiError;
  }>('/user/skills', async (request, reply) => {
    const { user } = request.ctx!;
    const { name, version, description, content } = request.body;

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

    // バリデーション: スキル名のフォーマットチェック
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return reply.status(400).send({
        error: 'BadRequest',
        message:
          'Invalid skill name format. Only alphanumeric, hyphens, and underscores are allowed.',
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
      const skill = await createSkill(ctx, { name, version, description, content }, authorName);

      return reply.status(201).send({
        success: true,
        message: 'Skill created successfully',
        skill,
      });
    } catch (error) {
      request.log.error(error, 'Failed to create skill');

      // 重複エラーの場合
      if ((error as Error).message?.includes('already exists')) {
        return reply.status(409).send({
          error: 'Conflict',
          message: `Skill '${name}' already exists`,
          statusCode: 409,
        });
      }

      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to create skill',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /user/skills/import
   * Gitリポジトリからインポート（複数パス対応）
   */
  fastify.post<{
    Body: SkillImportRequest;
    Reply: SkillImportResponse | ApiError;
  }>('/user/skills/import', async (request, reply) => {
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
      const importedSkills = await importSkillsFromGit(ctx, {
        repository_url,
        paths,
        branch: branch ?? 'main',
      });

      return reply.status(201).send({
        success: true,
        message: `Successfully imported ${importedSkills.length} skill(s)`,
        imported_skills: importedSkills,
      });
    } catch (error) {
      request.log.error(error, 'Failed to import skills from Git');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to import skills from Git repository',
        statusCode: 500,
      });
    }
  });

  /**
   * PUT /user/skills/:name
   * スキル更新
   */
  fastify.put<{
    Params: { name: string };
    Body: SkillUpdateRequest;
    Reply: SkillUpdateResponse | ApiError;
  }>('/user/skills/:name', async (request, reply) => {
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

    // バリデーション: スキル名のフォーマットチェック
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Invalid skill name format',
        statusCode: 400,
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
      const skill = await updateSkill(ctx, name, { raw_content });

      if (!skill) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `Skill '${name}' not found`,
          statusCode: 404,
        });
      }

      return reply.send({
        success: true,
        message: 'Skill updated successfully',
        skill,
      });
    } catch (error) {
      request.log.error(error, 'Failed to update skill');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to update skill',
        statusCode: 500,
      });
    }
  });

  /**
   * DELETE /user/skills/:name
   * スキル削除
   */
  fastify.delete<{
    Params: { name: string };
    Reply: SkillDeleteResponse | ApiError;
  }>('/user/skills/:name', async (request, reply) => {
    const { user } = request.ctx!;
    const { name } = request.params;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    // バリデーション: スキル名のフォーマットチェック
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Invalid skill name format',
        statusCode: 400,
      });
    }

    try {
      const ctx = createUserContext(fastify, request);
      const deleted = await deleteSkill(ctx, name);

      if (!deleted) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `Skill '${name}' not found`,
          statusCode: 404,
        });
      }

      return reply.send({
        success: true,
        message: 'Skill deleted successfully',
      });
    } catch (error) {
      request.log.error(error, 'Failed to delete skill');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to delete skill',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /user/skills/backup
   * スキルを Workspace にバックアップ
   */
  fastify.post<{
    Reply: SkillBackupResponse | ApiError;
  }>('/user/skills/backup', async (request, reply) => {
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
      const result = await backupSkillsToWorkspace(ctx);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to backup skills');

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
        message: 'Failed to backup skills to Workspace',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /user/skills/restore
   * Workspace からスキルをリストア
   */
  fastify.post<{
    Reply: SkillRestoreResponse | ApiError;
  }>('/user/skills/restore', async (request, reply) => {
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
      const result = await restoreSkillsFromWorkspace(ctx);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to restore skills');

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
        message: 'Failed to restore skills from Workspace',
        statusCode: 500,
      });
    }
  });
};

export default userSkillsRoute;
