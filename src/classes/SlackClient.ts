import { createLogger } from "../logger.js";
import { WebClient } from "@slack/web-api";

const logger = createLogger('SlackClient')

export class SlackClient {
  private slackClient: WebClient;

  constructor() {
    if (
      process.env.SLACK_BOT_TOKEN == null &&
      process.env.SLACK_BOT_TOKEN === ""
    ) {
      throw new Error("SLACK_BOT_TOKENが存在しません");
    }
    this.slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  public getSlackToken() {
    if(!this.slackClient.token) {
      throw new Error("TOKENが取得できませんでした");
    }

    return this.slackClient.token;
  }

  public async findFileByFileId(fileId: string) {
    try {
      const response = await this.slackClient.files.info({ file: fileId });
      if (response.ok && response.file) {
        logger.info("Slackからファイル情報を正常に取得しました");
        return response.file;
      } else {
        logger.error(JSON.stringify(response.error));
      }
    } catch (error) {
      logger.error(`ファイル情報の取得に失敗しました: ${error}`);
    }
    return null;
  }

  public async findTheadHistoryByChannelId(channel: string) {
    try {
      const response = await this.slackClient.conversations.history({
        channel,
        limit: 10,
      });

      if (response.ok && response.messages) {
        return response.messages;
      } else {
        logger.error(JSON.stringify(response.error));
      }
    } catch (error) {
      logger.error(`元のメッセージの取得に失敗しました: ${error}`);
    }

    return null;
  }

  public async postMessage(channel: string, threadTs: string, text: string) {
    try {
      const response = await this.slackClient.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: `${text}`,
      });

      if (!response.ok) {
        logger.error(JSON.stringify(response.errors));
      }

      return response.ok;
    } catch (error) {
      logger.error(`Slackへのメッセージ投稿に失敗しました: ${error}`);
    }
  }
}