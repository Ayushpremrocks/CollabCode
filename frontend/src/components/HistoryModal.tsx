import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import type { SnapshotInfo } from '../types';
import { LANGUAGE_CONFIG, isSupportedLanguage } from '../types';
import { roomService } from '../services/roomService';
import { useTheme } from '../contexts/ThemeContext';

interface HistoryModalProps {
  roomCode: string;
  isHost: boolean;
  onClose: () => void;
  onRestored: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function HistoryModal({ roomCode, isHost, onClose, onRestored }: HistoryModalProps) {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewCode, setPreviewCode] = useState<string>('');
  const [previewLanguage, setPreviewLanguage] = useState<string>('javascript');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    roomService.getSnapshots(roomCode)
      .then(list => {
        setSnapshots(list);
        if (list.length > 0) selectSnapshot(list[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [roomCode]);

  const selectSnapshot = async (id: number) => {
    setSelectedId(id);
    setLoadingPreview(true);
    try {
      const { data, language } = await roomService.getSnapshotData(roomCode, id);
      if (data) {
        // Decode the Yjs binary snapshot to plain text
        const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
        const doc = new Y.Doc();
        Y.applyUpdate(doc, bytes);
        const text = doc.getText('monaco').toString();
        setPreviewCode(text);
        doc.destroy();
      } else {
        setPreviewCode('');
      }
      setPreviewLanguage(language || 'javascript');
    } catch {
      setPreviewCode('(Failed to load snapshot preview)');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedId) return;
    setRestoring(true);
    try {
      await roomService.restoreSnapshot(roomCode, selectedId);
      onRestored();
      onClose();
    } catch (e) {
      console.error('Restore failed', e);
    } finally {
      setRestoring(false);
    }
  };

  const monacoLang = isSupportedLanguage(previewLanguage)
    ? LANGUAGE_CONFIG[previewLanguage].monacoId
    : 'plaintext';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-5xl rounded-2xl shadow-2xl border flex flex-col ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      }`} style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Room History
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Browse and preview saved snapshots
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Snapshot list */}
          <div className={`w-64 border-r overflow-y-auto shrink-0 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : snapshots.length === 0 ? (
              <p className={`text-sm p-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No snapshots yet.</p>
            ) : (
              snapshots.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => selectSnapshot(s.id)}
                  className={`w-full text-left px-4 py-3 border-b transition-colors ${
                    isDark ? 'border-gray-800' : 'border-gray-100'
                  } ${
                    selectedId === s.id
                      ? isDark ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'bg-indigo-50 border-l-2 border-l-indigo-500'
                      : isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`flex items-center gap-2 mb-1`}>
                    <span className={`text-xs font-semibold ${i === 0 ? 'text-indigo-400' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {i === 0 ? '★ Latest' : `#${snapshots.length - i}`}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                      {s.language}
                    </span>
                  </div>
                  <div className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium truncate`}>
                    {s.snapshotLabel}
                  </div>
                  <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {formatDate(s.updatedAt)}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {loadingPreview ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <Editor
                height="100%"
                language={monacoLang}
                value={previewCode}
                theme={isDark ? 'vs-dark' : 'vs'}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  padding: { top: 12 },
                  domReadOnly: true,
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        {isHost && selectedId && (
          <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <p className={`text-xs flex-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Restoring will create a new snapshot with this version's content.
            </p>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600' : 'text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300'}`}
            >
              Cancel
            </button>
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {restoring ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restore This Version
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
