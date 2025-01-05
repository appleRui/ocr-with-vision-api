import { createLogger } from "../logger.js";
import { SlackClient } from "../classes/SlackClient.js";
import { VisionAPiClient } from "../classes/VisionApiClient.js";
import { featchFileByffer } from "../utils/index.js";
import type { Context } from "hono";
import type { BlankEnv, BlankInput } from "hono/types";

const logger = createLogger('handleSlackEvents.usecase')

export const handleSlackEventsUseCase = async (c: Context<BlankEnv, "/slack/events", BlankInput>) => {
    const slackClient = new SlackClient();
    const visionClient = new VisionAPiClient();
    
    const retryNum = c.req.header("X-Slack-Retry-Num");
  
    if (retryNum) {
      logger.info(`リトライリクエストを無視しました: ${retryNum}`);
      return c.json(null, 200);
    }
  
    const body = await c.req.json();
  
    if (body.type === "url_verification") {
      logger.info("Slack URL検証リクエストを受信しました");
      return c.json({ challenge: body.challenge });
    }
  
    if (body.event?.type === "file_shared") {
      logger.info("Slackファイル共有イベントを受信しました");
      const { file_id: fileId, channel_id: channelId } = body.event;
  
      // 1. Slackからファイル情報を取得する
      const fileInfo = await slackClient.findFileByFileId(fileId);
      if (!fileInfo?.url_private) {
        logger.error("元のメッセージが見つかりませんでした");
        return c.json(null, 200);
      }
  
      // 2. チャンネルのスレッド履歴を取得する
      const resultHistories = await slackClient.findTheadHistoryByChannelId(
        channelId
      );
      if (!resultHistories) {
        logger.error("元のメッセージが見つかりませんでした");
        return c.json(null, 200);
      }
  
      // 3. スレッド内の対象メッセージを特定する
      const targetMessage = resultHistories.find((message: any) =>
        message.files?.some((file: any) => file.id === fileId)
      );
      if (!targetMessage?.ts) {
        logger.error("スレッドが取得できませんでした");
        return c.json(null, 200);
      }
  
      // 4. ファイルの内容をBase64形式で取得する
      logger.info(fileInfo.url_private);
      logger.info(slackClient.getSlackToken());
      const base64Content = await featchFileByffer(fileInfo.url_private, {
        "Authorization": `Bearer ${slackClient.getSlackToken()}`
      });

      // 5. Vision APIを使用してOCRを実行する
      logger.info(base64Content);
      const text = await visionClient.getTextAnnotation(base64Content);
      if (!text) {
        logger.error("OCRで文字列が取得できませんでした");
        return c.json(null, 200);
      }
  
      // 6. OCR結果をSlackのスレッドに投稿する
      await slackClient.postMessage(channelId, targetMessage.ts, text);
      logger.info(
        JSON.stringify("OCR結果をスレッドに投稿しました")
      );
      return c.json(null, 200);
    }
  
    return c.json(null, 200);
  }