import * as fs from 'node:fs';
import type * as lark from '@larksuiteoapi/node-sdk';
import type { Logger } from '../utils/logger.js';

export class MessageSender {
  constructor(
    private client: lark.Client,
    private logger: Logger,
  ) {}

  async sendCard(chatId: string, cardContent: string): Promise<string | undefined> {
    try {
      const resp = await this.client.im.v1.message.create({
        params: { receive_id_type: 'chat_id' },
        data: { receive_id: chatId, content: cardContent, msg_type: 'interactive' },
      });
      return resp?.data?.message_id;
    } catch (err) {
      this.logger.error({ err, chatId }, 'Failed to send card');
      return undefined;
    }
  }

  async updateCard(messageId: string, cardContent: string): Promise<boolean> {
    try {
      await this.client.im.v1.message.patch({
        path: { message_id: messageId },
        data: { content: cardContent },
      });
      return true;
    } catch (err) {
      this.logger.error({ err, messageId }, 'Failed to update card');
      return false;
    }
  }

  async sendText(chatId: string, text: string): Promise<void> {
    try {
      await this.client.im.v1.message.create({
        params: { receive_id_type: 'chat_id' },
        data: { receive_id: chatId, content: JSON.stringify({ text }), msg_type: 'text' },
      });
    } catch (err) {
      this.logger.error({ err, chatId }, 'Failed to send text');
    }
  }

  async uploadImage(filePath: string): Promise<string | undefined> {
    try {
      const resp = await this.client.im.v1.image.create({
        data: { image_type: 'message', image: fs.createReadStream(filePath) },
      });
      return resp?.image_key;
    } catch (err) {
      this.logger.error({ err, filePath }, 'Failed to upload image');
      return undefined;
    }
  }

  async sendImageFile(chatId: string, filePath: string): Promise<boolean> {
    const imageKey = await this.uploadImage(filePath);
    if (!imageKey) return false;

    try {
      await this.client.im.v1.message.create({
        params: { receive_id_type: 'chat_id' },
        data: { receive_id: chatId, content: JSON.stringify({ image_key: imageKey }), msg_type: 'image' },
      });
      return true;
    } catch (err) {
      this.logger.error({ err, chatId, imageKey }, 'Failed to send image');
      return false;
    }
  }

  async uploadFile(filePath: string, fileName: string, fileType = 'stream'): Promise<string | undefined> {
    try {
      const resp = await this.client.im.v1.file.create({
        data: { file_type: fileType as never, file_name: fileName, file: fs.createReadStream(filePath) },
      });
      return resp?.file_key;
    } catch (err) {
      this.logger.error({ err, filePath, fileType }, 'Failed to upload file');
      return undefined;
    }
  }

  async sendLocalFile(chatId: string, filePath: string, fileName: string, fileType = 'stream'): Promise<boolean> {
    const fileKey = await this.uploadFile(filePath, fileName, fileType);
    if (!fileKey) return false;

    try {
      await this.client.im.v1.message.create({
        params: { receive_id_type: 'chat_id' },
        data: { receive_id: chatId, content: JSON.stringify({ file_key: fileKey }), msg_type: 'file' },
      });
      return true;
    } catch (err) {
      this.logger.error({ err, chatId, fileKey }, 'Failed to send file');
      return false;
    }
  }
}
