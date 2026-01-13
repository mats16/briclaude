import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';

/**
 * WebSocket プラグイン
 * @fastify/websocket を登録
 */
export default fp(
  async fastify => {
    await fastify.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB
        clientTracking: true,
      },
    });
    fastify.log.info('WebSocket plugin registered');
  },
  {
    name: 'websocket',
  }
);
