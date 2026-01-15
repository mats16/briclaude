/**
 * Polling and timing constants
 */

/** Databricks App status polling interval (ms) */
export const APP_STATUS_POLLING_INTERVAL_MS = 5_000;

/** WebSocket ping/pong keepalive interval (ms) */
export const WEBSOCKET_PING_INTERVAL_MS = 30_000;

/** WebSocket reconnection base delay (ms) - used for exponential backoff */
export const WEBSOCKET_RECONNECT_BASE_DELAY_MS = 1_000;

/** WebSocket reconnection max delay (ms) - caps exponential backoff */
export const WEBSOCKET_RECONNECT_MAX_DELAY_MS = 30_000;
