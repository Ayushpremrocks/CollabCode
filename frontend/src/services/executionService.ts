import api from './api';
import type { ExecuteCodeRequest, ExecuteCodeResponse } from '../types';

export const executionService = {
  async executeCode(request: ExecuteCodeRequest): Promise<ExecuteCodeResponse> {
    const response = await api.post<ExecuteCodeResponse>('/rooms/execute', request);
    return response.data;
  },
};
