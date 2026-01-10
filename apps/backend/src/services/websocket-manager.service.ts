import type { WebSocket } from 'ws';
import type { SDKMessage, WsServerMessage } from '@repo/types';

interface SessionConnection {
  ws: WebSocket;
  userId: string;
  sessionId: string;
}

/**
 * WebSocket 接続管理
 * セッション ID ごとに接続を管理
 */
class WebSocketManager {
  // sessionId -> Set<connection>
  private connections = new Map<string, Set<SessionConnection>>();

  /**
   * 接続を追加
   */
  addConnection(sessionId: string, userId: string, ws: WebSocket): void {
    const conn: SessionConnection = { ws, userId, sessionId };

    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }
    this.connections.get(sessionId)!.add(conn);

    // 切断時にクリーンアップ
    ws.on('close', () => {
      this.removeConnection(sessionId, conn);
    });
  }

  /**
   * 接続を削除
   */
  private removeConnection(sessionId: string, conn: SessionConnection): void {
    const conns = this.connections.get(sessionId);
    if (conns) {
      conns.delete(conn);
      if (conns.size === 0) {
        this.connections.delete(sessionId);
      }
    }
  }

  /**
   * セッションの全接続にメッセージを送信
   */
  broadcast(sessionId: string, message: WsServerMessage | SDKMessage): void {
    const conns = this.connections.get(sessionId);
    if (!conns) return;

    const payload = JSON.stringify(message);
    for (const conn of conns) {
      if (conn.ws.readyState === conn.ws.OPEN) {
        conn.ws.send(payload);
      }
    }
  }

  /**
   * 接続数を取得
   */
  getConnectionCount(sessionId: string): number {
    return this.connections.get(sessionId)?.size ?? 0;
  }
}

// シングルトンインスタンス
export const wsManager = new WebSocketManager();
