import api from './api';
import type { Room, CreateRoomRequest, JoinRoomRequest, SnapshotInfo } from '../types';

export const roomService = {
  async createRoom(data: CreateRoomRequest): Promise<Room> {
    const response = await api.post<Room>('/rooms', data);
    return response.data;
  },

  async joinRoom(data: JoinRoomRequest): Promise<Room> {
    const response = await api.post<Room>('/rooms/join', data);
    return response.data;
  },

  async getRoomByCode(roomCode: string): Promise<Room> {
    const response = await api.get<Room>(`/rooms/${roomCode}`);
    return response.data;
  },

  async getUserRooms(): Promise<Room[]> {
    const response = await api.get<Room[]>('/rooms');
    return response.data;
  },

  /** Feature 2: Delete a room (host only) */
  async deleteRoom(roomCode: string): Promise<void> {
    await api.delete(`/rooms/${roomCode}`);
  },

  /** Lock/Unlock a room (host only) */
  async toggleLock(roomCode: string, locked: boolean): Promise<{ locked: boolean }> {
    const response = await api.patch<{ locked: boolean }>(`/rooms/${roomCode}/lock`, { locked });
    return response.data;
  },

  /** Feature 8: Get snapshot history */
  async getSnapshots(roomCode: string): Promise<SnapshotInfo[]> {
    const response = await api.get<SnapshotInfo[]>(`/rooms/${roomCode}/snapshots`);
    return response.data;
  },

  /** Feature 8: Get snapshot document data for preview */
  async getSnapshotData(roomCode: string, snapshotId: number): Promise<{ data: string; language: string }> {
    const response = await api.get<{ data: string; language: string }>(
      `/rooms/${roomCode}/snapshots/${snapshotId}`
    );
    return response.data;
  },

  /** Feature 8: Restore a snapshot (host only) */
  async restoreSnapshot(roomCode: string, snapshotId: number): Promise<void> {
    await api.post(`/rooms/${roomCode}/snapshots/${snapshotId}/restore`);
  },
};
