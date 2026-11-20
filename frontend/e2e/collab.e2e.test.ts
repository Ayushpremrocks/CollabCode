/**
 * End-to-end tests: the frontend's real CollaborationProvider + Yjs against the
 * backend's real Java relay. Started by backend YjsRelayE2ETest, which sets E2E_BASE_URL:
 *
 *   cd backend && mvn test -Dtest=YjsRelayE2ETest -De2e=true
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { CollaborationProvider, type TokenGetter } from '../src/services/collaborationService';

const BASE = process.env.E2E_BASE_URL;
const WS_URL = `${BASE?.replace(/^http/, 'ws')}/ws/yjs`;

interface Client {
  name: string;
  doc: Y.Doc;
  text: Y.Text;
  awareness: Awareness;
  provider: CollaborationProvider;
  destroy: () => void;
}

const live: Client[] = [];

function roomCode(): string {
  return `E2E${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function connect(room: string, user: string, getToken?: TokenGetter): Client {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const provider = new CollaborationProvider({
    url: WS_URL,
    roomCode: room,
    doc,
    awareness,
    getToken: getToken ?? (async () => user),
    snapshotIntervalMs: 250, // aggressive, so compaction runs while edits are in flight
  });
  const client: Client = {
    name: user,
    doc,
    text: doc.getText('monaco'),
    awareness,
    provider,
    destroy: () => {
      provider.destroy();
      awareness.destroy();
    },
  };
  live.push(client);
  return client;
}

async function waitFor(condition: () => boolean, what: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for: ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const synced = (c: Client) => waitFor(() => c.provider.isSynced(), `${c.name} synced`);
const converged = (...cs: Client[]) =>
  waitFor(() => cs.every((c) => c.text.toString() === cs[0].text.toString()), 'documents converged');

async function control(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST' });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
}

/** Appends `suffix` to the end of the first line that starts with `prefix`. */
function appendToLine(text: Y.Text, prefix: string, suffix: string): void {
  const lines = text.toString().split('\n');
  let offset = 0;
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      text.insert(offset + line.length, suffix);
      return;
    }
    offset += line.length + 1;
  }
  throw new Error(`no line starting with ${prefix}`);
}

function lineStartingWith(text: Y.Text, prefix: string): string {
  return text.toString().split('\n').find((l) => l.startsWith(prefix)) ?? '';
}

afterEach(() => {
  live.splice(0).forEach((c) => c.destroy());
});

describe.skipIf(!BASE)('Yjs relay end-to-end', () => {
  it('concurrent edits land on the correct line for every user, including a late joiner', async () => {
    const room = roomCode();
    const alice = connect(room, 'user_host');
    await synced(alice);
    alice.text.insert(0, Array.from({ length: 20 }, (_, i) => `line ${i + 1}:`).join('\n') + '\n');

    const bob = connect(room, 'user_bob');
    await synced(bob);
    await converged(alice, bob);

    let carol: Client | null = null;
    for (let i = 0; i < 300; i++) {
      // Alice edits line 8, Bob edits line 14, with no waiting for each other.
      appendToLine(alice.text, 'line 8:', 'a');
      appendToLine(bob.text, 'line 14:', 'b');
      // Occasionally Alice adds a line at the TOP, shifting every line number.
      if (i % 50 === 0) alice.text.insert(0, `// header ${i}\n`);
      if (i === 150) carol = connect(room, 'user_carol'); // joins mid-stream
      if (i % 10 === 0) await sleep(5);
    }
    await synced(carol!);
    await converged(alice, bob, carol!);

    for (const c of [alice, bob, carol!]) {
      expect(lineStartingWith(c.text, 'line 8:')).toBe('line 8:' + 'a'.repeat(300));
      expect(lineStartingWith(c.text, 'line 14:')).toBe('line 14:' + 'b'.repeat(300));
      expect(c.text.toString().split('\n').filter((l) => l.startsWith('line ')).length).toBe(20);
    }

    // A brand-new joiner after all that compaction also gets the exact document.
    const dave = connect(room, 'user_dave');
    await synced(dave);
    await converged(alice, dave);
  });

  it('edits made while disconnected are delivered after reconnecting', async () => {
    const room = roomCode();
    const alice = connect(room, 'user_host');
    const bob = connect(room, 'user_bob');
    await synced(alice);
    await synced(bob);
    alice.text.insert(0, 'shared\n');
    await converged(alice, bob);

    // Drop Bob's connection, then both keep typing.
    (bob.provider as unknown as { ws: WebSocket }).ws.close(4000, 'simulated network loss');
    await waitFor(() => bob.provider.getStatus() !== 'connected', 'bob disconnected');
    bob.text.insert(bob.text.length, 'offline edit by bob\n');
    alice.text.insert(alice.text.length, 'online edit by alice\n');

    await waitFor(() => bob.provider.getStatus() === 'connected' && bob.provider.isSynced(), 'bob reconnected');
    await converged(alice, bob);
    expect(alice.text.toString()).toContain('offline edit by bob');
    expect(bob.text.toString()).toContain('online edit by alice');
  });

  it('survives a backend restart that wipes the in-memory room state', async () => {
    const room = roomCode();
    const alice = connect(room, 'user_host');
    const bob = connect(room, 'user_bob');
    await synced(alice);
    await synced(bob);
    alice.text.insert(0, 'written before restart\n');
    bob.text.insert(0, 'bob also wrote this\n');
    await converged(alice, bob);

    await control(`/test/restart?room=${room}`);
    await waitFor(() => alice.provider.getStatus() === 'connected' && bob.provider.getStatus() === 'connected', 'reconnected');
    await synced(alice);
    await synced(bob);

    const carol = connect(room, 'user_carol');
    await synced(carol);
    await converged(alice, bob, carol);
    expect(carol.text.toString()).toContain('written before restart');
    expect(carol.text.toString()).toContain('bob also wrote this');
  });

  it('read-only mode: server rejects guest edits, host edits flow, and editing resumes cleanly afterwards', async () => {
    const room = roomCode();
    const host = connect(room, 'user_host');
    const guest = connect(room, 'user_guest');
    await synced(host);
    await synced(guest);
    host.text.insert(0, 'start\n');
    await converged(host, guest);

    await control(`/test/readonly?room=${room}&value=true`);
    guest.text.insert(0, 'GUEST-WHILE-LOCKED\n');
    host.text.insert(host.text.length, 'host still edits\n');
    await waitFor(() => guest.text.toString().includes('host still edits'), 'host edit reached guest');
    await sleep(500);
    expect(host.text.toString()).not.toContain('GUEST-WHILE-LOCKED');

    // Late joiner during read-only must not see the rejected edit either.
    const viewer = connect(room, 'user_viewer');
    await synced(viewer);
    expect(viewer.text.toString()).not.toContain('GUEST-WHILE-LOCKED');

    await control(`/test/readonly?room=${room}&value=false`);
    guest.provider.pushFullState(); // what CollabSession.setCanEdit(true) does
    guest.text.insert(guest.text.length, 'guest edits again\n');
    await converged(host, guest, viewer);
    expect(host.text.toString()).toContain('guest edits again');
  });

  it('retries with a fresh token when the first one is expired (4401)', async () => {
    const room = roomCode();
    const calls: boolean[] = [];
    const client = connect(room, 'user_host', async (opts) => {
      calls.push(!!opts?.fresh);
      return opts?.fresh ? 'user_host' : 'expired';
    });
    await synced(client);
    expect(calls[0]).toBe(false);
    expect(calls).toContain(true);
  });

  it('a user who has not joined the room is refused and does not retry', async () => {
    const outsider = connect(roomCode(), 'user_outsider');
    await waitFor(() => outsider.provider.getStatus() === 'forbidden', 'forbidden status');
  });

  it('large documents (> 8 KB snapshots) stay connected and are delivered to joiners', async () => {
    const room = roomCode();
    const alice = connect(room, 'user_host');
    await synced(alice);
    const big = Array.from({ length: 6000 }, (_, i) => `const value${i} = ${i}; // padding padding`).join('\n');
    alice.text.insert(0, big);
    await sleep(1200); // several snapshot intervals
    expect(alice.provider.getStatus()).toBe('connected');

    const bob = connect(room, 'user_bob');
    await synced(bob);
    await converged(alice, bob);
    expect(bob.text.length).toBe(big.length);
  });

  it('relays cursors and removes them when a user leaves', async () => {
    const room = roomCode();
    const alice = connect(room, 'user_host');
    const bob = connect(room, 'user_bob');
    await synced(alice);
    await synced(bob);
    alice.awareness.setLocalStateField('user', { name: 'Alice', color: '#6366f1' });
    await waitFor(() => (bob.awareness.getStates().get(alice.doc.clientID) as { user?: { name?: string } } | undefined)?.user?.name === 'Alice', 'bob sees alice');

    const aliceId = alice.doc.clientID;
    alice.destroy();
    await waitFor(() => !bob.awareness.getStates().has(aliceId), "alice's cursor removed", 5000);
  });

  it('the document is persisted when the last user leaves and restored from storage', async () => {
    const room = roomCode();
    const alice = connect(room, 'user_host');
    await synced(alice);
    alice.text.insert(0, 'persist me\n');
    await sleep(600); // let a snapshot reach the server
    alice.destroy();
    await sleep(300);
    await control(`/test/restart?room=${room}`); // drop memory: next joiner must load from storage

    const bob = connect(room, 'user_bob');
    await synced(bob);
    expect(bob.text.toString()).toBe('persist me\n');
  });
});
