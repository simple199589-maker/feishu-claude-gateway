export interface IncomingMessage {
  messageId: string;
  chatId: string;
  chatType: string;
  userId: string;
  text: string;
  imageKey?: string;
  fileKey?: string;
  fileName?: string;
}

export type CardStatus = 'thinking' | 'running' | 'complete' | 'error' | 'waiting_for_input';

export interface ToolCall {
  name: string;
  detail: string;
  status: 'running' | 'complete';
}

export interface CardState {
  status: CardStatus;
  responseText: string;
  toolCalls: ToolCall[];
  errorMessage?: string;
  durationMs?: number;
  model?: string;
  sessionId?: string;
  workspace?: string;
}
