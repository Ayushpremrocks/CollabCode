import { LANGUAGE_CONFIG, type SupportedLanguage } from '../types';

/**
 * Downloads the current editor code as a file with the correct extension.
 * Filename format: {roomCode}-{timestamp}.{ext}
 */
export function downloadCode(
  code: string,
  language: SupportedLanguage,
  roomCode: string
): void {
  const config = LANGUAGE_CONFIG[language];
  const ext = config.extension;
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filename = `${roomCode}-${timestamp}.${ext}`;

  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
