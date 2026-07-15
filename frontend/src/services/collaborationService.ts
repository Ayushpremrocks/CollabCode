import * as Y from 'yjs';

const WS_BASE_URL = 'ws://localhost:8080/ws/yjs';

// Message types matching the backend protocol
const MSG_TYPE_SYNC = 0;
const MSG_TYPE_AWARENESS = 1;
const MSG_TYPE_SNAPSHOT_SAVE = 2;
const MSG_TYPE_SNAPSHOT_LOAD = 3;

export class CollaborationProvider {
  private ws: WebSocket | null = null;
  private doc: Y.Doc;
  private roomCode: string;
  private connected = false;
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  private tokenGetter: () => Promise<string | null>;
  private userName: string;
  private userImageUrl: string;

  constructor(
    roomCode: string,
    doc: Y.Doc,
    tokenGetter: () => Promise<string | null>,
    userName: string = '',
    userImageUrl: string = ''
  ) {
    this.roomCode = roomCode;
    this.doc = doc;
    this.tokenGetter = tokenGetter;
    this.userName = userName;
    this.userImageUrl = userImageUrl;

    // Listen for local document updates and broadcast
    this.doc.on('update', this.handleDocUpdate);

    this.connect();
  }

  private async connect() {
    if (this.destroyed) return;

    const token = await this.tokenGetter();
    if (!token) {
      console.error('No Clerk session token available for WebSocket connection');
      return;
    }

    let url = `${WS_BASE_URL}/${this.roomCode}?token=${encodeURIComponent(token)}`;
    if (this.userName) url += `&name=${encodeURIComponent(this.userName)}`;
    if (this.userImageUrl) url += `&imageUrl=${encodeURIComponent(this.userImageUrl)}`;

    try {
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log(`[Yjs] Connected to room: ${this.roomCode}`);
        this.connected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionListeners(true);
        this.startSnapshotInterval();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          this.handleMessage(new Uint8Array(event.data));
        }
      };

      this.ws.onclose = (event) => {
        console.log(`[Yjs] Disconnected from room: ${this.roomCode} (code: ${event.code})`);
        this.connected = false;
        this.notifyConnectionListeners(false);
        this.stopSnapshotInterval();

        if (!this.destroyed && event.code !== 1008) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Yjs] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[Yjs] Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: Uint8Array) {
    if (data.length === 0) return;

    const messageType = data[0];
    const payload = data.slice(1);

    switch (messageType) {
      case MSG_TYPE_SYNC:
        // Apply remote Yjs update
        Y.applyUpdate(this.doc, payload, 'remote');
        break;

      case MSG_TYPE_AWARENESS:
        // Awareness updates are handled separately if needed
        break;

      case MSG_TYPE_SNAPSHOT_LOAD:
        // Server sent a full document snapshot — apply it
        console.log(`[Yjs] Received snapshot (${payload.length} bytes)`);
        Y.applyUpdate(this.doc, payload, 'snapshot');
        break;

      default:
        console.warn(`[Yjs] Unknown message type: ${messageType}`);
    }
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    // Don't re-broadcast updates that came from remote or snapshot
    if (origin === 'remote' || origin === 'snapshot') return;

    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      // Prefix with message type 0 (sync update)
      const message = new Uint8Array(update.length + 1);
      message[0] = MSG_TYPE_SYNC;
      message.set(update, 1);
      this.ws.send(message);
    }
  };

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Yjs] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    console.log(`[Yjs] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startSnapshotInterval() {
    this.stopSnapshotInterval();
    // Send a snapshot every 30 seconds for persistence
    this.snapshotInterval = setInterval(() => {
      this.sendSnapshot();
    }, 30000);
  }

  private stopSnapshotInterval() {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  sendSnapshot() {
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) return;

    const state = Y.encodeStateAsUpdate(this.doc);
    const message = new Uint8Array(state.length + 1);
    message[0] = MSG_TYPE_SNAPSHOT_SAVE;
    message.set(state, 1);
    this.ws.send(message);
    console.log(`[Yjs] Sent snapshot (${state.length} bytes)`);
  }

  onConnectionChange(listener: (connected: boolean) => void) {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach((listener) => listener(connected));
  }

  isConnected(): boolean {
    return this.connected;
  }

  destroy() {
    this.destroyed = true;
    this.doc.off('update', this.handleDocUpdate);

    // Send final snapshot before disconnecting
    this.sendSnapshot();

    this.stopSnapshotInterval();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client leaving');
      this.ws = null;
    }

    this.connectionListeners.clear();
    this.connected = false;
  }
}
