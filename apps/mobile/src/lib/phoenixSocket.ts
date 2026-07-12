/**
 * phoenixSocket.ts
 *
 * Singleton Phoenix WebSocket client for React Native.
 * Manages the Socket + Channel lifecycle, token refresh,
 * and reconnection without requiring the phoenix npm package
 * (uses native WebSocket + Phoenix protocol).
 *
 * Architecture:
 *  - One Socket per app session (reconnects automatically).
 *  - Channels are joined on demand and left on cleanup.
 *  - Token comes from Supabase session (refreshed on reconnect).
 */

import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

type PhoenixMsg = {
  topic: string;
  event: string;
  payload: Record<string, any>;
  ref: string | null;
  join_ref?: string | null;
};

type EventHandler = (payload: any) => void;

// ─── Constants ───────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000;
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

// ─── Singleton state ─────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let isConnected = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let refCounter = 0;

// channel topic → { join_ref, handlers: Map<event, handler[]> }
const channelState = new Map<string, {
  join_ref: string;
  handlers: Map<string, EventHandler[]>;
  joined: boolean;
}>();

// pending pushes while socket is connecting
const pendingPushes: PhoenixMsg[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nextRef(): string {
  return String(++refCounter);
}

function getWsUrl(): string {
  const httpUrl =
    process.env.EXPO_PUBLIC_PHOENIX_API_URL || 'http://localhost:4000/api';
  // Replace http(s) with ws(s) and strip /api suffix
  return httpUrl.replace(/^http/, 'ws').replace(/\/api$/, '') + '/socket/websocket';
}

function sendRaw(msg: PhoenixMsg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    pendingPushes.push(msg);
  }
}

function flushPending() {
  while (pendingPushes.length > 0 && ws?.readyState === WebSocket.OPEN) {
    ws!.send(JSON.stringify(pendingPushes.shift()!));
  }
}

// ─── Channel API ─────────────────────────────────────────────────────────────

/**
 * Join a Phoenix channel by topic.
 * Returns a cleanup function that leaves the channel.
 */
export function joinChannel(
  topic: string,
  onEvent: (event: string, payload: any) => void
): () => void {
  if (!channelState.has(topic)) {
    const join_ref = nextRef();
    channelState.set(topic, {
      join_ref,
      handlers: new Map(),
      joined: false,
    });

    // Send join message
    sendRaw({
      topic,
      event: 'phx_join',
      payload: {},
      ref: join_ref,
      join_ref,
    });
  }

  // Register a wildcard handler that routes all events
  const ch = channelState.get(topic)!;
  const handler: EventHandler = (payload) => {
    // payload here is { event, payload } (our internal format)
    onEvent(payload.event, payload.payload);
  };
  const existing = ch.handlers.get('*') || [];
  ch.handlers.set('*', [...existing, handler]);

  return () => {
    // Remove this specific handler
    const ch = channelState.get(topic);
    if (!ch) return;
    const current = ch.handlers.get('*') || [];
    const updated = current.filter((h) => h !== handler);
    if (updated.length > 0) {
      ch.handlers.set('*', updated);
    } else {
      // No more listeners — leave the channel
      sendRaw({
        topic,
        event: 'phx_leave',
        payload: {},
        ref: nextRef(),
        join_ref: ch.join_ref,
      });
      channelState.delete(topic);
    }
  };
}

/**
 * Push an event to a Phoenix channel.
 * Returns a promise that resolves with the server reply or rejects on timeout.
 */
export function pushToChannel(
  topic: string,
  event: string,
  payload: Record<string, any>,
  timeoutMs = 10_000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const ref = nextRef();
    const ch = channelState.get(topic);

    const cleanup = () => clearTimeout(timer);
    const timer = setTimeout(() => {
      reject(new Error(`[Phoenix] push timeout: ${topic} ${event}`));
    }, timeoutMs);

    // Register a one-shot reply handler
    const replyEvent = `chan_reply_${ref}`;
    if (ch) {
      const replyHandler: EventHandler = (payload) => {
        if (payload.status === 'ok') {
          cleanup();
          resolve(payload.response);
        } else {
          cleanup();
          reject(new Error(payload.response?.reason || 'Channel error'));
        }
        // Remove handler after first call
        const handlers = ch.handlers.get(replyEvent) || [];
        ch.handlers.set(replyEvent, handlers.filter((h) => h !== replyHandler));
      };
      ch.handlers.set(replyEvent, [replyHandler]);
    }

    sendRaw({ topic, event, payload, ref, join_ref: ch?.join_ref ?? null });
  });
}

// ─── Socket lifecycle ─────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function connectPhoenixSocket() {
  if (isConnected || ws?.readyState === WebSocket.CONNECTING) return;

  const token = await getToken();
  if (!token) {
    if (__DEV__) console.log('[Phoenix] No auth token — socket not connected');
    return;
  }

  const url = `${getWsUrl()}?token=${encodeURIComponent(token)}`;
  if (__DEV__) console.log('[Phoenix] Connecting to', getWsUrl());

  ws = new WebSocket(url);

  ws.onopen = () => {
    if (__DEV__) console.log('[Phoenix] Socket connected');
    isConnected = true;
    reconnectAttempt = 0;

    // Start heartbeat
    heartbeatTimer = setInterval(() => {
      sendRaw({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: nextRef() });
    }, HEARTBEAT_INTERVAL_MS);

    // Re-join all tracked channels
    for (const [topic, ch] of channelState.entries()) {
      sendRaw({
        topic,
        event: 'phx_join',
        payload: {},
        ref: ch.join_ref,
        join_ref: ch.join_ref,
      });
    }

    flushPending();
  };

  ws.onmessage = (e) => {
    let msg: PhoenixMsg;
    try { msg = JSON.parse(e.data); } catch { return; }

    const { topic, event, payload, ref } = msg;

    if (event === 'phx_reply') {
      // Channel join/leave/push reply
      const ch = channelState.get(topic);
      if (!ch) return;

      // Route to reply handler
      const replyEvent = `chan_reply_${ref}`;
      const handlers = ch.handlers.get(replyEvent) || [];
      handlers.forEach((h) => h(payload));

      // Mark channel as joined on successful join reply
      if (payload?.status === 'ok' && !ch.joined) {
        ch.joined = true;
      }
      return;
    }

    if (event === 'phx_close' || event === 'phx_error') {
      channelState.get(topic) && (channelState.get(topic)!.joined = false);
      return;
    }

    // Route application events to wildcard handlers
    const ch = channelState.get(topic);
    if (!ch) return;
    const handlers = ch.handlers.get('*') || [];
    handlers.forEach((h) => h({ event, payload }));
  };

  ws.onerror = (e) => {
    if (__DEV__) console.error('[Phoenix] Socket error:', e);
  };

  ws.onclose = () => {
    if (__DEV__) console.log('[Phoenix] Socket closed, scheduling reconnect...');
    isConnected = false;
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    ws = null;

    // Mark all channels as not joined
    for (const ch of channelState.values()) ch.joined = false;

    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
  reconnectAttempt++;
  if (__DEV__) console.log(`[Phoenix] Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectPhoenixSocket();
  }, delay);
}

export function disconnectPhoenixSocket() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  ws?.close();
  ws = null;
  isConnected = false;
  channelState.clear();
  pendingPushes.length = 0;
}

export function isPhoenixConnected(): boolean {
  return isConnected;
}
