import api from './api';
import type { AgentDebugRequest, AgentDebugResponse } from '../types';

export interface AgentTestRequest {
  prompt: string;
}

export interface AgentTestResponse {
  response: string;
}

/**
 * agentService — Phase 1 + Phase 2
 *
 * All calls go through our Spring Boot backend. The Gemini API key
 * lives entirely server-side and is never exposed to the browser.
 */
export const agentService = {
  /** Phase 1: send a free-form prompt, receive Gemini's text response. */
  async testPrompt(prompt: string): Promise<string> {
    const response = await api.post<AgentTestResponse>('/agent/test', { prompt });
    return response.data.response;
  },

  /**
   * Phase 2: start an agentic debugging session.
   *
   * The backend will:
   *  1. Run the original code (via existing CodeExecutionService).
   *  2. Ask Gemini to propose a fix.
   *  3. Run the proposed fix to verify it.
   *  4. Iterate up to 3 times if still failing.
   *  5. Return the full result — proposedFix MUST be approved by the user.
   */
  async debugCode(request: AgentDebugRequest): Promise<AgentDebugResponse> {
    const response = await api.post<AgentDebugResponse>('/agent/debug', request);
    return response.data;
  },
};
