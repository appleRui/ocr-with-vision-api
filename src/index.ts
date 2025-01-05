import { Hono } from "hono";
import { WebClient } from "@slack/web-api";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import dotenv from "dotenv";
import axios from "axios";
import { serve } from "@hono/node-server";
import { createLogger } from "./logger.js";

dotenv.config();

const app = new Hono();
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const visionClient = new ImageAnnotatorClient();

const customLogger = createLogger("main");

app.notFound((c) => {
  const userAgent = c.req.header("User-Agent");
  customLogger.info(`User-Agent: ${userAgent ?? "N/A"}`);
  return c.json({ message: "404 Not Found" }, 404);
});

app.get("/ping", (c) => {
  const userAgent = c.req.header("User-Agent");
  customLogger.info(`User-Agent: ${userAgent ?? "N/A"}`);
  return c.json({ message: "OK" }, 202);
});

app.post("/slack/events", async (c) => {
  const retryNum = c.req.header("X-Slack-Retry-Num");

  if (retryNum) {
    customLogger.info(`リトライリクエストを無視しました: ${retryNum}`);
    return c.json(null, 200);
  }

  const body = await c.req.json();

  if (body.type === "url_verification") {
    customLogger.info("Slack URL検証リクエストを受信しました");
    return c.json({ challenge: body.challenge });
  }

  if (body.event?.type === "file_shared") {
    customLogger.info("Slackファイル共有イベントを受信しました");
    const { file_id: fileId, channel_id: channelId } = body.event;

    const fileInfo = await getFileInfo(fileId);
    if (!fileInfo) {
      customLogger.info("ファイル情報の取得に失敗しました");
      return c.json(null, 200);
    }

    const originalTs = await getOriginalMessageTs(channelId, fileId);
    if (!originalTs) {
      customLogger.info("元のメッセージが見つかりませんでした");
      return c.json(null, 200);
    }

    const text = await postVisionApi(fileInfo.url_private);
    if (!text) {
      customLogger.info("OCRで文字列が取得できませんでした");
      return c.json(null, 200);
    }

    await postMessage(channelId, originalTs, text);
    return c.json(null, 200);
  }

  return c.json(null, 200);
});

const getFileInfo = async (fileId: string) => {
  try {
    const response = await slackClient.files.info({ file: fileId });
    if (response.ok && response.file) {
      customLogger.info("Slackからファイル情報を正常に取得しました");
      return response.file;
    }
  } catch (error) {
    customLogger.error(`ファイル情報の取得に失敗しました: ${error}`);
  }
  return null;
};

const getOriginalMessageTs = async (
  channel: string,
  fileId: string
): Promise<string | null> => {
  try {
    const response = await slackClient.conversations.history({
      channel,
      limit: 10,
    });

    if (response.ok && response.messages) {
      const targetMessage = response.messages.find((message: any) =>
        message.files?.some((file: any) => file.id === fileId)
      );

      if (targetMessage && targetMessage.ts) {
        customLogger.info(`元のメッセージを取得しました: ${targetMessage.ts}`);
        return targetMessage.ts;
      }
    }
  } catch (error) {
    customLogger.error(`元のメッセージの取得に失敗しました: ${error}`);
  }

  return null;
};

const postVisionApi = async (imageUrl?: string): Promise<string | null> => {
  try {
    if (!imageUrl) {
      customLogger.info("画像URLが提供されていません");
      return null;
    }

    const response = await axios.get(imageUrl, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      responseType: "arraybuffer",
    });

    const [result] = await visionClient.textDetection({
      image: { content: response.data.toString("base64") },
    });

    const textAnnotations = result.textAnnotations;
    if (!textAnnotations || textAnnotations.length === 0) {
      customLogger.info("Google Vision APIで文字が検出されませんでした");
      return null;
    }

    const text = textAnnotations[0]?.description?.trim() || "";
    customLogger.info(`OCR解析結果: ${text.replace('\n', ', ')}`);
    return text;
  } catch (error) {
    customLogger.error(`Google Vision APIでの画像解析に失敗しました: ${error}`);
    return null;
  }
};

const postMessage = async (channel: string, threadTs: string, text: string) => {
  if (!channel || !threadTs) {
    customLogger.error(
      `チャンネルIDまたはスレッドタイムスタンプが指定されていません: ${JSON.stringify(
        {
          channel,
          threadTs,
        }
      )}`
    );
    return;
  }

  await slackClient.chat
    .postMessage({
      channel,
      thread_ts: threadTs,
      text: `${text}`,
    })
    .catch((error) => {
      customLogger.error(`Slackへのメッセージ投稿に失敗しました: ${error}`);
    });
  customLogger.info("メッセージの投稿が完了しました");
};

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;

console.info(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
