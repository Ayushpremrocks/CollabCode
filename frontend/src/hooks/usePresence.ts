import { useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import type { UserPresence } from '../types';

/** Live list of users connected to the room. Only subscribes once the user has joined. */
export function usePresence(roomCode: string, enabled: boolean) {
  const { stompClient, connected, publish } = useWebSocket();
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    if (!stompClient || !connected || !roomCode || !enabled) return;

    const subscription = stompClient.subscribe(`/topic/room/${roomCode}/presence`, (message) => {
      try {
        setActiveUsers(JSON.parse(message.body) as UserPresence[]);
      } catch (e) {
        console.error('[Presence] Failed to parse message:', e);
      }
    });
    // Ask the server to re-broadcast room state + presence now that we listen.
    publish(`/app/room/${roomCode}/join`, {});

    return () => subscription.unsubscribe();
  }, [stompClient, connected, roomCode, enabled, publish]);

  return { activeUsers };
}
