import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { AUTHORS_MAP, computeLineAuthors, describeContributors, type AuthorInfo } from './authorship';

/** Two peers that exchange every update immediately (like the relay does). */
function pair() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on('update', (u: Uint8Array, origin: unknown) => origin !== 'remote' && Y.applyUpdate(b, u, 'remote'));
  b.on('update', (u: Uint8Array, origin: unknown) => origin !== 'remote' && Y.applyUpdate(a, u, 'remote'));
  const register = (doc: Y.Doc, info: AuthorInfo) => doc.getMap<AuthorInfo>(AUTHORS_MAP).set(String(doc.clientID), info);
  register(a, { username: 'alice', name: 'Alice', color: '#6366f1' });
  register(b, { username: 'bob', name: 'Bob', color: '#10b981' });
  return { a, b, ta: a.getText('monaco'), tb: b.getText('monaco') };
}

describe('computeLineAuthors', () => {
  it('attributes each line to the user who typed it, identically on every peer', () => {
    const { a, b, ta, tb } = pair();
    ta.insert(0, 'function add(a, b) {\n}\n');
    tb.insert(ta.toString().indexOf('}'), '  return a + b;\n'); // Bob writes the body (line 2)

    const onA = computeLineAuthors(ta);
    const onB = computeLineAuthors(tb);
    expect(onA).toEqual(onB);
    expect(onA.map((l) => [l.line, l.clientId])).toEqual([
      [1, a.clientID],
      [2, b.clientID],
      [3, a.clientID],
    ]);
  });

  it('uses the author of most non-whitespace characters and reports shares', () => {
    const { a, ta, tb } = pair();
    ta.insert(0, 'const total = price * quantity;');
    tb.insert(ta.length - 1, ' + tax'); // Bob appends a small part
    const [line] = computeLineAuthors(ta);
    expect(line.clientId).toBe(a.clientID);

    const shares = describeContributors(a.getMap<AuthorInfo>(AUTHORS_MAP), line.contributions);
    expect(shares[0].label).toBe('Alice');
    expect(shares[1].label).toBe('Bob');
    expect(shares[0].share + shares[1].share).toBeCloseTo(1);
  });

  it('ignores deleted text and blank lines', () => {
    const { ta, tb, b } = pair();
    ta.insert(0, 'old line\n\n');
    tb.delete(0, 'old line'.length);
    tb.insert(0, 'new line');
    const lines = computeLineAuthors(ta);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ line: 1, clientId: b.clientID });
  });

  it('labels text from sessions that never registered as an earlier edit', () => {
    const doc = new Y.Doc();
    doc.getText('monaco').insert(0, 'x');
    const [line] = computeLineAuthors(doc.getText('monaco'));
    expect(describeContributors(doc.getMap<AuthorInfo>(AUTHORS_MAP), line.contributions)[0].label).toBe('Earlier edit');
  });
});
