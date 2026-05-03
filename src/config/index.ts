import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function resolvePath(value: string): string {
  return path.resolve(value.replace(/^~/, process.env.HOME || ''));
}

export interface AppConfig {
  adminHost: string;
  adminPort: number;
  feishu: {
    appId: string;
    appSecret: string;
    encryptKey?: string;
    verificationToken?: string;
  };
  workspaceRoot: string;
  defaultWorkspace: string;
  claudeBin: string;
}

export function loadConfig(): AppConfig {
  const workspaceRoot = resolvePath(process.env.WORKSPACE_ROOT || process.cwd());
  const defaultWorkspace = resolvePath(process.env.DEFAULT_WORKSPACE || workspaceRoot);

  if (!defaultWorkspace.startsWith(workspaceRoot)) {
    throw new Error('DEFAULT_WORKSPACE must be inside WORKSPACE_ROOT');
  }

  return {
    adminHost: process.env.ADMIN_HOST || '127.0.0.1',
    adminPort: Number(process.env.ADMIN_PORT || 3001),
    feishu: {
      appId: required('FEISHU_APP_ID'),
      appSecret: required('FEISHU_APP_SECRET'),
      encryptKey: process.env.FEISHU_ENCRYPT_KEY,
      verificationToken: process.env.FEISHU_VERIFICATION_TOKEN,
    },
    workspaceRoot,
    defaultWorkspace,
    claudeBin: process.env.CLAUDE_BIN || 'claude',
  };
}
