import * as Y from 'yjs';

/**
 * Line authorship ("who wrote which line").
 *
 * Every character in a Y.Text is stored in an Item whose id carries the Yjs
 * clientID of the document that inserted it. Each browser session registers
 * its clientID → user in the shared `authors` map (see collabSession.ts), so
 * authorship is part of the shared document: it syncs live, survives reloads,
 * and is stored in snapshots — no extra server state needed.
 */

export interface AuthorInfo {
  username: string;
  name: string;
  color: string;
}

export interface LineAuthorship {
  /** 1-based line number. */
  line: number;
  /** Yjs clientID that wrote most of the line's non-whitespace characters. */
  clientId: number;
  /** clientID → number of non-whitespace characters on this line. */
  contributions: Map<number, number>;
}

export const AUTHORS_MAP = 'authors';

/** Walks the Y.Text item list and attributes every line to its main author. */
export function computeLineAuthors(ytext: Y.Text): LineAuthorship[] {
  const lines: Map<number, number>[] = [new Map()];
  // `_start` is the head of Yjs' internal item list; it is stable API in yjs 13.
  let item = (ytext as unknown as { _start: Y.Item | null })._start;

  while (item !== null) {
    if (!item.deleted && item.content instanceof Y.ContentString) {
      const client = item.id.client;
      const str = item.content.str;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '\n') {
          lines.push(new Map());
        } else if (ch !== ' ' && ch !== '\t' && ch !== '\r') {
          const counts = lines[lines.length - 1];
          counts.set(client, (counts.get(client) ?? 0) + 1);
        }
      }
    }
    item = item.right as Y.Item | null;
  }

  const result: LineAuthorship[] = [];
  lines.forEach((counts, index) => {
    let best = -1;
    let bestCount = 0;
    counts.forEach((count, client) => {
      if (count > bestCount) {
        best = client;
        bestCount = count;
      }
    });
    if (best !== -1) result.push({ line: index + 1, clientId: best, contributions: counts });
  });
  return result;
}

/** Looks up the user behind a Yjs clientID. */
export function resolveAuthor(authors: Y.Map<AuthorInfo>, clientId: number): AuthorInfo | null {
  return authors.get(String(clientId)) ?? null;
}

/**
 * Groups clientIDs by user, so one user who edited from several tabs/sessions
 * (each with its own clientID) is shown as a single author.
 */
export function describeContributors(
  authors: Y.Map<AuthorInfo>,
  contributions: Map<number, number>,
): { label: string; share: number }[] {
  const byUser = new Map<string, number>();
  let total = 0;
  contributions.forEach((count, client) => {
    const info = resolveAuthor(authors, client);
    const label = info ? info.name || info.username : 'Earlier edit';
    byUser.set(label, (byUser.get(label) ?? 0) + count);
    total += count;
  });
  return [...byUser.entries()]
    .map(([label, count]) => ({ label, share: total ? count / total : 0 }))
    .sort((a, b) => b.share - a.share);
}
