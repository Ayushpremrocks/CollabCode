import { useEffect, useRef, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { LANGUAGE_CONFIG, type SupportedLanguage, type UserPresence } from '../types';

interface CollaborativeEditorProps {
  yText: Y.Text;
  language: SupportedLanguage;
  readOnly?: boolean;
  isHost?: boolean;
  fontSize?: number;
  theme?: 'vs-dark' | 'vs';
  currentUsername?: string;
  activeUsers?: UserPresence[];
}

// Maps username -> hex color index (0-7)
const USER_COLOR_INDICES: Map<string, number> = new Map();
let colorCounter = 0;

function getColorIndex(username: string): number {
  if (!USER_COLOR_INDICES.has(username)) {
    USER_COLOR_INDICES.set(username, colorCounter % 8);
    colorCounter++;
  }
  return USER_COLOR_INDICES.get(username)!;
}

export function CollaborativeEditor({
  yText,
  language,
  readOnly = false,
  isHost = false,
  fontSize = 14,
  theme = 'vs-dark',
  currentUsername = '',
  activeUsers: _activeUsers = [],
}: CollaborativeEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const decorationsRef = useRef<string[]>([]);
  // lineAuthorMap: lineNumber (1-indexed) -> username
  const lineAuthorMap = useRef<Map<number, string>>(new Map());

  const updateGutterDecorations = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

    lineAuthorMap.current.forEach((username, lineNum) => {
      if (lineNum < 1 || lineNum > model.getLineCount()) return;
      const colorIdx = getColorIndex(username);

      newDecorations.push({
        range: new monaco.Range(lineNum, 1, lineNum, 1),
        options: {
          isWholeLine: false,
          linesDecorationsClassName: `line-author-gutter line-author-${colorIdx}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, []);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, LANGUAGE_CONFIG[language].monacoId);
    }

    // Track cursor position changes to map authorship
    editor.onDidChangeCursorPosition((e) => {
      if (!currentUsername) return;
      const line = e.position.lineNumber;
      lineAuthorMap.current.set(line, currentUsername);
    });

    bindingRef.current = new MonacoBinding(
      yText,
      editor.getModel()!,
      new Set([editor])
    );

    // Update authorship whenever the document changes
    yText.observe((event) => {
      // For remote updates, we'd need awareness to know which user changed what
      // We track the current user's line as they type
      const position = editor.getPosition();
      if (position && currentUsername && event.transaction.origin !== 'remote' && event.transaction.origin !== 'snapshot') {
        lineAuthorMap.current.set(position.lineNumber, currentUsername);
        updateGutterDecorations();
      }
    });

    // Apply read-only based on props
    editor.updateOptions({
      readOnly: readOnly && !isHost,
      fontSize,
    });
  };

  // Update language when it changes
  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!model) return;

    const monacoId = LANGUAGE_CONFIG[language].monacoId;
    if (model.getLanguageId() !== monacoId) {
      monaco.editor.setModelLanguage(model, monacoId);
    }
  }, [language]);

  // Update read-only mode
  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly: readOnly && !isHost });
  }, [readOnly, isHost]);

  // Update font size
  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, []);

  return (
    <div className="h-full w-full rounded-lg overflow-hidden border border-gray-800">
      <Editor
        height="100%"
        language={LANGUAGE_CONFIG[language].monacoId}
        theme={theme}
        onMount={handleEditorMount}
        options={{
          fontSize,
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
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          // Gutter space for authorship indicators
          lineDecorationsWidth: 8,
          glyphMargin: false,
        }}
      />
    </div>
  );
}
