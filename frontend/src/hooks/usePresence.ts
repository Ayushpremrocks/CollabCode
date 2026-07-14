import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import type { UserPresence } from '../types';

export function usePresence(roomCode: string) {
  const { stompClient, connected: stompConnected, publish } = useWebSocket();
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    if (!stompClient || !stompConnected || !roomCode) return;

    // Subscribe to presence updates
    const subscription = stompClient.subscribe(
      `/topic/room/${roomCode}/presence`,
      (message) => {
        try {
          const users: UserPresence[] = JSON.parse(message.body);
          setActiveUsers(users);
        } catch (e) {
          console.error('[Presence] Failed to parse message:', e);
        }
      }
    );

    // Announce join
    publish(`/app/room/${roomCode}/join`, {});

    return () => {
      // Announce leave
      publish(`/app/room/${roomCode}/leave`, {});
      subscription.unsubscribe();
    };
  }, [stompClient, stompConnected, roomCode, publish]);

  const refreshPresence = useCallback(() => {
    publish(`/app/room/${roomCode}/join`, {});
  }, [roomCode, publish]);

  return { activeUsers, refreshPresence };
}
