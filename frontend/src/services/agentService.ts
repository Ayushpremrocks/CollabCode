import api from './api';

export interface AgentTestRequest {
  prompt: string;
}

export interface AgentTestResponse {
  response: string;
}

/**
 * agentService — Phase 1
 *
 * Communicates with the backend /api/agent endpoints.
 * The Gemini API key lives entirely in the Spring Boot backend.
 * This service only talks to OUR Spring Boot server; it never
 * calls Gemini or any Google API directly from the browser.
 */
export const agentService = {
  /**
   * Send a prompt to the backend Gemini test endpoint.
   * The Axios instance in api.ts automatically attaches the Clerk Bearer token.
   */
  async testPrompt(prompt: string): Promise<string> {
    const response = await api.post<AgentTestResponse>('/agent/test', { prompt });
    return response.data.response;
  },
};
