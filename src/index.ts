import { Hono } from "hono";
import { WebClient } from "@slack/web-api";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import dotenv from "dotenv";
import axios from "axios";
import { serve } from "@hono/node-server";
import { createLogger } from "./logger.js";
import { SlackClient } from "./classes/SlackClient.js";
import { VisionAPiClient } from "./classes/VisionApiClient.js";

dotenv.config();

const app = new Hono();
// const visionClient = new ImageAnnotatorClient();

const logger = createLogger("main");
const slackClient = new SlackClient();
const visionClient = new VisionAPiClient();

app.notFound((c) => {
  const userAgent = c.req.header("User-Agent");
  logger.info(`User-Agent: ${userAgent ?? "N/A"}`);
  return c.json({ message: "404 Not Found" }, 404);
});

app.get("/ping", (c) => {
  const userAgent = c.req.header("User-Agent");
  logger.info(`User-Agent: ${userAgent ?? "N/A"}`);
  return c.json({ message: "OK" }, 202);
});

app.post("/slack/events", async (c) => {
  
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

    const fileInfo = await slackClient.findFileByFileId(fileId);
    if (!fileInfo) {
      logger.info("ファイル情報の取得に失敗しました");
      return c.json(null, 200);
    }

    const messages = await slackClient.findTheadHistoryByChannelId(channelId);
    if (messages == null) {
      logger.info("スレッドが取得できませんでした");
      return c.json(null, 200);
    };

    const targetMessage = messages.find((message: any) =>
      message.files?.some((file: any) => file.id === fileId)
    );

    if (!targetMessage?.ts) {
      logger.info("元のメッセージが見つかりませんでした");
      return c.json(null, 200);
    }

    if (!fileInfo.url_private) {
      logger.info("画像URLが提供されていません");
      return c.json(null, 200);
    }
    
    const response = await axios.get(fileInfo.url_private, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      responseType: "arraybuffer",
    });
    
    const result = await visionClient.getTextAnnotation(response.data.toString("base64"));
    if (!result) {
      logger.info("OCRで文字列が取得できませんでした");
      return c.json(null, 200);
    }

    const postMessageResult = await slackClient.postMessage(channelId, targetMessage.ts, result);
    if (!postMessageResult) {
      logger.info("スレッド投稿に失敗しました")
      return c.json(null, 200);
    }
    
    logger.info("プロセスを正常に処理しました")
    return c.json(null, 200);
  }

  logger.info("イベントタイプに一致しないためスキップしました")
  return c.json(null, 200);
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;

console.info(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
