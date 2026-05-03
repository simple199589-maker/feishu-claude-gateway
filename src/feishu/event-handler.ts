import * as lark from '@larksuiteoapi/node-sdk';
import type { IncomingMessage } from '../types.js';
import type { Logger } from '../utils/logger.js';

export type MessageHandler = (msg: IncomingMessage) => void;

type FeishuMention = { id?: { open_id?: string } };
type FeishuMessageEvent = {
  message: {
    message_type: string;
    content: string;
    chat_id: string;
    chat_type: string;
    message_id: string;
    mentions?: FeishuMention[];
  };
  sender?: { sender_id?: { open_id?: string } };
};

export function createEventDispatcher(
  logger: Logger,
  onMessage: MessageHandler,
  botOpenId?: string,
): lark.EventDispatcher {
  const dispatcher = new lark.EventDispatcher({});

  dispatcher.register({
    'im.message.receive_v1': async (data: unknown) => {
      try {
        const { message, sender } = data as FeishuMessageEvent;
        const msgType = message.message_type;

        if (msgType !== 'text' && msgType !== 'post') {
          logger.debug({ type: msgType }, 'Ignoring unsupported message type');
          return;
        }

        const userId = sender?.sender_id?.open_id;
        if (!userId) return;

        const chatId = message.chat_id;
        const chatType = message.chat_type;
        const messageId = message.message_id;
        const mentions = message.mentions;

        if (chatType === 'group') {
          const botMentioned = botOpenId
            ? mentions?.some(m => m.id?.open_id === botOpenId)
            : mentions && mentions.length > 0;
          if (!botMentioned) return;
        }

        let text = '';
        if (msgType === 'post') {
          text = extractTextFromPost(JSON.parse(message.content));
        } else {
          text = JSON.parse(message.content).text || '';
        }

        text = text.replace(/@_\w+\s*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
        if (!text) return;

        onMessage({ messageId, chatId, chatType, userId, text });
      } catch (err) {
        logger.error({ err }, 'Error handling Feishu message');
      }
    },
  });

  return dispatcher;
}

function extractTextFromPost(content: Record<string, unknown>): string {
  const bodies: Array<Record<string, unknown>> = [];

  if (Array.isArray(content.content)) {
    bodies.push(content);
  } else {
    for (const locale of Object.values(content)) {
      if (locale && typeof locale === 'object' && !Array.isArray(locale)) {
        const loc = locale as Record<string, unknown>;
        if (Array.isArray(loc.content)) bodies.push(loc);
      }
    }
  }

  for (const body of bodies) {
    const parts: string[] = [];
    if (typeof body.title === 'string') parts.push(body.title);

    for (const paragraph of body.content as unknown[][]) {
      if (!Array.isArray(paragraph)) continue;
      const line: string[] = [];
      for (const element of paragraph) {
        if (!element || typeof element !== 'object') continue;
        const el = element as Record<string, unknown>;
        if ((el.tag === 'text' || el.tag === 'a') && typeof el.text === 'string') line.push(el.text);
      }
      if (line.length > 0) parts.push(line.join(''));
    }

    if (parts.length > 0) return parts.join('\n');
  }

  return '';
}
