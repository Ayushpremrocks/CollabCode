import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

/**
 * Use the bundled monaco-editor package for <Editor/>.
 *
 * Without this, @monaco-editor/react downloads a second copy of Monaco from a CDN
 * while y-monaco and our decoration code use the bundled copy, so language
 * switching and the Yjs binding were talking to a different Monaco instance than
 * the one rendering the editor.
 */
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case 'json':
        return new JsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker();
      case 'typescript':
      case 'javascript':
        return new TsWorker();
      default:
        return new EditorWorker();
    }
  },
};

loader.config({ monaco });

// Editor theme matching the app palette (index.css tokens).
monaco.editor.defineTheme('collab-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6C7386', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'A78BFA' },
    { token: 'string', foreground: '34D399' },
    { token: 'number', foreground: 'FBBF24' },
    { token: 'type', foreground: '22D3EE' },
  ],
  colors: {
    'editor.background': '#0E1219',
    'editor.lineHighlightBackground': '#151A23',
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': '#3A4154',
    'editorLineNumber.activeForeground': '#A3AABB',
    'editor.selectionBackground': '#8B9CFF40',
    'editorCursor.foreground': '#8B9CFF',
    'editorIndentGuide.background1': '#1C2230',
    'editorGutter.background': '#0E1219',
    'scrollbarSlider.background': '#23293880',
  },
});

export { monaco };
