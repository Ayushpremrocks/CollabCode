import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import type { SnapshotInfo } from '../types';
import { LANGUAGE_CONFIG, isSupportedLanguage } from '../types';
import { roomService } from '../services/roomService';

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
      <div
        className="w-full max-w-5xl rounded border flex flex-col"
        style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)', maxHeight: '85vh' }}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--cc-text)' }}>
              Room History
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>
              Browse and preview saved snapshots
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded transition-colors"
            style={{ color: 'var(--cc-text-sec)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Snapshot list */}
          <div className="w-60 border-r overflow-y-auto shrink-0" style={{ borderColor: 'var(--cc-border)' }}>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cc-accent)', borderTopColor: 'transparent' }} />
              </div>
            ) : snapshots.length === 0 ? (
              <p className="text-sm p-4" style={{ color: 'var(--cc-text-muted)' }}>No snapshots yet.</p>
            ) : (
              snapshots.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => selectSnapshot(s.id)}
                  className="w-full text-left px-4 py-3 border-b transition-colors"
                  style={{
                    borderColor: 'var(--cc-border-subtle)',
                    background: selectedId === s.id ? 'var(--cc-accent-dim)' : undefined,
                    borderLeft: selectedId === s.id ? '2px solid var(--cc-accent)' : '2px solid transparent',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: i === 0 ? 'var(--cc-accent)' : 'var(--cc-text-muted)' }}>
                      {i === 0 ? '★ Latest' : `#${snapshots.length - i}`}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-code" style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text-muted)' }}>
                      {s.language}
                    </span>
                  </div>
                  <div className="text-xs font-medium truncate" style={{ color: 'var(--cc-text)' }}>{s.snapshotLabel}</div>
                  <div className="text-xs mt-0.5 font-code" style={{ color: 'var(--cc-text-muted)' }}>{formatDate(s.updatedAt)}</div>
                </button>
              ))
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {loadingPreview ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cc-accent)', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <Editor
                height="100%"
                language={monacoLang}
                value={previewCode}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
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
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--cc-border)' }}>
            <p className="text-xs flex-1" style={{ color: 'var(--cc-text-muted)' }}>
              Restoring will create a new snapshot with this version's content.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-sm transition-colors border"
              style={{ color: 'var(--cc-text-sec)', borderColor: 'var(--cc-border)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="disabled:opacity-50 px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
              style={{ background: 'var(--cc-accent)', color: '#0D1117' }}
            >
              {restoring ? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
