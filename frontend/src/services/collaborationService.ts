import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';

/**
 * Browser side of the Yjs relay protocol (see backend YjsProtocol.java).
 *
 *  client → server   0 UPDATE [0][update]   1 AWARENESS [1][update]   2 SNAPSHOT [2][u32 ack][state]
 *  server → client   3 BASE   [3][state]    0 UPDATE    [0][update]   1 AWARENESS [1][update]
 *
 * `ack` = number of BASE/UPDATE frames applied when the snapshot was encoded; the
 * server uses it to compact its log without ever dropping an edit.
 */
export const MSG_UPDATE = 0;
export const MSG_AWARENESS = 1;
export const MSG_SNAPSHOT = 2;
export const MSG_BASE = 3;

export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_FORBIDDEN = 4403;
export const CLOSE_NOT_FOUND = 4404;

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found';

export type TokenGetter = (options?: { fresh?: boolean }) => Promise<string | null>;

export interface ProviderOptions {
  url: string;
  roomCode: string;
  doc: Y.Doc;
  awareness: Awareness;
  getToken: TokenGetter;
  userName?: string;
  userImageUrl?: string;
  /** How often a changed document is sent as a snapshot. */
  snapshotIntervalMs?: number;
  /** Override for tests (Node has a global WebSocket since v22). */
  WebSocketImpl?: typeof WebSocket;
}

const MAX_AUTH_RETRIES = 4;
const MAX_RECONNECT_DELAY_MS = 30_000;

function frame(type: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(payload.length + 1);
  out[0] = type;
  out.set(payload, 1);
  return out;
}

export class CollaborationProvider {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'connecting';
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private authFailures = 0;
  /** BASE + UPDATE frames applied on the current connection (the snapshot ack). */
  private received = 0;
  /** Set when the doc changed (locally or remotely) since the last snapshot. */
  private dirty = false;
  private synced = false;
  private readonly listeners = new Set<(status: ConnectionStatus) => void>();
  private readonly syncListeners = new Set<() => void>();
  private readonly opts: Required<Omit<ProviderOptions, 'WebSocketImpl' | 'userName' | 'userImageUrl'>> &
    Pick<ProviderOptions, 'WebSocketImpl' | 'userName' | 'userImageUrl'>;

  constructor(options: ProviderOptions) {
    this.opts = { snapshotIntervalMs: 20_000, ...options };
    this.opts.doc.on('update', this.handleDocUpdate);
    this.opts.awareness.on('update', this.handleAwarenessUpdate);
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.handlePageHide);
    void this.connect();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** True once the first BASE frame of the current connection has been applied. */
  isSynced(): boolean {
    return this.synced;
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onSynced(listener: () => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  /**
   * Re-sends this client's full state. Used after read-only mode is lifted: any
   * keystroke the server rejected while read-only would otherwise leave a gap in
   * this client's update history and block its later edits on other peers.
   */
  pushFullState(): void {
    if (this.opts.doc.store.clients.size === 0) return;
    this.send(frame(MSG_UPDATE, Y.encodeStateAsUpdate(this.opts.doc)));
  }

  /** Sends the full document so the server can compact its log and persist. */
  sendSnapshot(force = false): void {
    if ((!this.dirty && !force) || this.received === 0) return;
    const state = Y.encodeStateAsUpdate(this.opts.doc);
    const out = new Uint8Array(state.length + 5);
    out[0] = MSG_SNAPSHOT;
    new DataView(out.buffer).setUint32(1, this.received >>> 0, false);
    out.set(state, 5);
    if (this.send(out)) this.dirty = false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.sendSnapshot();
    // Tell peers our cursor is gone before closing.
    this.opts.awareness.setLocalState(null);
    this.destroyed = true;
    this.opts.doc.off('update', this.handleDocUpdate);
    this.opts.awareness.off('update', this.handleAwarenessUpdate);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.handlePageHide);
    this.stopSnapshotTimer();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'Client leaving');
      this.ws = null;
    }
    this.listeners.clear();
    this.syncListeners.clear();
  }

  // ── Connection ──────────────────────────────────────────────────────────

  private async connect(): Promise<void> {
    if (this.destroyed) return;
    this.setStatus('connecting');

    let token: string | null = null;
    try {
      // After an auth failure always ask Clerk for a brand-new token (the cached
      // one may have expired while e.g. Render was cold-starting).
      token = await this.opts.getToken({ fresh: this.authFailures > 0 });
    } catch (err) {
      console.warn('[Yjs] Could not get a session token', err);
    }
    if (this.destroyed) return;
    if (!token) {
      this.setStatus('unauthorized');
      return;
    }

    const params = new URLSearchParams({ token });
    if (this.opts.userName) params.set('name', this.opts.userName);
    if (this.opts.userImageUrl) params.set('imageUrl', this.opts.userImageUrl);

    const WS = this.opts.WebSocketImpl ?? WebSocket;
    let ws: WebSocket;
    try {
      ws = new WS(`${this.opts.url}/${this.opts.roomCode}?${params.toString()}`);
    } catch (err) {
      console.error('[Yjs] Failed to create WebSocket', err);
      this.scheduleReconnect();
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.received = 0;
    this.synced = false;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      // Offline edits / server restart: give the server everything we have.
      this.pushFullState();
      this.sendAwareness([this.opts.doc.clientID]);
      this.startSnapshotTimer();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws || !(event.data instanceof ArrayBuffer)) return;
      this.handleMessage(new Uint8Array(event.data));
    };

    ws.onclose = (event: CloseEvent) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.synced = false;
      this.stopSnapshotTimer();
      this.dropRemoteAwareness();
      if (this.destroyed) return;

      switch (event.code) {
        case CLOSE_UNAUTHORIZED:
          this.authFailures++;
          if (this.authFailures > MAX_AUTH_RETRIES) {
            this.setStatus('unauthorized');
            return;
          }
          break;
        case CLOSE_FORBIDDEN:
          this.setStatus('forbidden');
          return;
        case CLOSE_NOT_FOUND:
          this.setStatus('not-found');
          return;
      }
      this.setStatus('disconnected');
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose follows and handles reconnection.
    };
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  // ── Messages ────────────────────────────────────────────────────────────

  private handleMessage(data: Uint8Array): void {
    if (data.length === 0) return;
    const payload = data.subarray(1);
    switch (data[0]) {
      case MSG_BASE:
        this.received++;
        if (payload.length > 0) Y.applyUpdate(this.opts.doc, payload, this);
        this.authFailures = 0;
        if (!this.synced) {
          this.synced = true;
          this.syncListeners.forEach((l) => l());
        }
        break;
      case MSG_UPDATE:
        this.received++;
        Y.applyUpdate(this.opts.doc, payload, this);
        break;
      case MSG_AWARENESS:
        applyAwarenessUpdate(this.opts.awareness, payload, this);
        break;
      default:
        console.warn(`[Yjs] Unknown message type ${data[0]}`);
    }
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    this.dirty = true;
    if (origin === this) return; // came from the server — don't echo it back
    this.send(frame(MSG_UPDATE, update));
  };

  private handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    if (origin === this) return;
    this.sendAwareness([...added, ...updated, ...removed]);
  };

  private sendAwareness(clients: number[]): void {
    if (clients.length === 0) return;
    this.send(frame(MSG_AWARENESS, encodeAwarenessUpdate(this.opts.awareness, clients)));
  }

  private dropRemoteAwareness(): void {
    const remote = [...this.opts.awareness.getStates().keys()].filter((c) => c !== this.opts.doc.clientID);
    if (remote.length) removeAwarenessStates(this.opts.awareness, remote, this);
  }

  private send(data: Uint8Array): boolean {
    if (this.ws?.readyState !== 1 /* OPEN */) return false;
    this.ws.send(data as Uint8Array<ArrayBuffer>);
    return true;
  }

  private handlePageHide = (): void => {
    this.sendSnapshot();
  };

  private startSnapshotTimer(): void {
    this.stopSnapshotTimer();
    this.snapshotTimer = setInterval(() => this.sendSnapshot(), this.opts.snapshotIntervalMs);
  }

  private stopSnapshotTimer(): void {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.snapshotTimer = null;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.listeners.forEach((l) => l(status));
  }
}
