import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { diffText, normalizeLineEndings, replaceSharedText, stripCarriageReturns } from './textEdits';
import { safeRedirect } from '../utils/redirect';

describe('diffText', () => {
  it('replaces only the changed middle', () => {
    expect(diffText('int main(){ return 0 }', 'int main(){ return 0; }')).toEqual({ index: 20, deleteCount: 0, insert: ';' });
    expect(diffText('abc', 'abc')).toBeNull();
    expect(diffText('abc', '')).toEqual({ index: 0, deleteCount: 3, insert: '' });
  });

  it('never splits a surrogate pair', () => {
    const change = diffText('a😀b', 'a😃b')!;
    const applied = 'a😀b'.slice(0, change.index) + change.insert + 'a😀b'.slice(change.index + change.deleteCount);
    expect(applied).toBe('a😃b');
    expect(change.insert).toBe('😃');
  });
});

describe('replaceSharedText', () => {
  it('keeps a collaborator\'s concurrent edit elsewhere in the file (the old delete-all/insert-all lost it)', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ta = a.getText('monaco');
    ta.insert(0, 'line1\nline2 bug\nline3\n');
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const tb = b.getText('monaco');

    // Concurrently: Bob edits line 1, Alice applies an AI fix to line 2.
    tb.insert(0, '// header\n');
    replaceSharedText(ta, 'line1\nline2 fixed\nline3\n');

    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(ta.toString()).toBe('// header\nline1\nline2 fixed\nline3\n');
    expect(tb.toString()).toBe(ta.toString());
  });

  it('normalizes CRLF so Monaco and Yjs offsets stay aligned', () => {
    const doc = new Y.Doc();
    const text = doc.getText('monaco');
    replaceSharedText(text, 'a\r\nb\rc\n');
    expect(text.toString()).toBe('a\nb\nc\n');
    expect(normalizeLineEndings('x\r\n')).toBe('x\n');
  });
});

describe('stripCarriageReturns', () => {
  it('cleans CR characters written by older versions', () => {
    const doc = new Y.Doc();
    const text = doc.getText('monaco');
    text.insert(0, 'one\r\ntwo\rthree');
    expect(stripCarriageReturns(text)).toBe(true);
    expect(text.toString()).toBe('one\ntwo\nthree');
    expect(stripCarriageReturns(text)).toBe(false);
  });
});

describe('safeRedirect', () => {
  it('allows same-site paths only', () => {
    expect(safeRedirect('/room/ABCD2345')).toBe('/room/ABCD2345');
    expect(safeRedirect(null)).toBe('/dashboard');
    expect(safeRedirect('https://evil.example')).toBe('/dashboard');
    expect(safeRedirect('//evil.example')).toBe('/dashboard');
    expect(safeRedirect('/\\evil.example')).toBe('/dashboard');
    expect(safeRedirect('/login?redirect=/x')).toBe('/dashboard');
  });
});
