// apps/backend/src/routes/session.ts
import { FastifyPluginAsync } from 'fastify';
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
  ApiError,
} from '@repo/types';
import {
  createSession,
  listSessions,
  getSession,
  updateSession,
  archiveSession,
} from '../services/session.service.js';
import { listSessionEvents, getSessionLastEventId } from '../services/session-events.service.js';
import { wsManager } from '../services/websocket-manager.service.js';

const sessionRoute: FastifyPluginAsync = async fastify => {
  fastify.post<{
    Body: SessionCreateRequest;
    Reply: SessionCreateResponse | ApiError;
  }>('/sessions', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const { events } = request.body;

    if (!events || events.length === 0) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'At least one event is required',
        statusCode: 400,
      });
    }

    try {
      const result = await createSession(fastify, user.id, request.body);
      return reply.status(201).send(result);
    } catch (error) {
      request.log.error(error, 'Failed to create session');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to create session',
        statusCode: 500,
      });
    }
  });

  // GET /sessions - セッション一覧取得
  fastify.get<{
    Querystring: SessionListQuery;
    Reply: SessionListResponse | ApiError;
  }>('/sessions', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
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
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to get sessions',
        statusCode: 500,
      });
    }
  });

  // GET /sessions/:session_id - セッション詳細取得
  fastify.get<{
    Params: { session_id: string };
    Reply: SessionResponse | ApiError;
  }>('/sessions/:session_id', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const { session_id } = request.params;

    try {
      const session = await getSession(fastify, user.id, session_id);

      if (!session) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'Session not found',
          statusCode: 404,
        });
      }

      return reply.send(session);
    } catch (error) {
      request.log.error(error, 'Failed to get session');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to get session',
        statusCode: 500,
      });
    }
  });

  // PATCH /sessions/:session_id - セッション更新
  fastify.patch<{
    Params: { session_id: string };
    Body: SessionUpdateRequest;
    Reply: SessionResponse | ApiError;
  }>('/sessions/:session_id', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const { session_id } = request.params;
    const { title, session_status } = request.body;

    // リクエストボディのバリデーション
    if (title === undefined && session_status === undefined) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'At least one field (title or session_status) is required',
        statusCode: 400,
      });
    }

    try {
      const session = await updateSession(fastify, user.id, session_id, {
        title,
        session_status,
      });

      if (!session) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'Session not found',
          statusCode: 404,
        });
      }

      return reply.send(session);
    } catch (error) {
      request.log.error(error, 'Failed to update session');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to update session',
        statusCode: 500,
      });
    }
  });

  // POST /sessions/:session_id/archive - セッションアーカイブ
  fastify.post<{
    Params: { session_id: string };
    Reply: SessionArchiveResponse | ApiError;
  }>('/sessions/:session_id/archive', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const { session_id } = request.params;

    try {
      const session = await archiveSession(fastify, user.id, session_id);

      if (!session) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'Session not found',
          statusCode: 404,
        });
      }

      return reply.send(session);
    } catch (error) {
      request.log.error(error, 'Failed to archive session');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to archive session',
        statusCode: 500,
      });
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
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const { session_id } = request.params;
    const { after, limit } = request.query;

    try {
      const result = await listSessionEvents(fastify, user.id, session_id, {
        after: after ?? undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return reply.send(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Session not found') {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'Session not found',
          statusCode: 404,
        });
      }
      request.log.error(error, 'Failed to get session events');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to get session events',
        statusCode: 500,
      });
    }
  });

  // WebSocket /sessions/:session_id/subscribe - リアルタイムイベント配信
  fastify.get<{
    Params: { session_id: string };
  }>('/sessions/:session_id/subscribe', { websocket: true }, async (socket, request) => {
    const { user } = request.ctx!;
    const { session_id } = request.params;

    if (!user.id) {
      const errorMsg: WsErrorMessage = {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'User ID not found',
      };
      socket.send(JSON.stringify(errorMsg));
      socket.close(4001, 'Unauthorized');
      return;
    }

    try {
      // 最新イベント ID を取得して接続成功メッセージを送信
      const lastEventId = await getSessionLastEventId(fastify, user.id, session_id);

      // 接続を管理に追加
      wsManager.addConnection(session_id, user.id, socket);

      const connectedMsg: WsConnectedMessage = {
        type: 'connected',
        session_id,
        last_event_id: lastEventId,
      };
      socket.send(JSON.stringify(connectedMsg));

      request.log.info({ sessionId: session_id, userId: user.id }, 'WebSocket connected');

      // クライアントからのメッセージ処理（ping/pong）
      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }));
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
        const errorMsg: WsErrorMessage = {
          type: 'error',
          code: 'NOT_FOUND',
          message: 'Session not found',
        };
        socket.send(JSON.stringify(errorMsg));
        socket.close(4004, 'Session not found');
        return;
      }

      const errorMsg: WsErrorMessage = {
        type: 'error',
        code: 'CONNECTION_ERROR',
        message: 'Failed to establish connection',
      };
      socket.send(JSON.stringify(errorMsg));
      socket.close(4000, 'Connection error');
    }
  });
};

export default sessionRoute;
