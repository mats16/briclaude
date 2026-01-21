/**
 * Polling and timing constants
 */

/** Databricks App status polling interval (ms) */
export const APP_STATUS_POLLING_INTERVAL_MS = 5_000;

/** WebSocket keep_alive interval (ms) */
export const WEBSOCKET_KEEP_ALIVE_INTERVAL_MS = 50_000;

/** WebSocket reconnection base delay (ms) - used for exponential backoff */
export const WEBSOCKET_RECONNECT_BASE_DELAY_MS = 1_000;

/** WebSocket reconnection max delay (ms) - caps exponential backoff */
export const WEBSOCKET_RECONNECT_MAX_DELAY_MS = 30_000;
