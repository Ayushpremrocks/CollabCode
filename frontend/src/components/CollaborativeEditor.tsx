import { useEffect, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';
import { monaco } from '../collab/monacoSetup';
import {
  computeLineAuthors,
  describeContributors,
  resolveAuthor,
  type AuthorInfo,
} from '../collab/authorship';
import { LANGUAGE_CONFIG, type SupportedLanguage } from '../types';

type MonacoEditor = Parameters<OnMount>[0];

interface CollaborativeEditorProps {
  yText: Y.Text;
  authors: Y.Map<AuthorInfo>;
  awareness: Awareness | null;
  language: SupportedLanguage;
  readOnly: boolean;
  fontSize?: number;
  theme?: 'vs-dark' | 'vs';
  /** Show the author's name at the start of each block of lines they wrote. */
  showAuthorNames?: boolean;
}

const UNKNOWN_COLOR = '#6E7681';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function safeColor(color: string | undefined): string {
  return color && HEX_COLOR.test(color) ? color : UNKNOWN_COLOR;
}

/** Escapes text for use inside a double-quoted CSS string. */
function cssString(text: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = text.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 40);
  return `"${clean.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Adds a <style> element to <head>; the caller rewrites it as users / colours change. */
function createStyleSheet(id: string): HTMLStyleElement {
  const el = document.createElement('style');
  el.dataset.collab = id;
  document.head.appendChild(el);
  return el;
}

export function CollaborativeEditor({
  yText,
  authors,
  awareness,
  language,
  readOnly,
  fontSize = 14,
  theme = 'vs-dark',
  showAuthorNames = false,
}: CollaborativeEditorProps) {
  const [editor, setEditor] = useState<MonacoEditor | null>(null);

  const handleMount: OnMount = (instance) => setEditor(instance);

  // ── Yjs ⇄ Monaco binding ────────────────────────────────────────────────
  useEffect(() => {
    const model = editor?.getModel();
    if (!editor || !model) return;
    // The shared text is always LF; a CRLF model would shift every offset after
    // a line break and make remote edits land on the wrong line.
    model.setEOL(monaco.editor.EndOfLineSequence.LF);
    const binding = new MonacoBinding(yText, model, new Set([editor]), awareness);
    return () => binding.destroy();
  }, [editor, yText, awareness]);

  // ── Remote cursor colours + name labels ─────────────────────────────────
  useEffect(() => {
    if (!awareness) return;
    const cursorSheet = createStyleSheet('cursors');
    const render = () => {
      const rules: string[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const user = (state as { user?: { name?: string; color?: string } }).user;
        const color = safeColor(user?.color);
        rules.push(
          `.yRemoteSelection-${clientId}{background-color:${color}33}`,
          `.yRemoteSelectionHead-${clientId}{border-color:${color}}`,
          `.yRemoteSelectionHead-${clientId}::after{content:${cssString(user?.name || 'Guest')};background:${color}}`,
        );
      });
      cursorSheet.textContent = rules.join('\n');
    };
    render();
    awareness.on('change', render);
    return () => {
      awareness.off('change', render);
      cursorSheet.remove();
    };
  }, [awareness]);

  // ── Line authorship decorations ─────────────────────────────────────────
  useEffect(() => {
    if (!editor) return;
    const authorSheet = createStyleSheet('authors');
    const collection = editor.createDecorationsCollection();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const render = () => {
      timer = undefined;
      const model = editor.getModel();
      if (!model) return;
      const lineCount = model.getLineCount();
      const colors = new Set<string>();
      const decorations: monaco.editor.IModelDeltaDecoration[] = [];
      let previousLabel: string | null = null;
      let previousLine = 0;

      for (const { line, clientId, contributions } of computeLineAuthors(yText)) {
        if (line > lineCount) break;
        const info = resolveAuthor(authors, clientId);
        const label = info ? info.name || info.username : 'Earlier edit';
        const color = safeColor(info?.color);
        const colorKey = color.slice(1).toLowerCase();
        colors.add(colorKey);

        const contributors = describeContributors(authors, contributions);
        const tooltip = contributors.length > 1
          ? `Written by ${contributors.map((c) => `${c.label} (${Math.round(c.share * 100)}%)`).join(', ')}`
          : `Written by ${label}`;

        decorations.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            linesDecorationsClassName: `cc-author-bar cc-author-${colorKey}`,
            linesDecorationsTooltip: tooltip,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });

        // Blame-style label at the end of the first line of each author's block.
        const startsBlock = label !== previousLabel || line !== previousLine + 1;
        if (showAuthorNames && startsBlock) {
          const end = model.getLineMaxColumn(line);
          decorations.push({
            range: new monaco.Range(line, end, line, end),
            options: {
              after: { content: `   ${label}`, inlineClassName: `cc-author-inline cc-author-text-${colorKey}` },
            },
          });
        }
        previousLabel = label;
        previousLine = line;
      }

      authorSheet.textContent = [...colors]
        .map((c) => `.cc-author-${c}{background:#${c}}.cc-author-text-${c}{color:#${c}}`)
        .join('\n');
      collection.set(decorations);
    };

    const schedule = () => {
      if (timer === undefined) timer = setTimeout(render, 120);
    };

    render();
    yText.observe(schedule);
    authors.observe(schedule);
    return () => {
      yText.unobserve(schedule);
      authors.unobserve(schedule);
      if (timer !== undefined) clearTimeout(timer);
      collection.clear();
      authorSheet.remove();
    };
  }, [editor, yText, authors, showAuthorNames]);

  // ── Editor options ──────────────────────────────────────────────────────
  useEffect(() => {
    const model = editor?.getModel();
    if (model) monaco.editor.setModelLanguage(model, LANGUAGE_CONFIG[language].monacoId);
  }, [editor, language]);

  useEffect(() => {
    editor?.updateOptions({ readOnly, fontSize });
  }, [editor, readOnly, fontSize]);

  return (
    <div className="h-full w-full rounded-lg overflow-hidden border border-gray-800">
      <Editor
        height="100%"
        defaultLanguage={LANGUAGE_CONFIG[language].monacoId}
        theme={theme}
        onMount={handleMount}
        options={{
          fontSize,
          readOnly,
          readOnlyMessage: { value: 'Only the host can edit while the room is in host-only mode.' },
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          minimap: { enabled: false },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 12 },
          renderLineHighlight: 'gutter',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          lineDecorationsWidth: 10,
          glyphMargin: false,
        }}
      />
    </div>
  );
}
