import * as lark from '@larksuiteoapi/node-sdk';
import { startAdminServer } from './admin/server.js';
import { loadConfig } from './config/index.js';
import { createEventDispatcher } from './feishu/event-handler.js';
import { MessageSender } from './feishu/message-sender.js';
import { Gateway } from './gateway.js';
import { ClaudeRunner } from './runner/claude-runner.js';
import { SessionRegistry } from './session/session-registry.js';
import { WorkspaceRegistry } from './session/workspace-registry.js';
import { logger } from './utils/logger.js';

const config = loadConfig();
startAdminServer(config, logger);

const client = new lark.Client({
  appId: config.feishu.appId,
  appSecret: config.feishu.appSecret,
  disableTokenCache: false,
});

let botOpenId: string | undefined;
try {
  const botInfo = await client.request({ method: 'GET', url: '/open-apis/bot/v3/info' }) as {
    bot?: { open_id?: string };
  };
  botOpenId = botInfo.bot?.open_id;
  if (botOpenId) logger.info({ botOpenId }, 'Bot info fetched');
} catch (err) {
  logger.warn({ err }, 'Failed to fetch bot open_id; group mention matching will use fallback');
}

const sender = new MessageSender(client, logger);
const sessions = new SessionRegistry(config.defaultWorkspace);
const workspaces = new WorkspaceRegistry(config.workspaceRoot, config.defaultWorkspace);
const runner = new ClaudeRunner(config.claudeBin, logger);
const gateway = new Gateway(sender, sessions, workspaces, runner, logger);

const dispatcher = createEventDispatcher(logger, msg => {
  void gateway.handleMessage(msg);
}, botOpenId);

const wsClient = new lark.WSClient({
  appId: config.feishu.appId,
  appSecret: config.feishu.appSecret,
  loggerLevel: lark.LoggerLevel.info,
});

await wsClient.start({ eventDispatcher: dispatcher });

logger.info({ workspaceRoot: config.workspaceRoot }, 'Feishu Claude gateway started via WebSocket');
