import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import {
  CollaborationProvider,
  type ConnectionStatus,
  type TokenGetter,
} from '../services/collaborationService';
import { AUTHORS_MAP, type AuthorInfo } from './authorship';

export interface CollabIdentity {
  username: string;
  name: string;
  color: string;
  imageUrl?: string;
}

export interface CollabSnapshot {
  status: ConnectionStatus;
  synced: boolean;
  awareness: Awareness | null;
}

const WS_BASE_URL = `${import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8080'}/ws/yjs`;

/**
 * One collaborative editing session for a room: the Y.Doc, cursor awareness and
 * the network provider. Designed for useSyncExternalStore — start()/stop() are
 * idempotent so React StrictMode's mount → unmount → mount cycle is safe, and the
 * document itself survives the restart.
 */
export class CollabSession {
  readonly doc = new Y.Doc();
  readonly text: Y.Text = this.doc.getText('monaco');
  readonly authors: Y.Map<AuthorInfo> = this.doc.getMap<AuthorInfo>(AUTHORS_MAP);

  private provider: CollaborationProvider | null = null;
  private awareness: Awareness | null = null;
  private identity: CollabIdentity | null = null;
  private canEdit = true;
  private snapshot: CollabSnapshot = { status: 'connecting', synced: false, awareness: null };
  private readonly listeners = new Set<() => void>();
  private readonly cleanups: (() => void)[] = [];

  readonly roomCode: string;

  constructor(roomCode: string) {
    this.roomCode = roomCode;
  }

  start(getToken: TokenGetter, identity: CollabIdentity): void {
    if (this.provider) return;
    this.identity = identity;
    const awareness = new Awareness(this.doc);
    awareness.setLocalStateField('user', {
      name: identity.name,
      username: identity.username,
      color: identity.color,
    });
    this.awareness = awareness;

    const provider = new CollaborationProvider({
      url: WS_BASE_URL,
      roomCode: this.roomCode,
      doc: this.doc,
      awareness,
      getToken,
      userName: identity.name,
      userImageUrl: identity.imageUrl,
    });
    this.provider = provider;

    this.cleanups.push(
      provider.onStatusChange(() => this.update()),
      provider.onSynced(() => this.update()),
    );
    this.doc.on('afterTransaction', this.registerAuthorOnFirstEdit);
    this.cleanups.push(() => this.doc.off('afterTransaction', this.registerAuthorOnFirstEdit));
    this.update();
  }

  stop(): void {
    this.cleanups.splice(0).forEach((fn) => fn());
    this.provider?.destroy();
    this.awareness?.destroy();
    this.provider = null;
    this.awareness = null;
    this.update();
  }

  /** Mirrors the room's read-only state; when editing is re-enabled, resync any rejected edit. */
  setCanEdit(canEdit: boolean): void {
    const regained = canEdit && !this.canEdit;
    this.canEdit = canEdit;
    if (regained) this.provider?.pushFullState();
  }

  updateIdentity(identity: CollabIdentity): void {
    const prev = this.identity;
    if (prev && prev.username === identity.username && prev.name === identity.name &&
        prev.color === identity.color && prev.imageUrl === identity.imageUrl) return;
    this.identity = identity;
    this.awareness?.setLocalStateField('user', {
      name: identity.name,
      username: identity.username,
      color: identity.color,
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): CollabSnapshot => this.snapshot;

  private update(): void {
    const next: CollabSnapshot = {
      status: this.provider?.getStatus() ?? 'disconnected',
      synced: this.provider?.isSynced() ?? false,
      awareness: this.awareness,
    };
    const prev = this.snapshot;
    if (prev.status === next.status && prev.synced === next.synced && prev.awareness === next.awareness) return;
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }

  /**
   * The first time this session edits the text, record clientID → user in the shared
   * authors map so every collaborator can attribute the lines. Only sessions that
   * actually edit register (read-only viewers never write to the document).
   */
  private registerAuthorOnFirstEdit = (tr: Y.Transaction): void => {
    const changedText = (tr.changed as Map<unknown, unknown>).has(this.text);
    if (!tr.local || !changedText || !this.identity || !this.canEdit) return;
    const key = String(this.doc.clientID);
    if (this.authors.has(key)) return;
    const { username, name, color } = this.identity;
    queueMicrotask(() => {
      if (!this.authors.has(key)) this.authors.set(key, { username, name, color });
    });
  };
}
