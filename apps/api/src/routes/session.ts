// apps/api/src/routes/session.ts
import type { FastifyPluginAsync, FastifyReply, FastifyBaseLogger } from 'fastify';
import type { WebSocket } from 'ws';
import type {
  SessionCreateRequest,
  SessionCreateResponse,
  SessionEventsResponse,
  SessionEventsQuery,
  SessionListQuery,
  SessionListResponse,
  SessionResponse,
  SessionArchiveResponse,
  SessionUpdateRequest,
  WsConnectedMessage,
  WsErrorMessage,
  WsControlRequest,
  WsControlResponse,
  SDKAuthStatusMessage,
  ApiError,
} from '@repo/types';
import { isAuthError } from '@repo/types';
import {
  createSession,
  listSessions,
  getSession,
  updateSession,
  archiveSession,
  sendMessageToSession,
  canAbortSession,
  executeAbort,
} from '../services/session.service.js';
import { listSessionEvents, getSessionLastEventId } from '../services/session-events.service.js';
import { wsManager } from '../services/websocket-manager.service.js';
import { SessionId } from '../models/session.model.js';
import { createUserContext } from '../lib/user-context.js';

/**
 * エラーレスポンスを生成するヘルパー
 */
function sendError(
  reply: FastifyReply,
  statusCode: 400 | 401 | 404 | 500,
  error: string,
  message: string
): ReturnType<FastifyReply['send']> {
  return reply.status(statusCode).send({ error, message, statusCode });
}

/**
 * WebSocket エラーメッセージを生成して送信し、接続を閉じる
 */
function closeWebSocketWithError(
  socket: WebSocket,
  code: WsErrorMessage['code'],
  message: string,
  closeCode: number
): void {
  const errorMsg: WsErrorMessage = { type: 'error', code, message };
  socket.send(JSON.stringify(errorMsg));
  socket.close(closeCode, message);
}

/**
 * セッションIDをパースするヘルパー
 * 無効な TypeID 形式の場合は null を返す
 */
function parseSessionId(sessionIdStr: string, logger?: FastifyBaseLogger): SessionId | null {
  try {
    return SessionId.fromString(sessionIdStr);
  } catch (error) {
    logger?.debug({ sessionIdStr, error }, 'Invalid session ID format');
    return null;
  }
}

const sessionRoute: FastifyPluginAsync = async fastify => {
  fastify.post<{
    Body: SessionCreateRequest;
    Reply: SessionCreateResponse | ApiError;
  }>('/sessions', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return sendError(reply, 401, 'Unauthorized', 'User ID not found in request context');
    }

    const { events } = request.body;

    if (!events || events.length === 0) {
      return sendError(reply, 400, 'BadRequest', 'At least one event is required');
    }

    try {
      const ctx = createUserContext(fastify, request);
      const result = await createSession(fastify, user.id, request.body, ctx);
      return reply.status(201).send(result);
    } catch (error) {
      request.log.error(error, 'Failed to create session');
      return sendError(reply, 500, 'InternalServerError', 'Failed to create session');
    }
  });

  // GET /sessions - セッション一覧取得
  fastify.get<{
    Querystring: SessionListQuery;
    Reply: SessionListResponse | ApiError;
  }>('/sessions', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return sendError(reply, 401, 'Unauthorized', 'User ID not found in request context');
    }

    const { limit, status } = request.query;

    try {
      const result = await listSessions(fastify, user.id, {
        limit: limit ? Number(limit) : undefined,
        status: status ?? undefined,
      });
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to list sessions');
      return sendError(reply, 500, 'InternalServerError', 'Failed to get sessions');
    }
  });

  // GET /sessions/:session_id - セッション詳細取得
  fastify.get<{
    Params: { session_id: string };
    Reply: SessionResponse | ApiError;
  }>('/sessions/:session_id', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return sendError(reply, 401, 'Unauthorized', 'User ID not found in request context');
    }

    const { session_id } = request.params;
    const sessionId = parseSessionId(session_id, request.log);

    if (!sessionId) {
      return sendError(reply, 404, 'NotFound', 'Session not found');
    }

    try {
      const session = await getSession(fastify, user.id, sessionId);

      if (!session) {
        return sendError(reply, 404, 'NotFound', 'Session not found');
      }

      return reply.send(session);
    } catch (error) {
      request.log.error(error, 'Failed to get session');
      return sendError(reply, 500, 'InternalServerError', 'Failed to get session');
    }
  });

  // PATCH /sessions/:session_id - セッション更新（タイトルのみ）
  // ステータス変更は POST /sessions/:session_id/archive を使用
  fastify.patch<{
    Params: { session_id: string };
    Body: SessionUpdateRequest;
    Reply: SessionResponse | ApiError;
  }>('/sessions/:session_id', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return sendError(reply, 401, 'Unauthorized', 'User ID not found in request context');
    }

    const { session_id } = request.params;
    const sessionId = parseSessionId(session_id, request.log);
    const { title } = request.body;

    if (!sessionId) {
      return sendError(reply, 404, 'NotFound', 'Session not found');
    }

    // 1. 必須フィールドのチェック
    if (title === undefined) {
      return sendError(reply, 400, 'BadRequest', 'title is required');
    }

    // 2. 無効なフィールドのチェック
    const allowedFields = ['title'];
    const receivedFields = Object.keys(request.body);
    const invalidFields = receivedFields.filter(f => !allowedFields.includes(f));

    if (invalidFields.length > 0) {
      return sendError(
        reply,
        400,
        'BadRequest',
        `Invalid fields: ${invalidFields.join(', ')}. Only 'title' can be updated.`
      );
    }

    try {
      const session = await updateSession(fastify, user.id, sessionId, { title });

      if (!session) {
        return sendError(reply, 404, 'NotFound', 'Session not found');
      }

      return reply.send(session);
    } catch (error) {
      request.log.error(error, 'Failed to update session');
      return sendError(reply, 500, 'InternalServerError', 'Failed to update session');
    }
  });

  // POST /sessions/:session_id/archive - セッションアーカイブ
  fastify.post<{
    Params: { session_id: string };
    Reply: SessionArchiveResponse | ApiError;
  }>('/sessions/:session_id/archive', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return sendError(reply, 401, 'Unauthorized', 'User ID not found in request context');
    }

    const { session_id } = request.params;
    const sessionId = parseSessionId(session_id, request.log);

    if (!sessionId) {
      return sendError(reply, 404, 'NotFound', 'Session not found');
    }

    try {
      const ctx = createUserContext(fastify, request);
      const session = await archiveSession(fastify, user.id, sessionId, ctx);

      if (!session) {
        return sendError(reply, 404, 'NotFound', 'Session not found');
      }

      return reply.send(session);
    } catch (error) {
      request.log.error(error, 'Failed to archive session');
      return sendError(reply, 500, 'InternalServerError', 'Failed to archive session');
    }
  });

  // GET /sessions/:session_id/events - 過去イベント取得
  fastify.get<{
    Params: { session_id: string };
    Querystring: SessionEventsQuery;
    Reply: SessionEventsResponse | ApiError;
  }>('/sessions/:session_id/events', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return sendError(reply, 401, 'Unauthorized', 'User ID not found in request context');
    }

    const { session_id } = request.params;
    const sessionId = parseSessionId(session_id, request.log);

    if (!sessionId) {
      return sendError(reply, 404, 'NotFound', 'Session not found');
    }

    const { after, limit } = request.query;

    try {
      const result = await listSessionEvents(fastify, user.id, sessionId, {
        after: after ?? undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Session not found') {
        return sendError(reply, 404, 'NotFound', 'Session not found');
      }
      request.log.error(error, 'Failed to get session events');
      return sendError(reply, 500, 'InternalServerError', 'Failed to get session events');
    }
  });

  // WebSocket /sessions/:session_id/subscribe - リアルタイムイベント配信
  fastify.get<{
    Params: { session_id: string };
  }>('/sessions/:session_id/subscribe', { websocket: true }, async (socket, request) => {
    const { user } = request.ctx!;
    const { session_id } = request.params;
    const sessionId = parseSessionId(session_id, request.log);

    if (!sessionId) {
      closeWebSocketWithError(socket, 'NOT_FOUND', 'Session not found', 4004);
      return;
    }

    if (!user.id) {
      closeWebSocketWithError(socket, 'UNAUTHORIZED', 'User ID not found', 4001);
      return;
    }

    // WebSocket接続時に UserContext を生成して保持
    // （message イベントハンドラ内でも使用するため）
    const ctx = createUserContext(fastify, request);

    try {
      // 最新イベント ID を取得して接続成功メッセージを送信
      const lastEventId = await getSessionLastEventId(fastify, user.id, sessionId);

      // 接続を管理に追加
      wsManager.addConnection(session_id, user.id, socket);

      const connectedMsg: WsConnectedMessage = {
        type: 'connected',
        session_id,
        last_event_id: lastEventId,
      };
      socket.send(JSON.stringify(connectedMsg));

      request.log.info({ sessionId: session_id, userId: user.id }, 'WebSocket connected');

      // クライアントからのメッセージ処理（keep_alive, user message, control_request）
      socket.on('message', async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'keep_alive') {
            // keep_alive メッセージは接続維持のため受信のみ（レスポンス不要）
          } else if (msg.type === 'user') {
            // SDKUserMessage を受信 → セッションにメッセージ送信
            try {
              await sendMessageToSession(fastify, user.id, sessionId, msg, ctx);
            } catch (error) {
              // サーバーサイドエラー（トークン取得失敗など）を SDKAuthStatusMessage として送信
              // SDK のエラーは SDK 内で SDKMessage として処理されるため、ここでは catch されない
              request.log.error(error, 'Failed to send message to session');

              const errorCode = (error as Error & { code?: string }).code;
              const authStatusMsg: SDKAuthStatusMessage = {
                type: 'auth_status',
                uuid: crypto.randomUUID(),
                session_id: sessionId.toString(),
                isAuthenticating: false,
                output: [],
                error: isAuthError(errorCode)
                  ? 'Invalid API key · Please run /login'
                  : error instanceof Error
                    ? error.message
                    : 'Unknown error',
              };
              socket.send(JSON.stringify(authStatusMsg));
            }
          } else if (msg.type === 'control_request') {
            // control_request を受信 → abort 処理
            const controlRequest = msg as WsControlRequest;

            if (controlRequest.request.subtype === 'abort') {
              // 1. まず control_response を返す
              if (canAbortSession(sessionId)) {
                const response: WsControlResponse = {
                  type: 'control_response',
                  response: {
                    subtype: 'success',
                    request_id: controlRequest.request_id,
                  },
                };
                socket.send(JSON.stringify(response));

                // 2. abort 処理を非同期で実行（await しない）
                executeAbort(fastify, user.id, sessionId).catch(err => {
                  request.log.error(err, 'Failed to execute abort');
                  // エラー発生時にクライアントに通知
                  const errorMsg: WsErrorMessage = {
                    type: 'error',
                    code: 'ABORT_FAILED',
                    message: err instanceof Error ? err.message : 'Failed to abort session',
                  };
                  socket.send(JSON.stringify(errorMsg));
                });
              } else {
                // abort 不可能な場合はエラーを返す
                const response: WsControlResponse = {
                  type: 'control_response',
                  response: {
                    subtype: 'error',
                    request_id: controlRequest.request_id,
                    error: 'No active query for this session',
                  },
                };
                socket.send(JSON.stringify(response));
              }
            }
          }
        } catch {
          // JSON パースエラーは無視
        }
      });

      socket.on('close', () => {
        request.log.info({ sessionId: session_id, userId: user.id }, 'WebSocket disconnected');
      });
    } catch (error) {
      request.log.error(error, 'WebSocket connection error');

      if (error instanceof Error && error.message === 'Session not found') {
        closeWebSocketWithError(socket, 'NOT_FOUND', 'Session not found', 4004);
        return;
      }

      closeWebSocketWithError(socket, 'CONNECTION_ERROR', 'Failed to establish connection', 4000);
    }
  });
};

export default sessionRoute;
