import api from './api';
import type { ChatMessage, CreateRoomRequest, JoinRoomRequest, Room, SnapshotInfo } from '../types';

export const roomService = {
  async createRoom(data: CreateRoomRequest): Promise<Room> {
    return (await api.post<Room>('/rooms', data)).data;
  },

  /** Joins (or re-enters) a room. Must succeed before the WebSockets will accept us. */
  async joinRoom(data: JoinRoomRequest): Promise<Room> {
    return (await api.post<Room>('/rooms/join', data)).data;
  },

  async getUserRooms(): Promise<Room[]> {
    return (await api.get<Room[]>('/rooms')).data;
  },

  /** Host only. */
  async deleteRoom(roomCode: string): Promise<void> {
    await api.delete(`/rooms/${roomCode}`);
  },

  /** Host only: a locked room cannot be joined by new users. */
  async setLocked(roomCode: string, locked: boolean): Promise<{ locked: boolean }> {
    return (await api.patch<{ locked: boolean }>(`/rooms/${roomCode}/lock`, { locked })).data;
  },

  /** Host only: when read-only, only the host can edit (enforced by the server). */
  async setReadOnly(roomCode: string, readOnly: boolean): Promise<{ readOnly: boolean }> {
    return (await api.patch<{ readOnly: boolean }>(`/rooms/${roomCode}/read-only`, { readOnly })).data;
  },

  async getSnapshots(roomCode: string): Promise<SnapshotInfo[]> {
    return (await api.get<SnapshotInfo[]>(`/rooms/${roomCode}/snapshots`)).data;
  },

  async getSnapshotData(roomCode: string, snapshotId: number): Promise<{ data: string; language: string }> {
    return (await api.get<{ data: string; language: string }>(`/rooms/${roomCode}/snapshots/${snapshotId}`)).data;
  },

  async getChatHistory(roomCode: string): Promise<ChatMessage[]> {
    return (await api.get<ChatMessage[]>(`/rooms/${roomCode}/chat`)).data;
  },
};
