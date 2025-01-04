import { WebClient } from "@slack/web-api";
import { format } from "date-fns";

const getCurrentTimestamp = () => format(new Date(), "yyyy-MM-dd HH:mm:ss");

const logError = (message: string, error?: unknown) => {
  console.error(`[ERROR] ${getCurrentTimestamp()} ${message}`, error || "");
};

const logInfo = (message: string, data?: unknown) => {
  console.log(`[INFO] ${getCurrentTimestamp()} ${message}`, data || "");
};

export class SlackClient {
  private slackClient: WebClient;

  constructor() {
    if (
      process.env.SLACK_BOT_TOKEN == null &&
      process.env.SLACK_BOT_TOKEN === ""
    ) {
      throw new Error("SLACK_BOT_TOKENが存在しません");
    }
    this.slackClient = new WebClient();
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
        logInfo("Slackからファイル情報を正常に取得しました");
        return response.file;
      } else {
        logError(JSON.stringify(response.error));
      }
    } catch (error) {
      logError("ファイル情報の取得に失敗しました", error);
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
        logError(JSON.stringify(response.error));
      }
    } catch (error) {
      logError("元のメッセージの取得に失敗しました", error);
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
        logError(JSON.stringify(response.errors));
      }
    } catch (error) {
      logError("Slackへのメッセージ投稿に失敗しました", error);
    }
  }
}
