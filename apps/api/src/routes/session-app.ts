import type { FastifyPluginAsync } from 'fastify';
import { SessionId } from '../models/session.model.js';
import { getSession } from '../services/session.service.js';
import { DatabricksAppsClient } from '../lib/databricks-apps-client.js';
import { getAuthProvider } from '../lib/databricks-auth.js';

/**
 * session_id (TypeID) の suffix から app_name を生成
 * 例: session_01h455vb4pex5vsknk084sn02q -> app-01h455vb4pex5vsknk084sn02q
 */
function generateAppName(sessionId: SessionId): string {
  return `app-${sessionId.getSuffix()}`;
}

const sessionAppRoute: FastifyPluginAsync = async fastify => {
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

    // 4. AuthProvider を取得してクライアントを作成（PAT 優先）
    const authProvider = await getAuthProvider(fastify, user.id);
    const appsClient = new DatabricksAppsClient(authProvider);

    // 5. app_name を生成して Databricks Apps API を呼び出し
    const appName = generateAppName(sessionId);

    try {
      const app = await appsClient.get(appName);
      return reply.send(app);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // API エラーからステータスコードを抽出
      const statusMatch = message.match(/\((\d+)\)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 500;
      return reply.status(statusCode).send({
        error: statusCode === 404 ? 'NotFound' : 'InternalServerError',
        message,
        statusCode,
      });
    }
  });
};

export default sessionAppRoute;
