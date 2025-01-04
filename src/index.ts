import { Hono } from "hono";
import dotenv from "dotenv";
import { format } from "date-fns";
import { SlackClient } from "@/classes/SlackClient.js";
import { VisionAPiClient } from "@/classes/VisionApiClient.js";
import { featchFileByffer } from "@/utils/index.js";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";

dotenv.config();

const app = new Hono();
const slackClient = new SlackClient();
const visionClient = new VisionAPiClient();

const getCurrentTimestamp = () => format(new Date(), "yyyy-MM-dd HH:mm:ss");

const logError = (message: string, error?: unknown) => {
  console.error(`[ERROR] ${getCurrentTimestamp()} ${message}`, error || "");
};

const logInfo = (message: string, data?: unknown) => {
  console.log(`[INFO] ${getCurrentTimestamp()} ${message}`, data || "");
};

app.use(logger())

app.get("/ping", (c) => c.json({ message: "OK" }));

app.post("/slack/events", async (c) => {
  const retryNum = c.req.header("X-Slack-Retry-Num");

  if (retryNum) {
    logInfo(`リトライリクエストを無視しました: ${retryNum}`);
    return c.json(null, 200);
  }

  const body = await c.req.json();

  if (body.type === "url_verification") {
    logInfo("Slack URL検証リクエストを受信しました");
    return c.json({ challenge: body.challenge });
  }

  if (body.event?.type === "file_shared") {
    logInfo("Slackファイル共有イベントを受信しました");
    const { file_id: fileId, channel_id: channelId } = body.event;

    // 1. Slackからファイル情報を取得する
    const fileInfo = await slackClient.findFileByFileId(fileId);
    if (!fileInfo?.url_private) {
      logError("元のメッセージが見つかりませんでした");
      return c.json(null, 200);
    }

    // 2. チャンネルのスレッド履歴を取得する
    const resultHistories = await slackClient.findTheadHistoryByChannelId(
      channelId
    );
    if (!resultHistories) {
      logError("元のメッセージが見つかりませんでした");
      return c.json(null, 200);
    }

    // 3. スレッド内の対象メッセージを特定する
    const targetMessage = resultHistories.find((message: any) =>
      message.files?.some((file: any) => file.id === fileId)
    );
    if (!targetMessage?.ts) {
      logError("スレッドが取得できませんでした");
      return c.json(null, 200);
    }

    // 4. ファイルの内容をBase64形式で取得する
    const base64Content = await featchFileByffer(fileInfo.url_private, {
      "Authorization": `Bearer ${slackClient.getSlackToken}`
    });

    // 5. Vision APIを使用してOCRを実行する
    const text = await visionClient.getTextAnnotation(base64Content);
    if (!text) {
      logError("OCRで文字列が取得できませんでした");
      return c.json(null, 200);
    }

    // 6. OCR結果をSlackのスレッドに投稿する
    await slackClient.postMessage(channelId, targetMessage.ts, text);
    logInfo(
      JSON.stringify({
        status: "OK",
        message: "OCR結果をスレッドに投稿しました",
      })
    );
    return c.json(null, 200);
  }

  return c.json(null, 200);
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;

console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})
