import fs from 'node:fs/promises';
import path from 'node:path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

export interface EditableConfig {
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  WORKSPACE_ROOT: string;
  DEFAULT_WORKSPACE: string;
  CLAUDE_BIN: string;
  LOG_LEVEL: string;
  ADMIN_HOST: string;
  ADMIN_PORT: string;
}

const CONFIG_KEYS: Array<keyof EditableConfig> = [
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'WORKSPACE_ROOT',
  'DEFAULT_WORKSPACE',
  'CLAUDE_BIN',
  'LOG_LEVEL',
  'ADMIN_HOST',
  'ADMIN_PORT',
];

export async function readEditableConfig(): Promise<EditableConfig> {
  const values = parseEnv(await readEnvFile());
  return {
    FEISHU_APP_ID: values.FEISHU_APP_ID || '',
    FEISHU_APP_SECRET: values.FEISHU_APP_SECRET || '',
    WORKSPACE_ROOT: values.WORKSPACE_ROOT || '/home/simple/work',
    DEFAULT_WORKSPACE: values.DEFAULT_WORKSPACE || '/home/simple/work',
    CLAUDE_BIN: values.CLAUDE_BIN || 'claude',
    LOG_LEVEL: values.LOG_LEVEL || 'info',
    ADMIN_HOST: values.ADMIN_HOST || '127.0.0.1',
    ADMIN_PORT: values.ADMIN_PORT || '3001',
  };
}

export async function writeEditableConfig(next: EditableConfig): Promise<void> {
  const existing = parseEnv(await readEnvFile());
  for (const key of CONFIG_KEYS) existing[key] = next[key] || '';

  const content = CONFIG_KEYS.map(key => `${key}=${existing[key] || ''}`).join('\n') + '\n';
  await fs.writeFile(ENV_PATH, content, 'utf8');
}

async function readEnvFile(): Promise<string> {
  try {
    return await fs.readFile(ENV_PATH, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
}

function parseEnv(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    values[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return values;
}
