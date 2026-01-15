import type { FastifyPluginAsync } from 'fastify';
import { createUserContext } from '../lib/user-context.js';
import { SessionId } from '../models/session.model.js';
import { getSession } from '../services/session.service.js';

/**
 * session_id (TypeID) の suffix から app_name を生成
 * 例: session_01h455vb4pex5vsknk084sn02q -> app-01h455vb4pex5vsknk084sn02q
 */
function generateAppName(sessionId: SessionId): string {
  return `app-${sessionId.getSuffix()}`;
}

const sessionAppRoute: FastifyPluginAsync = async fastify => {
  const databricksHost = fastify.config.DATABRICKS_HOST;

  /**
   * GET /sessions/:session_id/app
   * セッションに関連付けられた Databricks App を取得
   */
  fastify.get<{
    Params: { session_id: string };
  }>('/sessions/:session_id/app', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const { session_id } = request.params;

    // 1. SessionId をパース
    let sessionId: SessionId;
    try {
      sessionId = SessionId.fromString(session_id);
    } catch {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Session not found',
        statusCode: 404,
      });
    }

    // 2. セッションの存在確認とアクセス権チェック
    const session = await getSession(fastify, user.id, sessionId);
    if (!session) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Session not found',
        statusCode: 404,
      });
    }

    // 3. outcomes に databricks_apps があるかチェック
    const hasAppsOutcome = session.session_context?.outcomes?.some(
      o => o.type === 'databricks_apps'
    );
    if (!hasAppsOutcome) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'This session does not have Databricks Apps outcome configured',
        statusCode: 404,
      });
    }

    // 4. SP トークンを取得
    const ctx = createUserContext(fastify, request);
    const accessToken = await ctx.getSpAccessToken();

    if (!accessToken) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Service Principal token is not available',
        statusCode: 401,
      });
    }

    // 5. app_name を生成して Databricks Apps API にプロキシ
    const appName = generateAppName(sessionId);
    const url = new URL(`/api/2.0/apps/${appName}`, `https://${databricksHost}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();
    return reply.status(response.status).send(data);
  });
};

export default sessionAppRoute;
