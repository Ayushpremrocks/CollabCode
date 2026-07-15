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

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;

    const userName = user?.fullName || user?.firstName || user?.username || '';
    const userImageUrl = user?.imageUrl || '';

    // Pass Clerk's getToken as the tokenGetter so the provider
    // always uses a fresh session token on connect and reconnect.
    const provider = new CollaborationProvider(roomCode, doc, getToken, userName, userImageUrl);
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
  }, [roomCode, getToken, user?.fullName, user?.firstName, user?.username, user?.imageUrl]);

  return {
    yDoc: docRef.current,
    yText: docRef.current.getText('monaco'),
    provider: providerRef.current,
    connected,
  };
}
