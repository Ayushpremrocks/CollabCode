import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { CollaborationProvider } from '../services/collaborationService';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '@clerk/clerk-react';

interface UseCollaborationReturn {
  yDoc: Y.Doc;
  yText: Y.Text;
  provider: CollaborationProvider | null;
  connected: boolean;
}

export function useCollaboration(roomCode: string): UseCollaborationReturn {
  const docRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<CollaborationProvider | null>(null);
  const [connected, setConnected] = useState(false);
  const { getToken } = useAuth();
  const { user } = useUser();

  // Store user display info in refs so we can read latest values
  // without them being a dependency that tears down the WebSocket on change.
  const userNameRef = useRef<string>('');
  const userImageUrlRef = useRef<string>('');

  // Keep refs in sync with latest Clerk user data
  userNameRef.current = user?.fullName || user?.firstName || user?.username || '';
  userImageUrlRef.current = user?.imageUrl || '';

  useEffect(() => {
    // Only (re)connect when roomCode or getToken changes — NOT on user field changes.
    const doc = new Y.Doc();
    docRef.current = doc;

    // Read the current name/imageUrl at connection time from refs
    const provider = new CollaborationProvider(
      roomCode,
      doc,
      getToken,
      userNameRef.current,
      userImageUrlRef.current
    );
    providerRef.current = provider;

    const unsubscribe = provider.onConnectionChange((isConnected) => {
      setConnected(isConnected);
    });

    return () => {
      unsubscribe();
      provider.destroy();
      doc.destroy();
      providerRef.current = null;
    };
    // Intentionally ONLY depend on roomCode and getToken.
    // userName and imageUrl are read from refs at connect time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, getToken]);

  return {
    yDoc: docRef.current,
    yText: docRef.current.getText('monaco'),
    provider: providerRef.current,
    connected,
  };
}
