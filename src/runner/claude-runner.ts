import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Logger } from '../utils/logger.js';

export interface ClaudeRunOptions {
  prompt: string;
  cwd: string;
  sessionId?: string;
  signal: AbortSignal;
  onText: (text: string) => void | Promise<void>;
  onTool?: (name: string, detail: string, status: 'running' | 'complete') => void | Promise<void>;
}

export interface ClaudeRunResult {
  sessionId?: string;
  model?: string;
}

type ClaudeStreamEvent = {
  type?: string;
  session_id?: string;
  event?: ClaudeStreamEvent;
  message?: {
    model?: string;
    content?: Array<{
      type?: string;
      text?: string;
      name?: string;
      id?: string;
    }>;
  };
  delta?: {
    type?: string;
    text?: string;
  };
};

export class ClaudeRunner {
  constructor(
    private claudeBin: string,
    private logger: Logger,
  ) {}

  async run(options: ClaudeRunOptions): Promise<ClaudeRunResult> {
    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
    ];
    if (options.sessionId) args.push('--resume', options.sessionId);
    args.push(options.prompt);

    console.log(`[Claude <= user]\n${options.prompt}`);

    const child = spawn(this.claudeBin, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: options.signal,
    });

    let stderr = '';
    let sessionId = options.sessionId;
    let model: string | undefined;

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });

    const rl = createInterface({ input: child.stdout });
    rl.on('line', async line => {
      if (!line.trim()) return;
      try {
        const parsed = JSON.parse(line) as ClaudeStreamEvent;
        const event = parsed.event || parsed;
        sessionId = typeof parsed.session_id === 'string' ? parsed.session_id : sessionId;
        sessionId = typeof event.session_id === 'string' ? event.session_id : sessionId;
        model = typeof event.message?.model === 'string' ? event.message.model : model;

        const type = event.type;
        if (type === 'assistant' && Array.isArray(event.message?.content)) {
          for (const block of event.message.content) {
              if (block.type === 'text' && typeof block.text === 'string') {
                console.log(`[Claude => gateway]\n${block.text}`);
                await options.onText(block.text);
              }
            if (block.type === 'tool_use' && options.onTool) {
              await options.onTool(block.name || 'tool', block.id || '', 'running');
            }
          }
        }
        if (type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const text = event.delta.text || '';
          if (text) console.log(`[Claude => gateway]\n${text}`);
          await options.onText(text);
        }
      } catch (err) {
        this.logger.debug({ err, line }, 'Failed to parse Claude stream line');
      }
    });

    const code = await new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });

    if (code !== 0 && !options.signal.aborted) {
      throw new Error(stderr.trim() || `Claude exited with code ${code}`);
    }

    return { sessionId, model };
  }
}
