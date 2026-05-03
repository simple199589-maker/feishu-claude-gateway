export interface ChatSession {
  userId: string;
  chatId: string;
  workspace: string;
  sessionId?: string;
  running?: AbortController;
}

export class SessionRegistry {
  private sessions = new Map<string, ChatSession>();

  constructor(private defaultWorkspace: string) {}

  get(chatId: string, userId: string): ChatSession {
    const key = this.key(chatId, userId);
    const existing = this.sessions.get(key);
    if (existing) return existing;

    const session = { chatId, userId, workspace: this.defaultWorkspace };
    this.sessions.set(key, session);
    return session;
  }

  setWorkspace(chatId: string, userId: string, workspace: string): ChatSession {
    const session = this.get(chatId, userId);
    session.workspace = workspace;
    session.sessionId = undefined;
    return session;
  }

  clear(chatId: string, userId: string): ChatSession {
    const session = this.get(chatId, userId);
    session.sessionId = undefined;
    return session;
  }

  private key(chatId: string, userId: string): string {
    return `${chatId}:${userId}`;
  }
}
