import type { CardState, CardStatus } from '../types.js';

const STATUS_CONFIG: Record<CardStatus, { color: string; title: string; icon: string }> = {
  thinking: { color: 'blue', title: 'Thinking...', icon: '🔵' },
  running: { color: 'blue', title: 'Running...', icon: '🔵' },
  complete: { color: 'green', title: 'Complete', icon: '🟢' },
  error: { color: 'red', title: 'Error', icon: '🔴' },
  waiting_for_input: { color: 'yellow', title: 'Waiting for Input', icon: '🟡' },
};

const MAX_CONTENT_LENGTH = 28000;

function truncateContent(text: string): string {
  if (text.length <= MAX_CONTENT_LENGTH) return text;
  const half = Math.floor(MAX_CONTENT_LENGTH / 2) - 50;
  return text.slice(0, half) + '\n\n... (content truncated) ...\n\n' + text.slice(-half);
}

export function buildCard(state: CardState): string {
  const config = STATUS_CONFIG[state.status];
  const elements: unknown[] = [];

  if (state.toolCalls.length > 0) {
    elements.push({
      tag: 'markdown',
      content: state.toolCalls
        .map(t => `${t.status === 'running' ? '⏳' : '✅'} **${t.name}** ${t.detail}`)
        .join('\n'),
    });
    elements.push({ tag: 'hr' });
  }

  elements.push({
    tag: 'markdown',
    content: state.responseText ? truncateContent(state.responseText) : '_Thinking..._',
  });

  if (state.errorMessage) {
    elements.push({ tag: 'hr' });
    elements.push({ tag: 'markdown', content: `**Error:** ${state.errorMessage}` });
  }

  const noteParts: string[] = [];
  if (state.workspace) noteParts.push(state.workspace);
  if (state.sessionId) noteParts.push(`session: ${state.sessionId.slice(0, 8)}`);
  if (state.model) noteParts.push(state.model.replace(/^claude-/, ''));
  if (state.durationMs !== undefined) noteParts.push(`${(state.durationMs / 1000).toFixed(1)}s`);
  if (noteParts.length > 0) {
    elements.push({
      tag: 'note',
      elements: [{ tag: 'plain_text', content: noteParts.join(' | ') }],
    });
  }

  return JSON.stringify({
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      template: config.color,
      title: { content: `${config.icon} ${config.title}`, tag: 'plain_text' },
    },
    elements,
  });
}

export function buildTextCard(title: string, content: string, color = 'blue'): string {
  return JSON.stringify({
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      template: color,
      title: { content: title, tag: 'plain_text' },
    },
    elements: [{ tag: 'markdown', content }],
  });
}

export function buildHelpCard(): string {
  return buildTextCard('Help', [
    '`/help` - show help',
    '`/status` - show current workspace/session',
    '`/use <workspace>` - switch workspace under WORKSPACE_ROOT',
    '`/new` - start a fresh Claude Code session',
    '`/stop` - stop current running task',
    '',
    'Send any other message to Claude Code in the active workspace.',
  ].join('\n'));
}
