import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import type { SnapshotInfo } from '../types';
import { LANGUAGE_CONFIG, isSupportedLanguage } from '../types';
import { roomService } from '../services/roomService';
import {
  CollabDialog,
  CollabDialogContent,
  CollabDialogHeader,
  CollabDialogTitle,
  CollabDialogDescription,
} from './ui/CollabDialog';
import {
  CollabAlertDialog,
  CollabAlertDialogContent,
  CollabAlertDialogHeader,
  CollabAlertDialogTitle,
  CollabAlertDialogDescription,
  CollabAlertDialogFooter,
  CollabAlertDialogCancel,
  CollabAlertDialogAction,
} from './ui/CollabAlertDialog';
import { toast } from './ui/CollabToast';

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
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

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

  const handleConfirmRestore = async () => {
    if (!selectedId) return;
    setRestoring(true);
    try {
      await roomService.restoreSnapshot(roomCode, selectedId);
      toast.success('Room restored to snapshot version');
      onRestored();
      onClose();
    } catch (e) {
      console.error('Restore failed', e);
      toast.error('Failed to restore snapshot. Please try again.');
    } finally {
      setRestoring(false);
      setConfirmRestoreOpen(false);
    }
  };

  const monacoLang = isSupportedLanguage(previewLanguage)
    ? LANGUAGE_CONFIG[previewLanguage].monacoId
    : 'plaintext';

  const selectedSnapshot = snapshots.find((s) => s.id === selectedId);

  return (
    <>
      <CollabDialog open={true} onOpenChange={(open) => !open && onClose()}>
        <CollabDialogContent maxWidth="max-w-5xl" className="h-[85vh]">
          {/* Header */}
          <CollabDialogHeader>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--cc-accent)' }} />
              <CollabDialogTitle>Room History &amp; Snapshots</CollabDialogTitle>
            </div>
            <CollabDialogDescription>
              Browse, preview, and restore previously saved snapshots for room {roomCode}.
            </CollabDialogDescription>
          </CollabDialogHeader>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Snapshot list */}
            <div className="w-64 border-r overflow-y-auto shrink-0" style={{ borderColor: 'var(--cc-border)' }}>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cc-accent)', borderTopColor: 'transparent' }} />
                </div>
              ) : snapshots.length === 0 ? (
                <p className="text-xs p-4 font-mono" style={{ color: 'var(--cc-text-muted)' }}>No snapshots saved yet.</p>
              ) : (
                snapshots.map((s, i) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => selectSnapshot(s.id)}
                    className="w-full text-left px-4 py-3 border-b transition-colors cursor-pointer"
                    style={{
                      borderColor: 'var(--cc-border-subtle)',
                      background: selectedId === s.id ? 'var(--cc-accent-dim)' : undefined,
                      borderLeft: selectedId === s.id ? '2px solid var(--cc-accent)' : '2px solid transparent',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono font-semibold" style={{ color: i === 0 ? 'var(--cc-accent)' : 'var(--cc-text-muted)' }}>
                        {i === 0 ? '★ Latest' : `#${snapshots.length - i}`}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--cc-surface-el)', color: 'var(--cc-text-muted)', border: '1px solid var(--cc-border)' }}>
                        {s.language}
                      </span>
                    </div>
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--cc-text)' }}>{s.snapshotLabel}</div>
                    <div className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--cc-text-muted)' }}>{formatDate(s.updatedAt)}</div>
                  </button>
                ))
              )}
            </div>

            {/* Code Preview */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0D1117' }}>
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
            <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t bg-[#0A0E14]" style={{ borderColor: 'var(--cc-border)' }}>
              <p className="text-xs font-mono" style={{ color: 'var(--cc-text-muted)' }}>
                Restoring replaces current shared room code with this snapshot.
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded text-xs transition-colors border cursor-pointer hover:bg-gray-800"
                  style={{ color: 'var(--cc-text-sec)', borderColor: 'var(--cc-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRestoreOpen(true)}
                  disabled={restoring}
                  className="disabled:opacity-50 px-3.5 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer hover:brightness-110"
                  style={{ background: 'var(--cc-accent)', color: '#0D1117' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restore This Version
                </button>
              </div>
            </div>
          )}
        </CollabDialogContent>
      </CollabDialog>

      {/* Confirmation Alert Dialog for Snapshot Restoration */}
      <CollabAlertDialog open={confirmRestoreOpen} onOpenChange={setConfirmRestoreOpen}>
        <CollabAlertDialogContent>
          <CollabAlertDialogHeader>
            <CollabAlertDialogTitle
              icon={
                <span className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: 'var(--cc-accent-dim)', color: 'var(--cc-accent)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </span>
              }
            >
              Restore Snapshot?
            </CollabAlertDialogTitle>
            <CollabAlertDialogDescription>
              This will replace the current shared room code with snapshot{' '}
              <span className="font-mono text-white font-semibold">
                &ldquo;{selectedSnapshot?.snapshotLabel}&rdquo;
              </span>
              . All connected collaborators will immediately see the restored code.
            </CollabAlertDialogDescription>
          </CollabAlertDialogHeader>
          <CollabAlertDialogFooter>
            <CollabAlertDialogCancel>Keep Current Code</CollabAlertDialogCancel>
            <CollabAlertDialogAction
              variant="primary"
              loading={restoring}
              onClick={handleConfirmRestore}
            >
              Confirm Restore
            </CollabAlertDialogAction>
          </CollabAlertDialogFooter>
        </CollabAlertDialogContent>
      </CollabAlertDialog>
    </>
  );
}
