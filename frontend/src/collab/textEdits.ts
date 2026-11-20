import * as Y from 'yjs';

/** Monaco models are forced to LF; any CR in the shared text would shift offsets between users. */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export interface TextChange {
  index: number;
  deleteCount: number;
  insert: string;
}

/**
 * Smallest single replacement turning `current` into `next` (common prefix/suffix trimmed).
 * Replacing only the changed middle keeps edits other users make elsewhere in the
 * document — and their line authorship — intact, unlike delete-all + insert-all.
 */
export function diffText(current: string, next: string): TextChange | null {
  if (current === next) return null;
  let start = 0;
  const maxStart = Math.min(current.length, next.length);
  while (start < maxStart && current.charCodeAt(start) === next.charCodeAt(start)) start++;

  let endCurrent = current.length;
  let endNext = next.length;
  while (endCurrent > start && endNext > start &&
         current.charCodeAt(endCurrent - 1) === next.charCodeAt(endNext - 1)) {
    endCurrent--;
    endNext--;
  }
  // Never split a UTF-16 surrogate pair.
  if (start > 0 && isHighSurrogate(current.charCodeAt(start - 1))) start--;
  return { index: start, deleteCount: endCurrent - start, insert: next.slice(start, endNext) };
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** Applies `next` to the shared text as one atomic, minimal Yjs transaction. */
export function replaceSharedText(ytext: Y.Text, next: string, origin: unknown = 'local-replace'): boolean {
  const change = diffText(ytext.toString(), normalizeLineEndings(next));
  if (!change || !ytext.doc) return false;
  ytext.doc.transact(() => {
    if (change.deleteCount > 0) ytext.delete(change.index, change.deleteCount);
    if (change.insert) ytext.insert(change.index, change.insert);
  }, origin);
  return true;
}

/** Removes carriage returns already stored in the shared text (data written by older versions). */
export function stripCarriageReturns(ytext: Y.Text): boolean {
  const text = ytext.toString();
  if (!text.includes('\r') || !ytext.doc) return false;
  ytext.doc.transact(() => {
    for (let i = text.length - 1; i >= 0; i--) {
      if (text[i] === '\r') {
        if (text[i + 1] === '\n') ytext.delete(i, 1);
        else {
          ytext.delete(i, 1);
          ytext.insert(i, '\n');
        }
      }
    }
  }, 'normalize-eol');
  return true;
}
