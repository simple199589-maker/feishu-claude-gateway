import type { IncomingMessage, CardState } from './types.js';
import { buildCard, buildHelpCard, buildTextCard } from './feishu/card-builder.js';
import { MessageSender } from './feishu/message-sender.js';
import { ClaudeRunner } from './runner/claude-runner.js';
import { SessionRegistry } from './session/session-registry.js';
import { WorkspaceRegistry } from './session/workspace-registry.js';
import { RateLimiter } from './utils/rate-limiter.js';
import type { Logger } from './utils/logger.js';

export class Gateway {
  constructor(
    private sender: MessageSender,
    private sessions: SessionRegistry,
    private workspaces: WorkspaceRegistry,
    private runner: ClaudeRunner,
    private logger: Logger,
  ) {}

  async handleMessage(msg: IncomingMessage): Promise<void> {
    const session = this.sessions.get(msg.chatId, msg.userId);
    const command = msg.text.trim();

    if (command === '/help') {
      await this.sender.sendCard(msg.chatId, buildHelpCard());
      return;
    }

    if (command === '/status') {
      await this.sender.sendCard(msg.chatId, buildTextCard('Status', [
        `**Workspace:** \`${session.workspace}\``,
        `**Session:** ${session.sessionId ? `\`${session.sessionId}\`` : '_None_'}`,
        `**Running:** ${session.running ? 'Yes' : 'No'}`,
      ].join('\n')));
      return;
    }

    if (command.startsWith('/use ')) {
      try {
        const workspace = this.workspaces.resolve(command.slice('/use '.length).trim());
        this.sessions.setWorkspace(msg.chatId, msg.userId, workspace);
        await this.sender.sendCard(msg.chatId, buildTextCard('Workspace switched', `Now using \`${workspace}\``, 'green'));
      } catch (err) {
        await this.sender.sendCard(msg.chatId, buildTextCard('Workspace error', err instanceof Error ? err.message : String(err), 'red'));
      }
      return;
    }

    if (command === '/new') {
      this.sessions.clear(msg.chatId, msg.userId);
      await this.sender.sendCard(msg.chatId, buildTextCard('New session', 'Claude Code session cleared.', 'green'));
      return;
    }

    if (command === '/stop') {
      if (session.running) {
        session.running.abort();
        session.running = undefined;
        await this.sender.sendCard(msg.chatId, buildTextCard('Stopped', 'Current Claude Code task was stopped.', 'yellow'));
      } else {
        await this.sender.sendCard(msg.chatId, buildTextCard('No running task', 'There is no active task in this chat.', 'yellow'));
      }
      return;
    }

    if (session.running) {
      await this.sender.sendCard(msg.chatId, buildTextCard('Busy', 'A task is already running. Send `/stop` first.', 'yellow'));
      return;
    }

    await this.runClaude(msg, session);
  }

  private async runClaude(msg: IncomingMessage, session: ReturnType<SessionRegistry['get']>): Promise<void> {
    const startedAt = Date.now();
    const abortController = new AbortController();
    session.running = abortController;

    const state: CardState = {
      status: 'thinking',
      responseText: '',
      toolCalls: [],
      sessionId: session.sessionId,
      workspace: session.workspace,
    };

    const messageId = await this.sender.sendCard(msg.chatId, buildCard(state));
    const limiter = new RateLimiter(1500);
    const update = async () => {
      if (messageId) await this.sender.updateCard(messageId, buildCard(state));
    };

    try {
      state.status = 'running';
      console.log('[gateway => Feishu] running');
      const result = await this.runner.run({
        prompt: msg.text,
        cwd: session.workspace,
        sessionId: session.sessionId,
        signal: abortController.signal,
        onText: text => {
          state.responseText += text;
          limiter.schedule(update);
        },
        onTool: (name, detail, status) => {
          state.toolCalls = [{ name, detail, status }];
          limiter.schedule(update);
        },
      });

      session.sessionId = result.sessionId;
      state.sessionId = result.sessionId;
      state.model = result.model;
      state.status = abortController.signal.aborted ? 'error' : 'complete';
      state.errorMessage = abortController.signal.aborted ? 'Stopped by user' : undefined;
      console.log(`[gateway => Feishu] ${state.status}`);
    } catch (err) {
      this.logger.error({ err }, 'Claude run failed');
      state.status = 'error';
      state.errorMessage = err instanceof Error ? err.message : String(err);
      console.log('[gateway => Feishu] error');
    } finally {
      session.running = undefined;
      state.durationMs = Date.now() - startedAt;
      await limiter.flush();
      await update();
    }
  }
}
