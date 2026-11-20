import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { CollabSession, type CollabIdentity } from '../collab/collabSession';
import { useAuth } from '../contexts/AuthContext';

/**
 * Connects to a room's shared document once `enabled` is true (i.e. after the
 * REST join succeeded — the server only accepts sockets from participants).
 */
export function useCollaboration(roomCode: string, enabled: boolean, identity: CollabIdentity | null) {
  const { getToken } = useAuth();
  const session = useMemo(() => new CollabSession(roomCode), [roomCode]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);

  // Latest token getter without making it a reconnect trigger.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const ready = enabled && identity !== null;
  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
    if (identity) session.updateIdentity(identity);
  }, [identity, session]);

  useEffect(() => {
    if (!ready || !identityRef.current) return;
    session.start((opts) => getTokenRef.current(opts), identityRef.current);
    return () => session.stop();
  }, [ready, session]);

  return {
    session,
    yDoc: session.doc,
    yText: session.text,
    authors: session.authors,
    awareness: state.awareness,
    status: state.status,
    synced: state.synced,
  };
}
